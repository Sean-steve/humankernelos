import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventInput = z.object({
  type: z.string().min(1).max(64),
  source_engine: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const publishEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hos_events").insert({
      user_id: context.userId,
      type: data.type,
      source_engine: data.source_engine,
      payload: data.payload as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SignalInput = z.object({
  engine: z.string().min(1).max(64),
  signal_key: z.string().min(1).max(64),
  value_num: z.number().nullable().optional(),
  value_text: z.string().max(240).nullable().optional(),
});

export const publishSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("engine_signals").insert({
      user_id: context.userId,
      engine: data.engine,
      signal_key: data.signal_key,
      value_num: data.value_num ?? null,
      value_text: data.value_text ?? null,
    });
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
