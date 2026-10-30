// Human State Intelligence Engine (HSIE) server functions.
// Fusion is shared with the Orchestrator; materialization lives in hsie.server
// so manual recomputation and event-driven recomputation cannot diverge.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScope } from "./permissions.server";
import {
  fuseSignals,
  type CheckIn,
  type RawSignal,
} from "./orchestrator.server";
import {
  emptyHumanState,
  materializeHumanState,
  type HumanStateVector,
  type StateFamily,
} from "./hsie.server";

export type { HumanStateVector, StateFamily } from "./hsie.server";

export const computeHumanStateVector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertScope(supabase, userId, "hsie", "check_ins");

    const [{ data: checkIn }, { data: signalsRows }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("energy, focus, recovery, stress, mood, sleep_hours, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("engine_signals")
        .select(
          "engine, signal_key, value_num, value_text, confidence, reliability, trend, occurred_at",
        )
        .order("occurred_at", { ascending: false })
        .limit(300),
    ]);

    const { fused } = fuseSignals(
      (signalsRows ?? []) as unknown as RawSignal[],
      (checkIn ?? null) as unknown as CheckIn,
    );

    const hsv = await materializeHumanState(supabase, userId, fused);
    return { hsv };
  });

export const getLatestHSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("human_states")
      .select("*")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      return {
        hsv: emptyHumanState(),
        materialized: false,
      };
    }

    const hsv: HumanStateVector = {
      as_of: data.as_of,
      physical: data.physical as unknown as StateFamily,
      cognitive: data.cognitive as unknown as StateFamily,
      emotional: data.emotional as unknown as StateFamily,
      behavioral: data.behavioral as unknown as StateFamily,
      lifestyle: data.lifestyle as unknown as StateFamily,
      operational: data.operational as unknown as StateFamily,
      composite: data.composite,
      coverage: Number(data.coverage ?? 0),
      confidence: data.confidence,
      source_count: data.source_count ?? 0,
    };

    return { hsv, materialized: true };
  });

export const getHumanStateEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: state, error: stateError } = await context.supabase
      .from("human_states")
      .select("as_of")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stateError) throw new Error(stateError.message);
    if (!state) return { as_of: null, evidence: [] };

    const { data, error } = await context.supabase
      .from("human_state_evidence")
      .select("*")
      .eq("state_date", state.as_of)
      .order("axis", { ascending: true })
      .order("recorded_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { as_of: state.as_of, evidence: data ?? [] };
  });
