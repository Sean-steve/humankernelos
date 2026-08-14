import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEngineActive } from "./permissions.server";
import {
  EVENT_HANDLERS,
  deliver,
  publishAndDispatch,
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
    const { error } = await context.supabase
      .from("engines")
      .upsert(
        {
          user_id: context.userId,
          engine_id: data.engine_id,
          name: data.name,
          version: data.version,
          purpose: data.purpose ?? null,
          owner: data.owner ?? null,
          status: data.status,
          capabilities: data.capabilities as never,
          data_owned: data.data_owned as never,
          events_published: data.events_published as never,
          events_consumed: data.events_consumed as never,
          required_signals: data.required_signals as never,
          published_signals: data.published_signals as never,
          dependencies: data.dependencies as never,
          permissions: data.permissions as never,
        },
        { onConflict: "user_id,engine_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { error } = await context.supabase
      .from("engines")
      .update({ status: data.status })
      .eq("user_id", context.userId)
      .eq("engine_id", data.engine_id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
