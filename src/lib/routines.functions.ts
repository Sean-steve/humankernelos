import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishAndDispatch } from "./mesh.server";

const CompletionInput = z.object({
  routine_key: z.string().min(1).max(120),
});

export const completeRoutine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompletionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("routine_completions").insert({
      user_id: context.userId,
      routine_key: data.routine_key,
    });
    if (error) throw new Error(error.message);

    // Streak: consecutive days with any completion, up to 60 days back
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("routine_completions")
      .select("completed_at")
      .gte("completed_at", since)
      .order("completed_at", { ascending: false });
    const days = new Set(
      (rows ?? []).map((r) => new Date(r.completed_at).toDateString()),
    );
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Today completions count
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayCount = (rows ?? []).filter(
      (r) => new Date(r.completed_at) >= start,
    ).length;

    await context.supabase.from("engine_signals").insert([
      { user_id: context.userId, engine: "routine", signal_key: "routine.streak", value_num: streak },
      { user_id: context.userId, engine: "routine", signal_key: "routine.completed_today", value_num: todayCount },
    ]);

    await publishAndDispatch(context.supabase, context.userId, {
      type: "RoutineCompleted",
      source_engine: "routine",
      payload: { routine_key: data.routine_key, streak, completed_today: todayCount },
    });

    return { ok: true, streak, todayCount };
  });

export const listTodayRoutines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await context.supabase
      .from("routine_completions")
      .select("*")
      .gte("completed_at", start.toISOString());
    if (error) throw new Error(error.message);
    return { completed: data ?? [] };
  });
