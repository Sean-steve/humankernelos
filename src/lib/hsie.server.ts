import type { Db } from "./permissions.server";
import type { Axis, FusedAxis } from "./orchestrator.server";

export type StateFamily = {
  value: number | null;
  confidence: number | null;
  reliability: number | null;
  trend: "improving" | "declining" | "stable" | "volatile" | "unknown" | null;
  inputs: string[];
  note?: string;
};

export type HumanStateVector = {
  as_of: string;
  physical: StateFamily;
  cognitive: StateFamily;
  emotional: StateFamily;
  behavioral: StateFamily;
  lifestyle: StateFamily;
  operational: StateFamily;
  composite: number | null;
  coverage: number;
  confidence: number | null;
  source_count: number;
};

export function emptyStateFamily(note?: string): StateFamily {
  return {
    value: null,
    confidence: null,
    reliability: null,
    trend: null,
    inputs: [],
    note,
  };
}

export function emptyHumanState(asOf = new Date().toISOString().slice(0, 10)): HumanStateVector {
  return {
    as_of: asOf,
    physical: emptyStateFamily("Log a check-in to populate physical readiness."),
    cognitive: emptyStateFamily("Log a check-in to populate cognitive readiness."),
    emotional: emptyStateFamily("Log a check-in to populate emotional state."),
    behavioral: emptyStateFamily("Behavioral evidence has not been reported yet."),
    lifestyle: emptyStateFamily("Lifestyle evidence has not been reported yet."),
    operational: emptyStateFamily("Log a check-in to populate operational capacity."),
    composite: null,
    coverage: 0,
    confidence: null,
    source_count: 0,
  };
}

function familyFromFusion(
  fused: FusedAxis[],
  axis: Axis,
  emptyNote: string,
): StateFamily {
  const state = fused.find((item) => item.axis === axis);
  if (!state || state.value === null) return emptyStateFamily(emptyNote);

  const reliability =
    state.contributions.length > 0
      ? Math.round(
          (state.contributions.reduce((sum, contribution) => sum + contribution.reliability, 0) /
            state.contributions.length) *
            100,
        ) / 100
      : null;

  return {
    value: state.value,
    confidence: state.confidence,
    reliability,
    trend:
      (state.contributions.find(
        (contribution) => contribution.trend && contribution.trend !== "unknown",
      )?.trend as StateFamily["trend"]) ?? "unknown",
    inputs: state.contributions.map((contribution) => contribution.source),
    note: state.contested
      ? `Contested: sources disagree by ${state.spread} points.`
      : state.note,
  };
}

export function projectHumanState(
  fused: FusedAxis[],
  asOf = new Date().toISOString().slice(0, 10),
): HumanStateVector {
  const physical = familyFromFusion(
    fused,
    "physical",
    "Log a check-in to populate physical readiness.",
  );
  const cognitive = familyFromFusion(
    fused,
    "cognitive",
    "Log a check-in to populate cognitive readiness.",
  );
  const emotional = familyFromFusion(
    fused,
    "emotional",
    "Log a check-in to populate emotional state.",
  );
  const behavioral = familyFromFusion(
    fused,
    "behavioral",
    "Behavioral evidence has not been reported yet.",
  );
  const lifestyle = familyFromFusion(
    fused,
    "lifestyle",
    "Lifestyle evidence has not been reported yet.",
  );
  const operational = familyFromFusion(
    fused,
    "operational",
    "Log a check-in to populate operational capacity.",
  );

  const families = [
    physical,
    cognitive,
    emotional,
    behavioral,
    lifestyle,
    operational,
  ];
  const populated = families.filter(
    (family): family is StateFamily & { value: number } => family.value !== null,
  );

  const composite =
    populated.length > 0
      ? Math.round(
          populated.reduce(
            (sum, family) => sum + family.value * (family.confidence ?? 0.5),
            0,
          ) /
            populated.reduce(
              (sum, family) => sum + (family.confidence ?? 0.5),
              0,
            ),
        )
      : null;

  const coverage = Math.round((populated.length / families.length) * 100) / 100;
  const confidence =
    populated.length > 0
      ? Math.round(
          (populated.reduce(
            (sum, family) => sum + (family.confidence ?? 0.5),
            0,
          ) /
            populated.length) *
            100,
        ) / 100
      : null;
  const source_count = populated.reduce(
    (sum, family) => sum + family.inputs.length,
    0,
  );

  return {
    as_of: asOf,
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
}

export async function materializeHumanState(
  db: Db,
  userId: string,
  fused: FusedAxis[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  const hsv = projectHumanState(fused, asOf);

  const { error } = await db.from("human_states").upsert(
    {
      user_id: userId,
      as_of: hsv.as_of,
      physical: hsv.physical as never,
      cognitive: hsv.cognitive as never,
      emotional: hsv.emotional as never,
      behavioral: hsv.behavioral as never,
      lifestyle: hsv.lifestyle as never,
      operational: hsv.operational as never,
      composite: hsv.composite,
      coverage: hsv.coverage,
      confidence: hsv.confidence,
      source_count: hsv.source_count,
    },
    { onConflict: "user_id,as_of" },
  );
  if (error) throw new Error(error.message);

  const { error: deleteError } = await db
    .from("human_state_evidence")
    .delete()
    .eq("user_id", userId)
    .eq("state_date", asOf);
  if (deleteError) throw new Error(deleteError.message);

  const evidence = fused.flatMap((axis) =>
    axis.contributions.map((contribution) => ({
      user_id: userId,
      state_date: asOf,
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

  if (evidence.length > 0) {
    const { error: evidenceError } = await db
      .from("human_state_evidence")
      .insert(evidence);
    if (evidenceError) throw new Error(evidenceError.message);
  }

  return hsv;
}
