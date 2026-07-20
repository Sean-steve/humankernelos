// Human State Intelligence Engine (HSIE)
// Computes a Human State Vector (HSV) from latest signals + check-ins.
// Constitution Art. VII/X, Architecture Ch. 10, HSIE spec Ch. 3/4/20.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const [{ data: checkIn }, { data: signalsRows }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("engine_signals")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(200),
    ]);

    // reduce to latest per signal_key
    const latest = new Map<string, (typeof signalsRows extends (infer T)[] | null ? T : never)>();
    for (const row of signalsRows ?? []) {
      if (!latest.has(row.signal_key)) latest.set(row.signal_key, row);
    }
    const sig = (k: string) => latest.get(k);
    const num = (k: string): number | null => {
      const r = sig(k);
      return r && r.value_num !== null ? Number(r.value_num) : null;
    };

    // --- Physical: body load + recovery ---
    const load7d = num("body.load_7d");
    const recovery = checkIn?.recovery ?? null;
    const physicalValue =
      recovery !== null
        ? Math.round(
            recovery * 0.7 +
              (load7d !== null ? Math.min(100, load7d / 3) * 0.3 : recovery * 0.3),
          )
        : null;

    const physical: StateFamily = {
      value: physicalValue,
      confidence: recovery !== null ? 0.7 : 0.2,
      reliability: recovery !== null ? 0.75 : 0.3,
      trend: "unknown",
      inputs: ["check_ins.recovery", "body.load_7d"],
      note:
        physicalValue === null
          ? "Log a check-in to populate physical readiness."
          : undefined,
    };

    // --- Cognitive: focus - stress penalty ---
    const focus = checkIn?.focus ?? null;
    const stress = checkIn?.stress ?? null;
    const cognitiveValue =
      focus !== null && stress !== null
        ? Math.round(Math.max(0, Math.min(100, focus - stress * 0.4)))
        : focus;
    const cognitive: StateFamily = {
      value: cognitiveValue,
      confidence: focus !== null ? 0.7 : 0.2,
      reliability: focus !== null ? 0.7 : 0.3,
      trend: "unknown",
      inputs: ["check_ins.focus", "check_ins.stress"],
    };

    // --- Emotional: mood + inverse stress ---
    const mood = checkIn?.mood ?? null;
    const emotionalValue =
      mood !== null && stress !== null
        ? Math.round(mood * 0.7 + (100 - stress) * 0.3)
        : mood;
    const emotional: StateFamily = {
      value: emotionalValue,
      confidence: mood !== null ? 0.65 : 0.15,
      reliability: mood !== null ? 0.65 : 0.25,
      trend: "unknown",
      inputs: ["check_ins.mood", "check_ins.stress"],
    };

    // --- Behavioral: routine adherence ---
    const streak = num("routine.streak");
    const completedToday = num("routine.completed_today");
    const behavioralValue =
      streak !== null || completedToday !== null
        ? Math.round(
            Math.min(100, (streak ?? 0) * 5) * 0.5 +
              (completedToday !== null ? Math.min(100, completedToday * 25) : 0) *
                0.5,
          )
        : null;
    const behavioral: StateFamily = {
      value: behavioralValue,
      confidence: behavioralValue !== null ? 0.6 : 0.15,
      reliability: behavioralValue !== null ? 0.6 : 0.25,
      trend: "unknown",
      inputs: ["routine.streak", "routine.completed_today"],
    };

    // --- Lifestyle: nutrition & hydration ---
    const kcal = num("nutrition.kcal");
    const protein = num("nutrition.protein_g");
    const hydration = num("nutrition.hydration_ml");
    const lifestyleParts: number[] = [];
    if (kcal !== null) lifestyleParts.push(Math.min(100, (kcal / 2400) * 100));
    if (protein !== null)
      lifestyleParts.push(Math.min(100, (protein / 140) * 100));
    if (hydration !== null)
      lifestyleParts.push(Math.min(100, (hydration / 3000) * 100));
    const lifestyleValue = lifestyleParts.length
      ? Math.round(lifestyleParts.reduce((a, b) => a + b, 0) / lifestyleParts.length)
      : null;
    const lifestyle: StateFamily = {
      value: lifestyleValue,
      confidence: lifestyleParts.length ? 0.55 : 0.1,
      reliability: lifestyleParts.length ? 0.6 : 0.2,
      trend: "unknown",
      inputs: ["nutrition.kcal", "nutrition.protein_g", "nutrition.hydration_ml"],
    };

    // --- Operational: energy - stress ---
    const energy = checkIn?.energy ?? null;
    const operationalValue =
      energy !== null && stress !== null
        ? Math.round(Math.max(0, Math.min(100, energy - stress * 0.3)))
        : energy;
    const operational: StateFamily = {
      value: operationalValue,
      confidence: energy !== null ? 0.75 : 0.2,
      reliability: energy !== null ? 0.75 : 0.3,
      trend: "unknown",
      inputs: ["check_ins.energy", "check_ins.stress"],
    };

    const values = [
      physical.value,
      cognitive.value,
      emotional.value,
      behavioral.value,
      lifestyle.value,
      operational.value,
    ].filter((v): v is number => v !== null);
    const composite = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;

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
    };

    // Upsert today's HSV
    const { error } = await supabase
      .from("human_states")
      .upsert(row, { onConflict: "user_id,as_of" });
    if (error) throw new Error(error.message);

    const hsv: HumanStateVector = {
      as_of,
      physical,
      cognitive,
      emotional,
      behavioral,
      lifestyle,
      operational,
      composite,
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
    };
    return { hsv, materialized: true };
  });
