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
    const { resolveDependencies } = await import("./platform-manager.server");
    const { REGISTERED_ENGINES } = await import("./engines/contract");

    const descriptor = REGISTERED_ENGINES.find((e) => e.id === data.engine_id);
    if (!descriptor) throw new Error(`Unknown engine "${data.engine_id}".`);

    const { data: installed } = await context.supabase
      .from("engines")
      .select("engine_id")
      .eq("user_id", context.userId);

    const result = resolveDependencies(
      descriptor,
      (installed ?? []).map((r) => r.engine_id),
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
