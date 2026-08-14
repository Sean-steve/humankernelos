// Intelligence Orchestrator server functions (Constitution Art. IX).
// Thin wrappers only — all logic lives in ./orchestrator.server.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScope } from "./permissions.server";
import { runAndPersistOrchestrator } from "./mesh.server";
import type { Conflict, FusedAxis, Priority } from "./orchestrator.server";

export type { FusedAxis, Conflict, Priority, Axis, Contribution } from "./orchestrator.server";

export const runOrchestrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertScope(supabase, userId, "orchestrator", "engine_signals");
    return runAndPersistOrchestrator(supabase, userId);
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
