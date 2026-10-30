import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAndPersistOrchestrator } from "./mesh.server";
import { refreshLearningMemory } from "./learning-memory.server";
import { materializeDailyPlanContext } from "./daily-plan.server";

/**
 * Deterministic Personal Kernel refresh.
 *
 * Observe  -> persisted check-ins + engine signals
 * Understand -> Orchestrator fusion + canonical HSV
 * Learn -> measured outcomes -> patterns -> durable memory
 * Adapt context -> refresh today's Daily Operating Plan context
 *
 * This does not generate new recommendations or schedule items. AI remains
 * advisory and requires an explicit PDIE request + human decision.
 */
export const refreshPersonalKernel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const orchestration = await runAndPersistOrchestrator(supabase, userId);
    const learning = await refreshLearningMemory(supabase, userId);

    const planDate = new Date().toISOString().slice(0, 10);
    const plan = await materializeDailyPlanContext(
      supabase,
      userId,
      planDate,
    );

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "kernel.refreshed",
      resource: planDate,
      detail: {
        run_id: orchestration.run_id,
        signal_count: orchestration.signal_count,
        conflicts: orchestration.conflicts.length,
        learned_patterns: learning.pattern_count,
        durable_memories: learning.memory_count,
        plan_id: plan.id,
      } as never,
    });

    return {
      refreshed_at: new Date().toISOString(),
      human_state: {
        fused: orchestration.fused,
        conflicts: orchestration.conflicts,
        priorities: orchestration.priorities,
      },
      learning: {
        patterns: learning.pattern_count,
        memories: learning.memory_count,
      },
      daily_plan: {
        id: plan.id,
        date: plan.plan_date,
        status: plan.status,
      },
    };
  });
