import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REGISTERED_ENGINES, type EngineDescriptor } from "../engines/contract";
import {
  engineIsActive,
  type Db,
} from "../permissions.server";
import {
  PLATFORM_VERSION,
  SDK_VERSION,
  transition,
} from "../platform-manager.server";
import { capabilitySeeds, invokeCapability } from "../capabilities.server";
import { publishAndDispatch, subscriptionSeeds } from "../mesh.server";
import {
  EXECUTION_OS_CONTRACT_VERSION,
  EXECUTION_OS_DESCRIPTOR,
  EXECUTION_OS_ENGINE_ID,
  executionOsInboundSubscriptionSeeds,
} from "./execution-os.server";

const ConnectInput = z.object({
  base_url: z.string().url().optional(),
  tenant_id: z.string().min(1).max(128).optional(),
  timezone: z.string().min(1).max(80).optional(),
});

function descriptorFor(id: string) {
  const descriptor = REGISTERED_ENGINES.find((engine) => engine.id === id);
  if (!descriptor) throw new Error(`Engine descriptor "${id}" is unavailable.`);
  return descriptor;
}

async function ensureEngineRow(
  db: Db,
  userId: string,
  descriptor: EngineDescriptor,
) {
  const { data: existing, error: existingError } = await db
    .from("engines")
    .select("lifecycle_state")
    .eq("user_id", userId)
    .eq("engine_id", descriptor.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const metadata = {
    name: descriptor.name,
    version: descriptor.version,
    purpose: descriptor.purpose,
    owner: descriptor.owner,
    capabilities: descriptor.capabilities as never,
    data_owned: descriptor.dataOwned as never,
    events_published: descriptor.eventsPublished as never,
    events_consumed: descriptor.eventsConsumed as never,
    required_signals: descriptor.requiredSignals as never,
    published_signals: descriptor.publishedSignals as never,
    dependencies: descriptor.dependencies as never,
    permissions: descriptor.permissions as never,
    platform_version: PLATFORM_VERSION,
    sdk_version: SDK_VERSION,
  };

  if (existing) {
    const reinstall = existing.lifecycle_state === "UNINSTALLED";
    const { error } = await db
      .from("engines")
      .update({
        ...metadata,
        ...(reinstall
          ? {
              status: "inactive",
              lifecycle_state: "REGISTERED",
              health: "disabled",
            }
          : {}),
      })
      .eq("user_id", userId)
      .eq("engine_id", descriptor.id);
    if (error) throw new Error(error.message);
    return reinstall ? "REGISTERED" : (existing.lifecycle_state as string);
  }

  const { error } = await db.from("engines").insert({
    user_id: userId,
    engine_id: descriptor.id,
    ...metadata,
    status: "inactive",
    lifecycle_state: "REGISTERED",
    health: "disabled",
  });
  if (error) throw new Error(error.message);
  return "REGISTERED";
}

async function ensureDailyPlanKernelEngine(db: Db, userId: string) {
  const descriptor = descriptorFor("daily-plan");
  let state = await ensureEngineRow(db, userId, descriptor);

  if (state === "REGISTERED" || state === "DISABLED") {
    await transition(
      db,
      userId,
      descriptor.id,
      "VALIDATED",
      "Phase 5 Kernel engine validation",
    );
    state = "VALIDATED";
  }
  if (state === "VALIDATED" || state === "SUSPENDED") {
    await transition(
      db,
      userId,
      descriptor.id,
      "ENABLED",
      "Phase 5 Kernel engine activation",
    );
  }

  return descriptor;
}

async function configValue(
  db: Db,
  userId: string,
  key: string,
  fallback?: string,
) {
  const { data, error } = await db
    .from("engine_config")
    .select("value")
    .eq("user_id", userId)
    .eq("engine_id", EXECUTION_OS_ENGINE_ID)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value?.trim() || fallback?.trim() || null;
}

function normalizedBaseUrl(value: string) {
  const url = new URL(value);
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error("Execution OS must use HTTPS in production.");
  }
  return value.replace(/\/+$/, "");
}

async function publicExecutionOsProbe(baseUrl: string) {
  const [manifestRes, readinessRes] = await Promise.all([
    fetch(`${baseUrl}/api/v1/hos/manifest`),
    fetch(`${baseUrl}/api/v1/hos/readiness`),
  ]);
  if (!manifestRes.ok) {
    throw new Error(`Execution OS manifest probe failed with HTTP ${manifestRes.status}.`);
  }

  const manifestPayload = (await manifestRes.json()) as any;
  const readinessPayload = (await readinessRes.json().catch(() => null)) as any;
  const manifest = manifestPayload?.data ?? manifestPayload;
  const readiness = readinessPayload?.data ?? readinessPayload;

  const required = new Set(EXECUTION_OS_DESCRIPTOR.capabilities);
  const remoteCapabilities = new Set(
    Array.isArray(manifest?.capabilities)
      ? manifest.capabilities.map((item: any) => String(item?.name ?? item))
      : [],
  );
  const missing = [...required].filter((capability) => !remoteCapabilities.has(capability));

  if (manifest?.engineId !== EXECUTION_OS_ENGINE_ID) {
    throw new Error(
      `Expected Execution OS manifest engineId "${EXECUTION_OS_ENGINE_ID}".`,
    );
  }
  if (manifest?.identityAuthority !== "HumanKernelOS") {
    throw new Error("Execution OS does not declare HumanKernelOS as identity authority.");
  }
  if (manifest?.scheduleAuthority !== "HumanKernelOS") {
    throw new Error("Execution OS does not declare HumanKernelOS as schedule authority.");
  }
  const contract = String(manifest?.contractVersion ?? "");
  if (contract.split(".")[0] !== EXECUTION_OS_CONTRACT_VERSION.split(".")[0]) {
    throw new Error(
      `Execution OS contract ${contract || "unknown"} is incompatible with HOS adapter ${EXECUTION_OS_CONTRACT_VERSION}.`,
    );
  }
  if (missing.length) {
    throw new Error(
      `Execution OS manifest is missing required capabilities: ${missing.join(", ")}.`,
    );
  }

  return {
    manifest,
    readiness,
    readiness_http_status: readinessRes.status,
    ready: readinessRes.ok && readiness?.status === "ready",
  };
}

async function persistExecutionOsRuntimeContracts(
  db: Db,
  userId: string,
  operational: boolean,
) {
  const capabilities = capabilitySeeds().filter(
    (item) => item.provider_engine_id === EXECUTION_OS_ENGINE_ID,
  );
  if (capabilities.length > 0) {
    const { error } = await db.from("engine_capabilities").upsert(
      capabilities.map((item) => ({ ...item, user_id: userId })),
      { onConflict: "user_id,provider_engine_id,capability,version" },
    );
    if (error) throw new Error(error.message);
  }

  const outbound = subscriptionSeeds().filter(
    (item) => item.engine_id === EXECUTION_OS_ENGINE_ID,
  );
  if (outbound.length > 0) {
    const { error } = await db.from("engine_subscriptions").upsert(
      outbound.map((item) => ({
        user_id: userId,
        engine_id: item.engine_id,
        event_type: item.event_type,
        handler: item.handler,
        enabled: operational,
      })),
      { onConflict: "user_id,engine_id,event_type,handler" },
    );
    if (error) throw new Error(error.message);
  }

  for (const item of executionOsInboundSubscriptionSeeds()) {
    const enabled = await engineIsActive(db, userId, item.engine_id);
    const { error } = await db.from("engine_subscriptions").upsert(
      {
        user_id: userId,
        engine_id: item.engine_id,
        event_type: item.event_type,
        handler: item.handler,
        enabled,
      },
      { onConflict: "user_id,engine_id,event_type,handler" },
    );
    if (error) throw new Error(error.message);
  }

  return {
    capabilities: capabilities.length,
    outbound_subscriptions: outbound.length,
    inbound_subscriptions: executionOsInboundSubscriptionSeeds().length,
  };
}

export const connectExecutionOs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnectInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const baseUrl = normalizedBaseUrl(
      data.base_url ||
        (await configValue(
          context.supabase,
          context.userId,
          "base_url",
          process.env.EXECUTION_OS_BASE_URL,
        )) ||
        (() => {
          throw new Error(
            "Provide the Execution OS base URL or configure EXECUTION_OS_BASE_URL.",
          );
        })(),
    );

    const remote = await publicExecutionOsProbe(baseUrl);
    await ensureDailyPlanKernelEngine(context.supabase, context.userId);
    const lifecycle = await ensureEngineRow(
      context.supabase,
      context.userId,
      EXECUTION_OS_DESCRIPTOR,
    );

    const configRows = [
      { key: "base_url", value: baseUrl },
      {
        key: "tenant_id",
        value:
          data.tenant_id ||
          (await configValue(
            context.supabase,
            context.userId,
            "tenant_id",
            process.env.HOS_EXECUTION_TENANT_ID || "personal-hos",
          )),
      },
      {
        key: "timezone",
        value:
          data.timezone ||
          (await configValue(
            context.supabase,
            context.userId,
            "timezone",
            process.env.HOS_DEFAULT_TIMEZONE || "UTC",
          )),
      },
    ];

    const { error: configError } = await context.supabase
      .from("engine_config")
      .upsert(
        configRows.map((row) => ({
          user_id: context.userId,
          engine_id: EXECUTION_OS_ENGINE_ID,
          key: row.key,
          value: row.value,
          is_secret_ref: false,
        })),
        { onConflict: "user_id,engine_id,key" },
      );
    if (configError) throw new Error(configError.message);

    const runtime = await persistExecutionOsRuntimeContracts(
      context.supabase,
      context.userId,
      lifecycle === "ENABLED" || lifecycle === "RUNNING",
    );

    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      action: "external_engine.discovered",
      resource: EXECUTION_OS_ENGINE_ID,
      detail: {
        base_url: baseUrl,
        remote_engine_version: remote.manifest?.engineVersion ?? null,
        remote_contract_version: remote.manifest?.contractVersion ?? null,
        ready: remote.ready,
        local_lifecycle: lifecycle,
      } as never,
    });

    return {
      ok: true,
      engine_id: EXECUTION_OS_ENGINE_ID,
      lifecycle,
      remote,
      runtime,
      consent_required: true,
      requested_scopes: EXECUTION_OS_DESCRIPTOR.permissions.dataRequested,
    };
  });

export const getExecutionOsIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: engine, error: engineError }, { data: permissions, error: permissionError }] =
      await Promise.all([
        context.supabase
          .from("engines")
          .select(
            "engine_id, name, version, lifecycle_state, health, last_heartbeat_at, last_event_at, last_error",
          )
          .eq("user_id", context.userId)
          .eq("engine_id", EXECUTION_OS_ENGINE_ID)
          .maybeSingle(),
        context.supabase
          .from("engine_permissions")
          .select("scope, granted, reason, updated_at")
          .eq("user_id", context.userId)
          .eq("engine_id", EXECUTION_OS_ENGINE_ID),
      ]);
    if (engineError) throw new Error(engineError.message);
    if (permissionError) throw new Error(permissionError.message);

    const baseUrl = await configValue(
      context.supabase,
      context.userId,
      "base_url",
      process.env.EXECUTION_OS_BASE_URL,
    );

    let remote: Awaited<ReturnType<typeof publicExecutionOsProbe>> | null = null;
    let remoteError: string | null = null;
    if (baseUrl) {
      try {
        remote = await publicExecutionOsProbe(normalizedBaseUrl(baseUrl));
      } catch (error) {
        remoteError = error instanceof Error ? error.message : String(error);
      }
    }

    const granted = new Set(
      (permissions ?? []).filter((row) => row.granted).map((row) => row.scope),
    );
    const requested = EXECUTION_OS_DESCRIPTOR.permissions.dataRequested;

    return {
      installed: Boolean(engine),
      engine,
      base_url_configured: Boolean(baseUrl),
      remote,
      remote_error: remoteError,
      permissions: permissions ?? [],
      requested_scopes: requested,
      granted_scopes: requested.filter((scope) => granted.has(scope)),
      missing_scopes: requested.filter((scope) => !granted.has(scope)),
      integration_ready:
        Boolean(engine) &&
        (engine?.lifecycle_state === "ENABLED" ||
          engine?.lifecycle_state === "RUNNING") &&
        remote?.ready === true &&
        requested.every((scope) => granted.has(scope)),
    };
  });

export const syncExecutionOsContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (
      !(await engineIsActive(
        context.supabase,
        context.userId,
        EXECUTION_OS_ENGINE_ID,
      ))
    ) {
      throw new Error("Execution OS must be enabled before context synchronization.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: plan } = await context.supabase
      .from("daily_plans")
      .select("id, plan_date")
      .eq("user_id", context.userId)
      .eq("plan_date", today)
      .maybeSingle();

    const events: string[] = [];
    if (
      plan &&
      (await engineIsActive(context.supabase, context.userId, "daily-plan"))
    ) {
      const result = await publishAndDispatch(
        context.supabase,
        context.userId,
        {
          type: "DailyPlanChanged",
          source_engine: "daily-plan",
          payload: {
            plan_id: plan.id,
            plan_date: plan.plan_date,
            reason: "external_engine_context_sync",
          },
          idempotency_key: `execution-context-plan:${plan.id}:${Date.now()}`,
        },
      );
      if (result.event_id) events.push(result.event_id);
    }

    const { data: hsv } = await context.supabase
      .from("human_states")
      .select("as_of, coverage, confidence, source_count")
      .eq("user_id", context.userId)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hsv && (await engineIsActive(context.supabase, context.userId, "hsie"))) {
      const result = await publishAndDispatch(
        context.supabase,
        context.userId,
        {
          type: "HumanStateUpdated",
          source_engine: "hsie",
          payload: {
            as_of: hsv.as_of,
            coverage: Number(hsv.coverage ?? 0),
            confidence: hsv.confidence,
            source_count: hsv.source_count ?? 0,
          },
          idempotency_key: `execution-context-state:${hsv.as_of}:${Date.now()}`,
        },
      );
      if (result.event_id) events.push(result.event_id);
    }

    return { ok: true, events };
  });

export const getExecutionOsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const correlationId = crypto.randomUUID();
    const [schedule, discipline] = await Promise.all([
      invokeCapability(context.supabase, context.userId, {
        consumer_engine_id: "daily-plan",
        provider_engine_id: EXECUTION_OS_ENGINE_ID,
        capability: "schedule.get",
        version: EXECUTION_OS_CONTRACT_VERSION,
        input: {},
        correlation_id: correlationId,
      }),
      invokeCapability(context.supabase, context.userId, {
        consumer_engine_id: "orchestrator",
        provider_engine_id: EXECUTION_OS_ENGINE_ID,
        capability: "discipline.score.get",
        version: EXECUTION_OS_CONTRACT_VERSION,
        input: {},
        correlation_id: crypto.randomUUID(),
      }),
    ]);
    return {
      schedule: schedule.output,
      discipline: discipline.output,
    };
  });

const ActionInput = z.object({
  capability: z.enum([
    "session.start",
    "session.advance",
    "session.close",
    "fallback.trigger",
  ]),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const invokeExecutionOsAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const result = await invokeCapability(context.supabase, context.userId, {
      consumer_engine_id: "daily-plan",
      provider_engine_id: EXECUTION_OS_ENGINE_ID,
      capability: data.capability,
      version: EXECUTION_OS_CONTRACT_VERSION,
      input: data.input,
      correlation_id: crypto.randomUUID(),
    });
    return { ok: true, result: result.output };
  });
