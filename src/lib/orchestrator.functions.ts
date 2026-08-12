// Intelligence Orchestrator server functions (Constitution Art. IX).
// Thin wrappers only — all logic lives in ./orchestrator.server.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fuseSignals,
  rankPriorities,
  type CheckIn,
  type Conflict,
  type FusedAxis,
  type Priority,
  type RawSignal,
} from "./orchestrator.server";

export type { FusedAxis, Conflict, Priority, Axis, Contribution } from "./orchestrator.server";

export const runOrchestrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: signals }, { data: checkIn }] = await Promise.all([
      supabase
        .from("engine_signals")
        .select(
          "engine, signal_key, value_num, value_text, confidence, reliability, trend, occurred_at",
        )
        .order("occurred_at", { ascending: false })
        .limit(300),
      supabase
        .from("check_ins")
        .select("energy, focus, recovery, stress, mood, sleep_hours, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { fused, conflicts } = fuseSignals(
      (signals ?? []) as unknown as RawSignal[],
      (checkIn ?? null) as unknown as CheckIn,
    );
    const priorities = rankPriorities(fused);

    const { data: run, error } = await supabase
      .from("orchestrator_runs")
      .insert({
        user_id: userId,
        fused_axes: fused as never,
        conflicts: conflicts as never,
        priorities: priorities as never,
        signal_count: (signals ?? []).length,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (conflicts.length > 0) {
      const { error: conflictErr } = await supabase.from("signal_conflicts").insert(
        conflicts.map((c) => ({
          user_id: userId,
          run_id: run.id,
          axis: c.axis,
          competing: c.competing as never,
          resolution: c.resolution,
          reason: c.reason,
          severity: c.severity,
        })),
      );
      if (conflictErr) throw new Error(conflictErr.message);
    }

    return {
      run_id: run.id as string,
      generated_at: run.generated_at as string,
      signal_count: (signals ?? []).length,
      fused,
      conflicts,
      priorities,
    };
  });

export const getLatestOrchestratorRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orchestrator_runs")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { run: null };
    return {
      run: {
        run_id: data.id as string,
        generated_at: data.generated_at as string,
        signal_count: data.signal_count as number,
        fused: data.fused_axes as unknown as FusedAxis[],
        conflicts: data.conflicts as unknown as Conflict[],
        priorities: data.priorities as unknown as Priority[],
      },
    };
  });

export const listSignalConflicts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("signal_conflicts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { conflicts: data ?? [] };
  });
