// Human State Intelligence Engine (HSIE)
// Computes a Human State Vector (HSV) from latest signals + check-ins.
// Constitution Art. VII/X, Architecture Ch. 10, HSIE spec Ch. 3/4/20.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScope } from "./permissions.server";
import {
  fuseSignals,
  type Axis,
  type CheckIn,
  type RawSignal,
} from "./orchestrator.server";

export type StateFamily = {
  value: number | null; // 0..100 (higher = better; stress inverted before storage)
  confidence: number | null; // 0..1
  reliability: number | null;
  trend: "improving" | "declining" | "stable" | "volatile" | "unknown" | null;
  inputs: string[]; // signal keys / sources feeding this dimension
  note?: string;
};

export type HumanStateVector = {
  as_of: string; // YYYY-MM-DD
  physical: StateFamily;
  cognitive: StateFamily;
  emotional: StateFamily;
  behavioral: StateFamily;
  lifestyle: StateFamily;
  operational: StateFamily;
  composite: number | null;
  coverage: number; // 0..1 fraction of state families with evidence
  confidence: number | null; // aggregate certainty across populated families
  source_count: number;
};

const empty = (note?: string): StateFamily => ({
  value: null,
  confidence: null,
  reliability: null,
  trend: null,
  inputs: [],
  note,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

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

    // The Orchestrator (Art. IX) owns fusion. HSIE consumes its fused axes so the
    // state vector and the advisor can never diverge from one another.
    const { fused } = fuseSignals(
      (signalsRows ?? []) as unknown as RawSignal[],
      (checkIn ?? null) as unknown as CheckIn,
    );
    const byAxis = new Map(fused.map((f) => [f.axis, f]));

    const family = (axis: Axis, emptyNote: string): StateFamily => {
      const f = byAxis.get(axis);
      if (!f || f.value === null) return empty(emptyNote);
      return {
        value: f.value,
        confidence: f.confidence,
        reliability:
          f.contributions.length > 0
            ? Math.round(
                (f.contributions.reduce((a, c) => a + c.reliability, 0) /
                  f.contributions.length) *
                  100,
              ) / 100
            : null,
        trend:
          (f.contributions.find((c) => c.trend && c.trend !== "unknown")
            ?.trend as StateFamily["trend"]) ?? "unknown",
        inputs: f.contributions.map((c) => c.source),
        note: f.contested
          ? `Contested: sources disagree by ${f.spread} points.`
          : undefined,
      };
    };

    const physical = family("physical", "Log a check-in to populate physical readiness.");
    const cognitive = family("cognitive", "Log a check-in to populate.");
    const emotional = family("emotional", "Log a check-in to populate.");
    const behavioral = family("behavioral", "Complete routines to populate.");
    const lifestyle = family("lifestyle", "Log meals + hydration to populate.");
    const operational = family("operational", "Log a check-in to populate.");

    const weighted = [physical, cognitive, emotional, behavioral, lifestyle, operational]
      .filter((f): f is StateFamily & { value: number } => f.value !== null);
    const composite = weighted.length
      ? Math.round(
          weighted.reduce((a, f) => a + f.value * (f.confidence ?? 0.5), 0) /
            weighted.reduce((a, f) => a + (f.confidence ?? 0.5), 0),
        )
      : null;
    const coverage = Math.round((weighted.length / 6) * 100) / 100;
    const confidence = weighted.length
      ? Math.round(
          (weighted.reduce((sum, family) => sum + (family.confidence ?? 0.5), 0) /
            weighted.length) *
            100,
        ) / 100
      : null;
    const source_count = weighted.reduce((sum, family) => sum + family.inputs.length, 0);

    const as_of = today();
    const row = {
      user_id: userId,
      as_of,
      physical: physical as never,
      cognitive: cognitive as never,
      emotional: emotional as never,
      behavioral: behavioral as never,
      lifestyle: lifestyle as never,
      operational: operational as never,
      composite,
      coverage,
      confidence,
      source_count,
    };

    // Upsert today's HSV
    const { error } = await supabase
      .from("human_states")
      .upsert(row, { onConflict: "user_id,as_of" });
    if (error) throw new Error(error.message);

    // Evidence is materialized separately from the HSV projection so every
    // aggregate value remains traceable to its contributing observations.
    const { error: deleteEvidenceError } = await supabase
      .from("human_state_evidence")
      .delete()
      .eq("user_id", userId)
      .eq("state_date", as_of);
    if (deleteEvidenceError) throw new Error(deleteEvidenceError.message);

    const evidenceRows = fused.flatMap((axis) =>
      axis.contributions.map((contribution) => ({
        user_id: userId,
        state_date: as_of,
        axis: axis.axis,
        source_key: contribution.source,
        source_engine: contribution.engine,
        raw_value: contribution.raw,
        normalized_value: contribution.normalized,
        confidence: contribution.confidence,
        reliability: contribution.reliability,
        recency_weight: contribution.recency,
        trend: contribution.trend,
        recorded_at: contribution.occurred_at,
      })),
    );
    if (evidenceRows.length > 0) {
      const { error: evidenceError } = await supabase
        .from("human_state_evidence")
        .insert(evidenceRows);
      if (evidenceError) throw new Error(evidenceError.message);
    }

    const hsv: HumanStateVector = {
      as_of,
      physical,
      cognitive,
      emotional,
      behavioral,
      lifestyle,
      operational,
      composite,
      coverage,
      confidence,
      source_count,
    };
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
      const emptyHSV: HumanStateVector = {
        as_of: today(),
        physical: empty("Log a check-in to populate."),
        cognitive: empty("Log a check-in to populate."),
        emotional: empty("Log a check-in to populate."),
        behavioral: empty("Complete routines to populate."),
        lifestyle: empty("Log meals + hydration to populate."),
        operational: empty("Log a check-in to populate."),
        composite: null,
        coverage: 0,
        confidence: null,
        source_count: 0,
      };
      return { hsv: emptyHSV, materialized: false };
    }
    const row = data as unknown as Record<string, unknown>;
    const hsv: HumanStateVector = {
      as_of: row.as_of as string,
      physical: row.physical as StateFamily,
      cognitive: row.cognitive as StateFamily,
      emotional: row.emotional as StateFamily,
      behavioral: row.behavioral as StateFamily,
      lifestyle: row.lifestyle as StateFamily,
      operational: row.operational as StateFamily,
      composite: (row.composite as number | null) ?? null,
      coverage: Number(row.coverage ?? 0),
      confidence: (row.confidence as number | null) ?? null,
      source_count: Number(row.source_count ?? 0),
    };
    return { hsv, materialized: true };
  });
