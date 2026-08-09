// Learning Loop server functions — Constitution Art. XII
// Observe -> Recommend -> Execute -> Measure -> Reflect -> Learn -> Improve

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AXES,
  adherenceRate,
  axisImpact,
  byType,
  derivePatterns,
  topFrictions,
  type OutcomeRow,
  type RecRow,
} from "./learning.server";

const EffectSchema = z.record(z.enum(AXES), z.number().min(-100).max(100));

export const recordOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        recommendation_id: z.string().uuid(),
        executed: z.enum(["yes", "partial", "no"]),
        effect: EffectSchema.default({}),
        friction: z.string().max(120).optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("recommendation_outcomes").upsert(
      {
        user_id: userId,
        recommendation_id: data.recommendation_id,
        executed: data.executed,
        effect: data.effect as never,
        friction: data.friction ?? null,
        note: data.note ?? null,
        measured_at: new Date().toISOString(),
      },
      { onConflict: "recommendation_id" },
    );
    if (error) throw new Error(error.message);

    await supabase
      .from("recommendations")
      .update({ status: data.executed === "no" ? "measured" : "measured" })
      .eq("id", data.recommendation_id)
      .eq("user_id", userId);

    // Emit adherence as a first-class signal (Art. VIII shape).
    const { data: outcomes } = await supabase
      .from("recommendation_outcomes")
      .select("recommendation_id, executed, effect, friction, measured_at")
      .order("measured_at", { ascending: false })
      .limit(200);

    const rate = adherenceRate((outcomes ?? []) as unknown as OutcomeRow[]);
    if (rate !== null) {
      await supabase.from("engine_signals").insert({
        user_id: userId,
        engine: "learning",
        signal_key: "learning.adherence",
        value_num: rate,
        confidence: Math.min(0.9, 0.4 + (outcomes?.length ?? 0) * 0.05),
        reliability: 0.9,
        trend: "unknown",
        metadata: { measured: outcomes?.length ?? 0 } as never,
      });
    }

    await supabase.from("hos_events").insert({
      user_id: userId,
      type: "OutcomeMeasured",
      source_engine: "learning",
      payload: { recommendation_id: data.recommendation_id, executed: data.executed } as never,
    });

    return { ok: true, adherence: rate };
  });

/** Accepted directives older than the follow-up window with no outcome yet. */
export const listPendingMeasurements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: recs, error: recErr }, { data: outcomes }] = await Promise.all([
      supabase
        .from("recommendations")
        .select("id, type, title, body, status, created_at")
        .in("status", ["accepted", "completed"])
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("recommendation_outcomes").select("recommendation_id"),
    ]);
    if (recErr) throw new Error(recErr.message);

    const measured = new Set((outcomes ?? []).map((o) => o.recommendation_id));
    return { pending: (recs ?? []).filter((r) => !measured.has(r.id)) };
  });

export const getLearningSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: recs }, { data: outcomes }, { data: patterns }] = await Promise.all([
      supabase
        .from("recommendations")
        .select("id, type, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .order("measured_at", { ascending: false })
        .limit(200),
      supabase
        .from("learned_patterns")
        .select("*")
        .eq("active", true)
        .order("confidence", { ascending: false }),
    ]);

    const r = (recs ?? []) as unknown as RecRow[];
    const o = (outcomes ?? []) as unknown as OutcomeRow[];

    return {
      totals: {
        recommendations: r.length,
        measured: o.length,
        pending: r.filter((x) => x.status === "accepted").length,
      },
      adherence: adherenceRate(o),
      axisImpact: axisImpact(o),
      byType: byType(r, o),
      frictions: topFrictions(o),
      patterns: patterns ?? [],
    };
  });

/** Recompute learned patterns from measured outcomes and persist them. */
export const synthesizePatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: recs }, { data: outcomes }] = await Promise.all([
      supabase
        .from("recommendations")
        .select("id, type, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .order("measured_at", { ascending: false })
        .limit(200),
    ]);

    const derived = derivePatterns(
      (recs ?? []) as unknown as RecRow[],
      (outcomes ?? []) as unknown as OutcomeRow[],
    );

    await supabase.from("learned_patterns").delete().eq("user_id", userId);

    if (derived.length) {
      const { error } = await supabase.from("learned_patterns").insert(
        derived.map((p) => ({
          user_id: userId,
          label: p.label,
          description: p.description,
          axis: p.axis,
          evidence_count: p.evidence_count,
          confidence: p.confidence,
          active: true,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return { count: derived.length, patterns: derived };
  });
