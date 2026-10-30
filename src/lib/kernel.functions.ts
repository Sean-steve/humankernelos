import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEngineActive } from "./permissions.server";
import {
  deliver,
  publishAndDispatch,
  resolveEventHandler,
  subscriptionSeeds,
  type MeshEvent,
} from "./mesh.server";

const EventInput = z.object({
  type: z.string().min(1).max(64),
  source_engine: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
  correlation_id: z.string().uuid().optional(),
  idempotency_key: z.string().max(200).optional(),
  schema_version: z.number().int().min(1).max(99).optional(),
});

export const publishEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data, context }) => {
    const result = await publishAndDispatch(context.supabase, context.userId, {
      type: data.type,
      source_engine: data.source_engine,
      payload: data.payload,
      ...(data.correlation_id ? { correlation_id: data.correlation_id } : {}),
      ...(data.idempotency_key ? { idempotency_key: data.idempotency_key } : {}),
      ...(data.schema_version ? { schema_version: data.schema_version } : {}),
    });
    return { ok: true, ...result };
  });

const SignalInput = z.object({
  engine: z.string().min(1).max(64),
  signal_key: z.string().min(1).max(64),
  value_num: z.number().nullable().optional(),
  value_text: z.string().max(240).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  reliability: z.number().min(0).max(1).nullable().optional(),
  trend: z
    .enum(["improving", "declining", "stable", "volatile", "unknown"])
    .nullable()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const publishSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignalInput.parse(d))
  .handler(async ({ data, context }) => {
    // A disabled engine cannot publish (Spec Ch. 6 lifecycle enforcement).
    await assertEngineActive(context.supabase, context.userId, data.engine);

    const { error } = await context.supabase.from("engine_signals").insert({
      user_id: context.userId,
      engine: data.engine,
      signal_key: data.signal_key,
      value_num: data.value_num ?? null,
      value_text: data.value_text ?? null,
      confidence: data.confidence ?? null,
      reliability: data.reliability ?? null,
      trend: data.trend ?? null,
      metadata: (data.metadata ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// --- Engine Registry (Constitution Art. VI / Spec Ch. 6) --------------------

const RegisterEngineInput = z.object({
  engine_id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  version: z.string().min(1).max(32),
  purpose: z.string().max(500).optional(),
  owner: z.string().max(128).optional(),
  status: z.enum(["active", "inactive", "deprecated"]).default("active"),
  capabilities: z.array(z.string()).default([]),
  data_owned: z.array(z.string()).default([]),
  events_published: z.array(z.string()).default([]),
  events_consumed: z.array(z.string()).default([]),
  required_signals: z.array(z.string()).default([]),
  published_signals: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  permissions: z.record(z.string(), z.unknown()).default({}),
});

export const registerEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RegisterEngineInput.parse(d))
  .handler(async ({ data, context }) => {
    const { PLATFORM_VERSION, SDK_VERSION, stateIsOperational } = await import(
      "./platform-manager.server"
    );

    const { data: existing, error: existingError } = await context.supabase
      .from("engines")
      .select("lifecycle_state")
      .eq("user_id", context.userId)
      .eq("engine_id", data.engine_id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const metadata = {
      name: data.name,
      version: data.version,
      purpose: data.purpose ?? null,
      owner: data.owner ?? null,
      capabilities: data.capabilities as never,
      data_owned: data.data_owned as never,
      events_published: data.events_published as never,
      events_consumed: data.events_consumed as never,
      required_signals: data.required_signals as never,
      published_signals: data.published_signals as never,
      dependencies: data.dependencies as never,
      permissions: data.permissions as never,
      platform_version: PLATFORM_VERSION,
      sdk_version: SDK_VERSION,
    };

    if (existing) {
      const { error } = await context.supabase
        .from("engines")
        .update(metadata)
        .eq("user_id", context.userId)
        .eq("engine_id", data.engine_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("engines").insert({
        user_id: context.userId,
        engine_id: data.engine_id,
        ...metadata,
        status: "inactive",
        lifecycle_state: "REGISTERED",
        health: "disabled",
      });
      if (error) throw new Error(error.message);
    }

    // Materialise runtime-declared subscriptions, but lifecycle decides whether
    // they are enabled. Registration itself never grants execution authority.
    const seeds = subscriptionSeeds().filter((x) => x.engine_id === data.engine_id);
    if (seeds.length > 0) {
      const operational = existing
        ? stateIsOperational(existing.lifecycle_state as never)
        : false;
      const { error: subErr } = await context.supabase.from("engine_subscriptions").upsert(
        seeds.map((x) => ({
          user_id: context.userId,
          engine_id: x.engine_id,
          event_type: x.event_type,
          handler: x.handler,
          enabled: operational,
        })),
        { onConflict: "user_id,engine_id,event_type,handler" },
      );
      if (subErr) throw new Error(subErr.message);
    }

    // Built-in executable capability adapters are persisted at install time so
    // capability discovery never depends on a separate manual sync step.
    const { capabilitySeeds } = await import("./capabilities.server");
    const capabilities = capabilitySeeds().filter(
      (item) => item.provider_engine_id === data.engine_id,
    );
    if (capabilities.length > 0) {
      const { error: capabilityError } = await context.supabase
        .from("engine_capabilities")
        .upsert(
          capabilities.map((item) => ({
            ...item,
            user_id: context.userId,
          })),
          { onConflict: "user_id,provider_engine_id,capability,version" },
        );
      if (capabilityError) throw new Error(capabilityError.message);
    }

    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      action: existing ? "engine.manifest_synced" : "engine.registered",
      resource: data.engine_id,
      detail: { version: data.version, requested_status: data.status } as never,
    });

    return {
      ok: true,
      subscriptions: seeds.length,
      capabilities: capabilities.length,
      lifecycle_state: existing?.lifecycle_state ?? "REGISTERED",
    };
  });

export const listEngines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("engines")
      .select("*")
      .order("installed_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { engines: data ?? [] };
  });

const SetStatusInput = z.object({
  engine_id: z.string().min(1).max(64),
  status: z.enum(["active", "inactive", "deprecated"]),
});

export const setEngineStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { transition, uninstall, stateIsOperational } = await import(
      "./platform-manager.server"
    );
    const { data: row, error } = await context.supabase
      .from("engines")
      .select("lifecycle_state")
      .eq("user_id", context.userId)
      .eq("engine_id", data.engine_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error(`Engine "${data.engine_id}" is not installed.`);

    const state = row.lifecycle_state as
      | "DISCOVERED"
      | "INSTALLED"
      | "REGISTERED"
      | "VALIDATED"
      | "ENABLED"
      | "RUNNING"
      | "SUSPENDED"
      | "DISABLED"
      | "UNINSTALLED";

    if (data.status === "deprecated") {
      return uninstall(context.supabase, context.userId, data.engine_id);
    }

    if (data.status === "inactive") {
      if (stateIsOperational(state) || state === "SUSPENDED") {
        return transition(
          context.supabase,
          context.userId,
          data.engine_id,
          "DISABLED",
          "legacy status control mapped to lifecycle",
        );
      }
      return { engine_id: data.engine_id, state, unchanged: true };
    }

    if (state === "VALIDATED" || state === "SUSPENDED") {
      return transition(
        context.supabase,
        context.userId,
        data.engine_id,
        "ENABLED",
        "legacy status control mapped to lifecycle",
      );
    }

    if (stateIsOperational(state)) {
      return { engine_id: data.engine_id, state, unchanged: true };
    }

    throw new Error(
      `Engine "${data.engine_id}" must pass Platform Manager validation before activation.`,
    );
  });

export const getLatestSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("engine_signals")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Reduce to latest per signal_key
    const latest = new Map<string, (typeof data)[number]>();
    for (const row of data ?? []) {
      if (!latest.has(row.signal_key)) latest.set(row.signal_key, row);
    }
    return { signals: Array.from(latest.values()) };
  });

export const listRecentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hos_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

// --- Event Mesh observability & recovery (HIS-004) ------------------------

export const listEventDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: deliveries, error }, { data: subs }] = await Promise.all([
      context.supabase
        .from("hos_event_deliveries")
        .select("id, event_id, engine_id, handler, status, attempts, last_error, dead_letter, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase
        .from("engine_subscriptions")
        .select("engine_id, event_type, handler, enabled")
        .order("event_type", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    return {
      deliveries: deliveries ?? [],
      subscriptions: subs ?? [],
      declared: subscriptionSeeds(),
    };
  });

/** Re-run every dead-lettered delivery for this user. */
export const retryDeadLetters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("hos_event_deliveries")
      .select("event_id, engine_id, handler")
      .eq("dead_letter", true)
      .limit(20);
    if (error) throw new Error(error.message);

    let replayed = 0;
    for (const row of rows ?? []) {
      const { data: ev } = await supabase
        .from("hos_events")
        .select("id, type, source_engine, payload, correlation_id")
        .eq("id", row.event_id)
        .maybeSingle();
      if (!ev) continue;

      const handler = resolveEventHandler(ev.type, row.engine_id, row.handler);
      if (!handler) continue;

      const event: MeshEvent = {
        id: ev.id as string,
        type: ev.type as string,
        source_engine: ev.source_engine as string,
        payload: (ev.payload ?? {}) as Record<string, unknown>,
        correlation_id: ev.correlation_id as string,
      };
      await deliver(supabase, userId, event, handler);
      replayed += 1;
    }

    return { ok: true, replayed };
  });
