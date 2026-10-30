import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LifecycleState } from "./platform-manager.server";


const LifecycleStateEnum = z.enum([
  "DISCOVERED",
  "INSTALLED",
  "REGISTERED",
  "VALIDATED",
  "ENABLED",
  "RUNNING",
  "SUSPENDED",
  "DISABLED",
  "UNINSTALLED",
]);

export const getPlatformStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { PLATFORM_VERSION, SDK_VERSION, deriveHealth, TRANSITIONS } = await import(
      "./platform-manager.server"
    );


    const [{ data: engines }, { data: health }] = await Promise.all([
      context.supabase
        .from("engines")
        .select(
          "engine_id, name, version, status, lifecycle_state, platform_version, sdk_version, last_heartbeat_at, last_event_at, last_error, error_count, health",
        )
        .order("engine_id", { ascending: true }),
      context.supabase
        .from("engine_health_events")
        .select("engine_id, health, note, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      platform_version: PLATFORM_VERSION,
      sdk_version: SDK_VERSION,
      transitions: TRANSITIONS,
      engines: (engines ?? []).map((e) => ({
        ...e,
        derived_health: deriveHealth({
          lifecycle_state: e.lifecycle_state as LifecycleState,
          last_heartbeat_at: e.last_heartbeat_at,
          error_count: e.error_count ?? 0,
          last_error: e.last_error,
        }),
        allowed: TRANSITIONS[e.lifecycle_state as LifecycleState] ?? [],
      })),
      health_events: health ?? [],
    };
  });

export const transitionEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        engine_id: z.string().min(1).max(64),
        to: LifecycleStateEnum,
        note: z.string().max(240).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { transition, uninstall } = await import("./platform-manager.server");
    if (data.to === "UNINSTALLED") {
      return await uninstall(context.supabase, context.userId, data.engine_id);
    }
    return await transition(
      context.supabase,
      context.userId,
      data.engine_id,
      data.to,
      data.note,
    );
  });

export const validateEngineInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ engine_id: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveDependencies, transition } = await import("./platform-manager.server");
    const { validateEngineManifest } = await import("./engines/manifest");

    const { data: row, error: rowError } = await context.supabase
      .from("engines")
      .select(
        "engine_id, name, version, purpose, owner, status, lifecycle_state, capabilities, data_owned, events_published, events_consumed, required_signals, published_signals, dependencies, permissions",
      )
      .eq("user_id", context.userId)
      .eq("engine_id", data.engine_id)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row) throw new Error(`Engine "${data.engine_id}" is not registered.`);

    const descriptor = validateEngineManifest({
      id: row.engine_id,
      name: row.name,
      version: row.version,
      purpose: row.purpose ?? "No purpose declared",
      owner: row.owner ?? "Unknown owner",
      status: row.status,
      capabilities: row.capabilities ?? [],
      dataOwned: row.data_owned ?? [],
      eventsPublished: row.events_published ?? [],
      eventsConsumed: row.events_consumed ?? [],
      requiredSignals: row.required_signals ?? [],
      publishedSignals: row.published_signals ?? [],
      dependencies: row.dependencies ?? [],
      permissions: row.permissions ?? {
        dataRequested: [],
        dataProvided: [],
        dataProhibited: [],
      },
    });

    const { data: installed, error: installedError } = await context.supabase
      .from("engines")
      .select("engine_id")
      .eq("user_id", context.userId)
      .neq("lifecycle_state", "UNINSTALLED");
    if (installedError) throw new Error(installedError.message);

    const result = resolveDependencies(
      descriptor,
      (installed ?? []).map((item) => item.engine_id),
    );

    if (!result.ok) {
      await context.supabase.from("audit_log").insert({
        user_id: context.userId,
        action: "engine.validation_failed",
        resource: data.engine_id,
        detail: { reasons: result.reasons } as never,
      });
      return { ok: false as const, reasons: result.reasons };
    }

    if (row.lifecycle_state === "REGISTERED") {
      await transition(
        context.supabase,
        context.userId,
        data.engine_id,
        "VALIDATED",
        "manifest and dependencies validated",
      );
    }

    return { ok: true as const, reasons: [] as string[] };
  });

export const getEngineConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("engine_config")
      .select("engine_id, key, value, is_secret_ref, updated_at")
      .order("engine_id", { ascending: true });
    if (error) throw new Error(error.message);
    // Secret references are never resolved to plaintext here.
    return {
      config: (data ?? []).map((r) => ({
        ...r,
        value: r.is_secret_ref ? `secret:${r.value}` : r.value,
      })),
    };
  });

export const setEngineConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        engine_id: z.string().min(1).max(64),
        key: z.string().min(1).max(64),
        value: z.string().max(500).nullable(),
        is_secret_ref: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("engine_config").upsert(
      {
        user_id: context.userId,
        engine_id: data.engine_id,
        key: data.key,
        value: data.value,
        is_secret_ref: data.is_secret_ref,
      },
      { onConflict: "user_id,engine_id,key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
