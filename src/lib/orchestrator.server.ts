// Intelligence Orchestrator (Constitution Art. IX).
// Pure functions: signal fusion, conflict resolution, priority ranking. No I/O.

export const AXES = [
  "physical",
  "cognitive",
  "emotional",
  "behavioral",
  "lifestyle",
  "operational",
] as const;

export type Axis = (typeof AXES)[number];

export type RawSignal = {
  engine: string;
  signal_key: string;
  value_num: number | string | null;
  value_text?: string | null;
  confidence: number | string | null;
  reliability: number | string | null;
  trend?: string | null;
  occurred_at: string;
};

export type CheckIn = {
  energy: number;
  focus: number;
  recovery: number;
  stress: number;
  mood: number;
  sleep_hours: number | string;
  created_at: string;
} | null;

export type Contribution = {
  source: string; // signal key or check_ins.<field>
  engine: string;
  raw: number | null;
  normalized: number; // 0..100, higher = better
  weight: number; // 0..1
  confidence: number;
  reliability: number;
  recency: number; // 0..1
  trend: string;
};

export type FusedAxis = {
  axis: Axis;
  value: number | null; // 0..100
  confidence: number | null; // 0..1
  contested: boolean;
  spread: number | null; // max-min normalized spread across contributors
  contributions: Contribution[];
  note?: string;
};

export type Conflict = {
  axis: Axis;
  competing: { source: string; engine: string; normalized: number; weight: number }[];
  resolution: string;
  reason: string;
  severity: number; // 0..1
};

export type Priority = {
  key: string;
  axis: Axis;
  label: string;
  whyNow: string;
  score: number; // 0..100
  severity: number; // 0..100 — how far from acceptable
  confidence: number; // 0..1
  evidence: string[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const toNum = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Signal → axis mapping with normalization to a 0..100 "higher is better" scale. */
const SIGNAL_MAP: Record<
  string,
  { axis: Axis; normalize: (v: number) => number; baseReliability: number }
> = {
  "body.load_7d": {
    // Very high 7d load reads as physical debt, not physical strength.
    axis: "physical",
    normalize: (v) => clamp(100 - Math.abs(v - 240) / 3),
    baseReliability: 0.6,
  },
  "body.last_session_min": {
    axis: "physical",
    normalize: (v) => clamp((Math.min(v, 75) / 75) * 100),
    baseReliability: 0.5,
  },
  "routine.streak": {
    axis: "behavioral",
    normalize: (v) => clamp(v * 7),
    baseReliability: 0.7,
  },
  "routine.completed_today": {
    axis: "behavioral",
    normalize: (v) => clamp(v * 25),
    baseReliability: 0.7,
  },
  "nutrition.kcal": {
    axis: "lifestyle",
    normalize: (v) => clamp((v / 2400) * 100),
    baseReliability: 0.55,
  },
  "nutrition.protein_g": {
    axis: "lifestyle",
    normalize: (v) => clamp((v / 140) * 100),
    baseReliability: 0.55,
  },
  "nutrition.hydration_ml": {
    axis: "lifestyle",
    normalize: (v) => clamp((v / 3000) * 100),
    baseReliability: 0.6,
  },
  "learning.adherence": {
    axis: "behavioral",
    normalize: (v) => clamp(v),
    baseReliability: 0.65,
  },
};

const CHECKIN_MAP: {
  field: "energy" | "focus" | "recovery" | "stress" | "mood";
  axis: Axis;
  invert?: boolean;
}[] = [
  { field: "recovery", axis: "physical" },
  { field: "focus", axis: "cognitive" },
  { field: "stress", axis: "cognitive", invert: true },
  { field: "mood", axis: "emotional" },
  { field: "energy", axis: "operational" },
];

/** Exponential recency decay — a 36h-old signal is worth about half a fresh one. */
function recencyWeight(occurredAt: string, now: number): number {
  const age = Math.max(0, now - new Date(occurredAt).getTime());
  const hours = age / 3_600_000;
  return Math.max(0.05, Math.exp(-hours / 52));
}

function buildContributions(signals: RawSignal[], checkIn: CheckIn, now: number) {
  const byAxis = new Map<Axis, Contribution[]>();
  for (const axis of AXES) byAxis.set(axis, []);

  // Latest row per signal key wins as the engine's current claim.
  const seen = new Set<string>();
  for (const s of [...signals].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  )) {
    if (seen.has(s.signal_key)) continue;
    const spec = SIGNAL_MAP[s.signal_key];
    const raw = toNum(s.value_num);
    if (!spec || raw === null) continue;
    seen.add(s.signal_key);

    const confidence = toNum(s.confidence) ?? 0.5;
    const reliability = toNum(s.reliability) ?? spec.baseReliability;
    const recency = recencyWeight(s.occurred_at, now);
    byAxis.get(spec.axis)!.push({
      source: s.signal_key,
      engine: s.engine,
      raw,
      normalized: Math.round(spec.normalize(raw)),
      weight: Math.round(confidence * reliability * recency * 1000) / 1000,
      confidence,
      reliability,
      recency: Math.round(recency * 100) / 100,
      trend: s.trend ?? "unknown",
    });
  }

  if (checkIn) {
    const recency = recencyWeight(checkIn.created_at, now);
    for (const { field, axis, invert } of CHECKIN_MAP) {
      const raw = toNum(checkIn[field]);
      if (raw === null) continue;
      const normalized = Math.round(clamp(invert ? 100 - raw : raw));
      byAxis.get(axis)!.push({
        source: `check_ins.${field}`,
        engine: "kernel",
        raw,
        normalized,
        // Self-report is the most direct read of state, so it carries high reliability.
        weight: Math.round(0.8 * 0.85 * recency * 1000) / 1000,
        confidence: 0.8,
        reliability: 0.85,
        recency: Math.round(recency * 100) / 100,
        trend: "unknown",
      });
    }

    const sleep = toNum(checkIn.sleep_hours);
    if (sleep !== null) {
      const recencySleep = recencyWeight(checkIn.created_at, now);
      byAxis.get("lifestyle")!.push({
        source: "check_ins.sleep_hours",
        engine: "kernel",
        raw: sleep,
        normalized: Math.round(clamp(100 - Math.abs(sleep - 7.5) * 18)),
        weight: Math.round(0.8 * 0.8 * recencySleep * 1000) / 1000,
        confidence: 0.8,
        reliability: 0.8,
        recency: Math.round(recencySleep * 100) / 100,
        trend: "unknown",
      });
    }
  }

  return byAxis;
}

const CONTESTED_SPREAD = 25;

/** Weighted fusion of every contribution per axis, plus conflict detection. */
export function fuseSignals(signals: RawSignal[], checkIn: CheckIn, nowMs = Date.now()) {
  const byAxis = buildContributions(signals, checkIn, nowMs);
  const fused: FusedAxis[] = [];
  const conflicts: Conflict[] = [];

  for (const axis of AXES) {
    const contributions = (byAxis.get(axis) ?? []).sort((a, b) => b.weight - a.weight);
    if (contributions.length === 0) {
      fused.push({
        axis,
        value: null,
        confidence: null,
        contested: false,
        spread: null,
        contributions: [],
        note: "No engine is reporting on this axis yet.",
      });
      continue;
    }

    const totalWeight = contributions.reduce((a, c) => a + c.weight, 0);
    const value =
      totalWeight > 0
        ? Math.round(
            contributions.reduce((a, c) => a + c.normalized * c.weight, 0) / totalWeight,
          )
        : Math.round(
            contributions.reduce((a, c) => a + c.normalized, 0) / contributions.length,
          );

    const values = contributions.map((c) => c.normalized);
    const spread = Math.max(...values) - Math.min(...values);
    const contested = contributions.length > 1 && spread >= CONTESTED_SPREAD;

    // Confidence drops when sources disagree; it rises with corroboration.
    const meanConfidence =
      contributions.reduce((a, c) => a + c.confidence * c.recency, 0) / contributions.length;
    const corroboration = Math.min(1, 0.7 + (contributions.length - 1) * 0.1);
    const penalty = contested ? 1 - Math.min(0.4, (spread - CONTESTED_SPREAD) / 100) : 1;
    const confidence = Math.round(meanConfidence * corroboration * penalty * 100) / 100;

    if (contested) {
      const highest = contributions[0]!;
      const lowestNormalized = [...contributions].sort((a, b) => a.normalized - b.normalized)[0]!;
      const outlier =
        highest.source === lowestNormalized.source
          ? contributions[contributions.length - 1]!
          : lowestNormalized;
      conflicts.push({
        axis,
        competing: contributions.map((c) => ({
          source: c.source,
          engine: c.engine,
          normalized: c.normalized,
          weight: c.weight,
        })),
        resolution: `Weighted toward ${highest.source} (${highest.normalized}) — fused ${axis} = ${value}.`,
        reason:
          `${highest.source} carries the higher weight (${highest.weight}) from confidence ${highest.confidence} × reliability ${highest.reliability} × recency ${highest.recency}, ` +
          `while ${outlier.source} reports ${outlier.normalized}. Spread of ${spread} points marks this axis contested rather than settled.`,
        severity: Math.round(Math.min(1, spread / 100) * 100) / 100,
      });
    }

    fused.push({ axis, value, confidence, contested, spread, contributions });
  }

  return { fused, conflicts };
}

type PriorityRule = {
  key: string;
  axis: Axis;
  label: string;
  /** Threshold below which the axis is a live concern. */
  threshold: number;
  whyNow: (value: number) => string;
};

const RULES: PriorityRule[] = [
  {
    key: "recovery_debt",
    axis: "physical",
    label: "Repay recovery debt before adding load",
    threshold: 60,
    whyNow: (v) => `Fused physical readiness is ${v}. Training on top of this converts effort into damage.`,
  },
  {
    key: "cognitive_load",
    axis: "cognitive",
    label: "Protect one block of undisturbed focus",
    threshold: 60,
    whyNow: (v) => `Fused cognitive capacity is ${v}. Shallow work will consume the whole day unless one block is defended.`,
  },
  {
    key: "emotional_load",
    axis: "emotional",
    label: "Discharge emotional load before deciding",
    threshold: 55,
    whyNow: (v) => `Emotional state reads ${v}. Decisions made here get re-made later.`,
  },
  {
    key: "adherence_risk",
    axis: "behavioral",
    label: "Restore the smallest version of the routine",
    threshold: 55,
    whyNow: (v) => `Behavioral adherence is ${v}. Streak risk compounds faster than any single session.`,
  },
  {
    key: "fuel_gap",
    axis: "lifestyle",
    label: "Close the fuel and hydration gap",
    threshold: 60,
    whyNow: (v) => `Lifestyle inputs read ${v} — fuel, water or sleep is under target and every other axis pays for it.`,
  },
  {
    key: "capacity_drop",
    axis: "operational",
    label: "Downshift the day's commitments",
    threshold: 55,
    whyNow: (v) => `Operational capacity is ${v}. Committing at full scope guarantees a broken standard.`,
  },
];

/** Ranked list of what actually matters right now, most urgent first. */
export function rankPriorities(fused: FusedAxis[]): Priority[] {
  const index = new Map(fused.map((f) => [f.axis, f]));
  const out: Priority[] = [];

  for (const rule of RULES) {
    const axis = index.get(rule.axis);
    if (!axis || axis.value === null) continue;
    if (axis.value >= rule.threshold) continue;

    const severity = Math.round(((rule.threshold - axis.value) / rule.threshold) * 100);
    const confidence = axis.confidence ?? 0.4;
    const evidence = axis.contributions
      .slice(0, 3)
      .map((c) => `${c.source}=${c.raw ?? "?"} → ${c.normalized}/100 (w=${c.weight})`);

    out.push({
      key: rule.key,
      axis: rule.axis,
      label: rule.label,
      whyNow:
        rule.whyNow(axis.value) +
        (axis.contested ? " This axis is contested, so treat the ranking as provisional." : ""),
      score: Math.round(severity * (0.55 + confidence * 0.45)),
      severity,
      confidence,
      evidence,
    });
  }

  // Nothing is failing: rank the weakest axis as an optimization target instead.
  if (out.length === 0) {
    const scored = fused.filter((f) => f.value !== null).sort((a, b) => a.value! - b.value!);
    const weakest = scored[0];
    if (weakest) {
      out.push({
        key: "optimize_weakest",
        axis: weakest.axis,
        label: `Extend the margin on ${weakest.axis}`,
        whyNow: `Nothing is failing. ${weakest.axis} at ${weakest.value} is the thinnest margin, so it is where an extra unit of effort compounds.`,
        score: Math.max(10, 100 - weakest.value!),
        severity: Math.max(0, 100 - weakest.value!),
        confidence: weakest.confidence ?? 0.4,
        evidence: weakest.contributions
          .slice(0, 3)
          .map((c) => `${c.source} → ${c.normalized}/100`),
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Compact orchestrator block injected into the PDIE prompt. */
export function orchestratorPrompt(
  fused: FusedAxis[],
  conflicts: Conflict[],
  priorities: Priority[],
): string {
  const axisLine = fused
    .map((f) => `${f.axis}=${f.value ?? "null"}(c=${f.confidence ?? "?"}${f.contested ? ",contested" : ""})`)
    .join(", ");

  const priorityLines = priorities.length
    ? priorities
        .slice(0, 4)
        .map((p, i) => `${i + 1}. [${p.axis}] ${p.label} — ${p.whyNow} (score ${p.score})`)
        .join("\n")
    : "No ranked priorities — insufficient data.";

  const conflictLines = conflicts.length
    ? conflicts.map((c) => `- ${c.axis}: ${c.resolution} ${c.reason}`).join("\n")
    : "No unresolved conflicts between engines.";

  return [
    "Orchestrator fused state (Art. IX — already weighted by confidence, reliability and recency; do not re-derive from raw signals):",
    axisLine,
    "Ranked priorities, most important first. Address the top one unless a personal policy forbids it:",
    priorityLines,
    "Resolved signal conflicts:",
    conflictLines,
  ].join("\n");
}
