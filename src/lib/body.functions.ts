import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishAndDispatch } from "./mesh.server";

const BodyInput = z.object({
  kind: z.string().min(1).max(80),
  duration_min: z.number().int().min(0).max(600),
  intensity: z.number().int().min(1).max(10),
  note: z.string().max(500).optional(),
});

export const logSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BodyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("body_sessions")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        duration_min: data.duration_min,
        intensity: data.intensity,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // 7-day load = sum(duration * intensity)
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: recent } = await context.supabase
      .from("body_sessions")
      .select("duration_min,intensity")
      .gte("occurred_at", since);
    const load = (recent ?? []).reduce(
      (s, r) => s + (r.duration_min ?? 0) * (r.intensity ?? 0),
      0,
    );
    await context.supabase.from("engine_signals").insert([
      { user_id: context.userId, engine: "body", signal_key: "body.load_7d", value_num: load },
      { user_id: context.userId, engine: "body", signal_key: "body.last_session_min", value_num: data.duration_min },
    ]);

    await publishAndDispatch(context.supabase, context.userId, {
      type: "WorkoutCompleted",
      source_engine: "body",
      payload: { kind: data.kind, duration_min: data.duration_min, intensity: data.intensity },
      idempotency_key: `workout:${row.id}`,
    });

    return { session: row };
  });

export const listRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("body_sessions")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(14);
    if (error) throw new Error(error.message);
    return { sessions: data ?? [] };
  });
