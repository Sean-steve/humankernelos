// Learning Loop helpers (Constitution Art. XII). Pure functions — no I/O.

export type OutcomeRow = {
  recommendation_id: string;
  executed: string;
  effect: Record<string, unknown> | null;
  friction: string | null;
  measured_at: string;
};

export type RecRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  created_at: string;
};

export const AXES = [
  "physical",
  "cognitive",
  "emotional",
  "behavioral",
  "lifestyle",
  "operational",
] as const;

export type Axis = (typeof AXES)[number];

const EXECUTED_WEIGHT: Record<string, number> = { yes: 1, partial: 0.5, no: 0 };

export function adherenceRate(outcomes: OutcomeRow[]): number | null {
  if (outcomes.length === 0) return null;
  const sum = outcomes.reduce(
    (acc, o) => acc + (EXECUTED_WEIGHT[o.executed] ?? 0),
    0,
  );
  return Math.round((sum / outcomes.length) * 100);
}

function effectValue(effect: Record<string, unknown> | null, axis: Axis): number | null {
  const raw = effect?.[axis];
  return typeof raw === "number" ? raw : null;
}

/** Average measured effect per axis, across all measured outcomes. */
export function axisImpact(outcomes: OutcomeRow[]): Record<Axis, number | null> {
  const out = {} as Record<Axis, number | null>;
  for (const axis of AXES) {
    const vals = outcomes
      .map((o) => effectValue(o.effect, axis))
      .filter((v): v is number => v !== null);
    out[axis] = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : null;
  }
  return out;
}

/** Adherence + average effect grouped by recommendation type. */
export function byType(recs: RecRow[], outcomes: OutcomeRow[]) {
  const index = new Map(outcomes.map((o) => [o.recommendation_id, o]));
  const groups = new Map<
    string,
    { type: string; measured: number; executed: number; effectSum: number; effectN: number }
  >();
  for (const rec of recs) {
    const o = index.get(rec.id);
    if (!o) continue;
    const g =
      groups.get(rec.type) ??
      { type: rec.type, measured: 0, executed: 0, effectSum: 0, effectN: 0 };
    g.measured += 1;
    g.executed += EXECUTED_WEIGHT[o.executed] ?? 0;
    for (const axis of AXES) {
      const v = effectValue(o.effect, axis);
      if (v !== null) {
        g.effectSum += v;
        g.effectN += 1;
      }
    }
    groups.set(rec.type, g);
  }
  return [...groups.values()].map((g) => ({
    type: g.type,
    measured: g.measured,
    adherence: Math.round((g.executed / g.measured) * 100),
    avgEffect: g.effectN ? Math.round((g.effectSum / g.effectN) * 10) / 10 : null,
  }));
}

/** Repeated friction reasons — why directives fail for this operator. */
export function topFrictions(outcomes: OutcomeRow[], limit = 5) {
  const counts = new Map<string, number>();
  for (const o of outcomes) {
    const f = (o.friction ?? "").trim().toLowerCase();
    if (!f) continue;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([friction, count]) => ({ friction, count }));
}

export type DerivedPattern = {
  label: string;
  description: string;
  axis: string | null;
  evidence_count: number;
  confidence: number;
};

/** Deterministic pattern synthesis — only claims what the data supports. */
export function derivePatterns(recs: RecRow[], outcomes: OutcomeRow[]): DerivedPattern[] {
  const patterns: DerivedPattern[] = [];

  const rate = adherenceRate(outcomes);
  if (rate !== null && outcomes.length >= 3) {
    patterns.push({
      label: rate >= 70 ? "High directive adherence" : "Adherence is the bottleneck",
      description:
        rate >= 70
          ? `You execute ${rate}% of accepted directives. Recommendations can be more ambitious.`
          : `Only ${rate}% of accepted directives get executed. Smaller, lower-friction directives will compound faster.`,
      axis: "behavioral",
      evidence_count: outcomes.length,
      confidence: Math.min(0.9, 0.4 + outcomes.length * 0.05),
    });
  }

  const impact = axisImpact(outcomes);
  for (const axis of AXES) {
    const value = impact[axis];
    const n = outcomes.filter((o) => effectValue(o.effect, axis) !== null).length;
    if (value === null || n < 3) continue;
    if (value >= 5) {
      patterns.push({
        label: `Directives reliably lift ${axis}`,
        description: `Measured outcomes move ${axis} by +${value} on average across ${n} measurements.`,
        axis,
        evidence_count: n,
        confidence: Math.min(0.9, 0.4 + n * 0.05),
      });
    } else if (value <= -5) {
      patterns.push({
        label: `${axis} pays the cost`,
        description: `Directives move ${axis} by ${value} on average across ${n} measurements — a sustainability risk.`,
        axis,
        evidence_count: n,
        confidence: Math.min(0.9, 0.4 + n * 0.05),
      });
    }
  }

  for (const t of byType(recs, outcomes)) {
    if (t.measured < 3) continue;
    if (t.adherence <= 40) {
      patterns.push({
        label: `"${t.type}" directives stall`,
        description: `Only ${t.adherence}% of ${t.type} directives get executed (${t.measured} measured).`,
        axis: null,
        evidence_count: t.measured,
        confidence: Math.min(0.85, 0.4 + t.measured * 0.05),
      });
    }
  }

  for (const f of topFrictions(outcomes, 2)) {
    if (f.count < 2) continue;
    patterns.push({
      label: "Recurring friction",
      description: `"${f.friction}" blocked execution ${f.count} times.`,
      axis: null,
      evidence_count: f.count,
      confidence: Math.min(0.8, 0.35 + f.count * 0.1),
    });
  }

  return patterns;
}

/** Compact history block injected into the PDIE prompt. */
export function outcomeHistoryPrompt(recs: RecRow[], outcomes: OutcomeRow[]): string {
  if (outcomes.length === 0) return "No measured outcomes yet — no learned history to apply.";
  const index = new Map(recs.map((r) => [r.id, r]));
  const lines = outcomes.slice(0, 12).map((o) => {
    const rec = index.get(o.recommendation_id);
    const effect = Object.entries(o.effect ?? {})
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k}${(v as number) >= 0 ? "+" : ""}${v}`)
      .join(",");
    return `- "${rec?.title ?? "unknown"}" (${rec?.type ?? "?"}) executed=${o.executed}${effect ? ` effect=${effect}` : ""}${o.friction ? ` friction=${o.friction}` : ""}`;
  });
  const rate = adherenceRate(outcomes);
  return [
    `Learned history (adherence ${rate}% over ${outcomes.length} measured directives):`,
    ...lines,
    "Favour directive shapes that were executed and measurably helped. Avoid shapes that repeatedly failed or hit the same friction.",
  ].join("\n");
}
