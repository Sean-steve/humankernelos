// Personal Decision Intelligence Engine (PDIE)
// Generates explainable recommendations from the Human State Vector.
// Constitution Art. XI (explainability contract), PDIE spec Ch. 6/7.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScope, engineIsActive } from "./permissions.server";
import { publishAndDispatch } from "./mesh.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { outcomeHistoryPrompt, type OutcomeRow, type RecRow } from "./learning.server";
import {
  clampRecommendationConfidence,
  decisionConfidenceCeiling,
} from "./pdie.server";
import {
  fuseSignals,
  rankPriorities,
  orchestratorPrompt,
  type CheckIn,
  type RawSignal,
} from "./orchestrator.server";

const RecommendationSchema = z.object({
  title: z.string(),
  body: z.string(),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  alternatives: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: z.number(),
  cost_axes: z.array(z.string()),
  trades_off: z.boolean(),
  sustainability_note: z.string(),
  execution_adaptation: z
    .object({
      type: z.enum([
        "PREFER_SHORTER_BLOCKS",
        "PREFER_RECOVERY",
        "REDUCE_CONTEXT_SWITCHING",
        "PREFER_LOWER_COGNITIVE_LOAD",
        "PREFER_LOWER_PHYSICAL_LOAD",
      ]),
      max_block_minutes: z.number().int().min(10).max(240).optional(),
      strength: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .default(null),
});

const SYSTEM = `You are the Personal Decision Intelligence Engine inside the Human Operating System.
You do not chat. You emit a single recommendation as JSON, obeying the Constitution's explainability contract:
every recommendation must include evidence, assumptions, alternatives considered, and risks.

The Constitution's first principle is Sustainable Human Performance: a recommendation that improves one
axis while destroying another is a failed optimization. You must state what it costs.

Rules:
- title: <= 10 words, imperative.
- body: 2-3 sentences, calm, decisive. No preamble, no markdown, no emoji.
- evidence: 2-4 concrete signals from the state vector (e.g. "recovery=42 (low)", "routine.streak=6").
- assumptions: 1-3 assumptions you are making about the operator's day/context.
- alternatives: 1-3 other actions considered and why they were not chosen.
- risks: 1-3 things that could go wrong if the operator follows this recommendation.
- confidence: 0.0-1.0, honest. Never imply certainty beyond the stated Human State coverage/confidence.
- When Human State coverage is low or stale, prefer collecting missing evidence or making a conservative reversible recommendation.
- Treat accepted/modified/dismissed past decisions as evidence about the operator; do not repeatedly recommend a previously rejected action without new evidence.
- cost_axes: any of physical, cognitive, emotional, behavioral, lifestyle, operational that this may cost. Empty array if none.
- trades_off: true when the recommendation gains one axis at the measurable expense of another.
- sustainability_note: one sentence on the long-term effect. Never sacrifice long-term performance for a short-term win.
- execution_adaptation: null unless the recommendation genuinely benefits from a bounded execution advisory. When used, choose only one of PREFER_SHORTER_BLOCKS, PREFER_RECOVERY, REDUCE_CONTEXT_SWITCHING, PREFER_LOWER_COGNITIVE_LOAD, PREFER_LOWER_PHYSICAL_LOAD. This is advisory only and may never mutate Human State, Personal Policy, or the HOS Daily Plan.
- Apply the learned history: prefer directive shapes this operator has actually executed and that measurably helped.
- Address the Orchestrator's rank-1 priority unless an active personal policy forbids it; if you deviate, say why in the body.
- Do not re-derive state from raw signals: the fused axes are already weighted by confidence, reliability and recency.
`;


export const generateRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        type: z.enum(["daily", "strategic", "preventive", "optimization"]).default("daily"),
        context: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase, userId } = context;
    await assertScope(supabase, userId, "pdie", "human_states");

    // Load HSV, latest check-in, signals, active policies, profile, learned history
    const [
      { data: hsvRow },
      { data: checkIn },
      { data: signalRows },
      { data: activePolicies },
      { data: profile },
      { data: pastRecs },
      { data: pastOutcomes },
      { data: learnedPatterns },
      { data: activeGoals },
      { data: personalMemory },
      { data: recentDecisionMemory },
    ] = await Promise.all([
      supabase
        .from("human_states")
        .select("*")
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("*")
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

      supabase
        .from("policies")
        .select("name, description, when_condition, then_action, priority")
        .eq("active", true)
        .order("priority", { ascending: true }),
      supabase.from("profiles").select("name, becoming, primary_standard").maybeSingle(),
      supabase
        .from("recommendations")
        .select("id, type, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .order("measured_at", { ascending: false })
        .limit(30),
      supabase
        .from("learned_patterns")
        .select("label, description, confidence")
        .eq("active", true)
        .order("confidence", { ascending: false })
        .limit(8),
      supabase
        .from("goals")
        .select("id, title, description, horizon, priority, progress, target_date")
        .eq("status", "active")
        .order("priority", { ascending: true })
        .limit(12),
      supabase
        .from("personal_memory")
        .select("memory_type, summary, confidence, evidence")
        .eq("active", true)
        .order("confidence", { ascending: false, nullsFirst: false })
        .limit(12),
      supabase
        .from("decision_memory")
        .select("decision_status, chosen_action, expected_outcome, actual_outcome, lesson, confidence, decided_at")
        .order("decided_at", { ascending: false })
        .limit(10),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const { data: dailyPlan } = await supabase
      .from("daily_plans")
      .select("id, status, context_snapshot")
      .eq("plan_date", today)
      .maybeSingle();
    const { data: dailyItems } = dailyPlan
      ? await supabase
          .from("daily_plan_items")
          .select("title, start_at, end_at, priority, protected, flexibility, status, source_type, source_engine")
          .eq("plan_id", dailyPlan.id)
          .in("status", ["planned", "current", "deferred"])
          .order("start_at", { ascending: true, nullsFirst: false })
      : { data: [] };


    const hsvSummary = hsvRow
      ? `HSV as of ${(hsvRow as Record<string, unknown>).as_of}, composite=${(hsvRow as Record<string, unknown>).composite ?? "null"}, coverage=${(hsvRow as Record<string, unknown>).coverage ?? 0}, confidence=${(hsvRow as Record<string, unknown>).confidence ?? "unknown"}, sources=${(hsvRow as Record<string, unknown>).source_count ?? 0}. ` +
        (["physical", "cognitive", "emotional", "behavioral", "lifestyle", "operational"] as const)
          .map((f) => {
            const fam = (hsvRow as Record<string, unknown>)[f] as
              | { value: number | null; confidence: number | null; inputs: string[] }
              | null;
            if (!fam) return `${f}=n/a`;
            return `${f}=${fam.value ?? "null"}(c=${fam.confidence ?? "?"})`;
          })
          .join(", ")
      : "HSV not yet materialized.";

    const checkInSummary = checkIn
      ? `Latest check-in: energy=${checkIn.energy}, focus=${checkIn.focus}, recovery=${checkIn.recovery}, stress=${checkIn.stress}, mood=${checkIn.mood}, sleep=${checkIn.sleep_hours}h.`
      : "No recent check-in.";

    const policySummary = (activePolicies ?? []).length
      ? "Active personal policies:\n" +
        (activePolicies ?? [])
          .map(
            (p) =>
              `- ${p.name}${p.description ? ": " + p.description : ""} (priority ${p.priority})`,
          )
          .join("\n")
      : "No active personal policies.";

    const identitySummary = profile
      ? `Operator: ${profile.name}. Becoming: ${profile.becoming}. Primary standard: ${profile.primary_standard}.`
      : "Operator identity not yet configured.";

    const historySummary = outcomeHistoryPrompt(
      (pastRecs ?? []) as unknown as RecRow[],
      (pastOutcomes ?? []) as unknown as OutcomeRow[],
    );

    const patternSummary = (learnedPatterns ?? []).length
      ? "Learned personal patterns:\n" +
        (learnedPatterns ?? [])
          .map((p) => `- ${p.label}: ${p.description} (confidence ${p.confidence ?? "?"})`)
          .join("\n")
      : "No learned patterns yet.";

    const goalSummary = (activeGoals ?? []).length
      ? "Active goals, highest priority first:\n" +
        (activeGoals ?? [])
          .map(
            (g) =>
              `- ${g.title} [${g.horizon}, priority ${g.priority}, progress ${g.progress}%${g.target_date ? `, target ${g.target_date}` : ""}]`,
          )
          .join("\n")
      : "No active goals configured.";

    const memorySummary = (personalMemory ?? []).length
      ? "Durable personal memory (use as evidence, never as certainty beyond its confidence):\n" +
        (personalMemory ?? [])
          .map(
            (m) =>
              `- [${m.memory_type}] ${m.summary} (confidence ${m.confidence ?? "unknown"})`,
          )
          .join("\n")
      : "No durable personal memory has been synthesized yet.";

    const decisionMemorySummary = (recentDecisionMemory ?? []).length
      ? "Recent human decisions and measured lessons:\n" +
        (recentDecisionMemory ?? [])
          .map(
            (decision) =>
              `- ${decision.decision_status}: ${decision.chosen_action}${decision.lesson ? ` · lesson: ${decision.lesson}` : ""}${decision.actual_outcome ? ` · outcome: ${decision.actual_outcome}` : ""}`,
          )
          .join("\n")
      : "No prior decision memory yet.";

    const planSummary = (dailyItems ?? []).length
      ? "Authoritative Daily Operating Plan:\n" +
        (dailyItems ?? [])
          .map(
            (item) =>
              `- ${item.title} · ${item.start_at ?? "unscheduled"} → ${item.end_at ?? "unscheduled"} · ${item.status}${item.protected ? " · PROTECTED" : ""}`,
          )
          .join("\n")
      : "No authoritative Daily Operating Plan items are currently scheduled.";

    // Art. IX: the Orchestrator fuses signals, resolves conflicts and ranks what
    // matters now. PDIE decides against that ranking, not a raw signal dump.
    const { fused, conflicts } = fuseSignals(
      (signalRows ?? []) as unknown as RawSignal[],
      (checkIn ?? null) as unknown as CheckIn,
    );
    const priorities = rankPriorities(fused);
    const orchestratorSummary = orchestratorPrompt(fused, conflicts, priorities);

    const prompt = [
      identitySummary,
      orchestratorSummary,
      hsvSummary,
      checkInSummary,
      policySummary,
      historySummary,
      patternSummary,
      goalSummary,
      memorySummary,
      decisionMemorySummary,
      planSummary,
      `Recommendation type: ${data.type}.`,

      data.context ? `Additional context: ${data.context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");


    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    let parsed: z.infer<typeof RecommendationSchema>;
    try {
      const { output } = await generateText({
        model,
        system: SYSTEM,
        prompt,
        output: Output.object({ schema: RecommendationSchema }),
      });
      parsed = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        parsed = {
          title: "Reassess and rest briefly",
          body: "The advisor couldn't emit a structured recommendation. Take a five-minute reset and log a fresh check-in.",
          evidence: ["AI structured output failed"],
          assumptions: ["Model returned malformed JSON"],
          alternatives: ["Manual planning"],
          risks: ["Low signal quality"],
          confidence: 0.2,
          cost_axes: [],
          trades_off: false,
          sustainability_note: "Neutral — a short reset costs nothing long term.",
          execution_adaptation: null,
        };

      } else {
        throw error;
      }
    }

    const stateRecord = hsvRow as Record<string, unknown> | null;
    const confidenceCeiling = decisionConfidenceCeiling({
      coverage: stateRecord?.coverage as number | null | undefined,
      confidence: stateRecord?.confidence as number | null | undefined,
      stateDate: stateRecord?.as_of as string | null | undefined,
      today,
    });
    parsed.confidence = clampRecommendationConfidence(
      parsed.confidence,
      confidenceCeiling,
    );

    // Persist
    const composite =
      stateRecord?.composite as number | null | undefined;
    const priority = composite !== null && composite !== undefined ? 100 - composite : 50;

    const { data: inserted, error: insertErr } = await supabase
      .from("recommendations")
      .insert({
        user_id: userId,
        type: data.type,
        title: parsed.title,
        body: parsed.body,
        evidence: parsed.evidence as never,
        assumptions: parsed.assumptions as never,
        alternatives: parsed.alternatives as never,
        risks: parsed.risks as never,
        confidence: parsed.confidence,
        sustainability: {
          cost_axes: parsed.cost_axes,
          trades_off: parsed.trades_off,
          note: parsed.sustainability_note,
          execution_adaptation: parsed.execution_adaptation,
        } as never,
        priority,
        state_alignment: composite ?? null,
        urgency: priority,
        status: "pending",

      })
      .select()
      .single();
    if (insertErr) throw new Error(insertErr.message);

    return { recommendation: inserted };
  });

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { recommendations: data ?? [] };
  });

export const decideRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "modified", "dismissed", "completed"]),
        chosen_action: z.string().min(1).max(1000).optional(),
        expected_outcome: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: recommendation, error: readError } = await context.supabase
      .from("recommendations")
      .select(
        "id, type, title, body, evidence, assumptions, alternatives, risks, confidence, state_alignment, priority, urgency, sustainability",
      )
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (readError) throw new Error(readError.message);

    const chosenAction =
      data.chosen_action ??
      (data.status === "dismissed" ? "Recommendation dismissed" : recommendation.body);
    if (data.status === "modified" && !data.chosen_action) {
      throw new Error("A modified recommendation requires chosen_action.");
    }

    const decidedAt = new Date().toISOString();
    const { error } = await context.supabase
      .from("recommendations")
      .update({ status: data.status, decided_at: decidedAt })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const { error: memoryError } = await context.supabase
      .from("decision_memory")
      .insert({
        user_id: context.userId,
        recommendation_id: recommendation.id,
        context_snapshot: {
          recommendation_type: recommendation.type,
          title: recommendation.title,
          evidence: recommendation.evidence,
          assumptions: recommendation.assumptions,
          risks: recommendation.risks,
          state_alignment: recommendation.state_alignment,
          priority: recommendation.priority,
          urgency: recommendation.urgency,
        } as never,
        options: recommendation.alternatives as never,
        chosen_action: chosenAction,
        decision_status: data.status,
        expected_outcome: data.expected_outcome ?? null,
        confidence: recommendation.confidence,
        decided_at: decidedAt,
      });
    if (memoryError) throw new Error(memoryError.message);

    if (
      (data.status === "accepted" || data.status === "modified") &&
      (recommendation.sustainability as Record<string, unknown> | null)?.execution_adaptation &&
      (await engineIsActive(context.supabase, context.userId, "pdie"))
    ) {
      const sustainability =
        (recommendation.sustainability as Record<string, unknown> | null) ?? {};
      await publishAndDispatch(context.supabase, context.userId, {
        type: "RecommendationDecided",
        source_engine: "pdie",
        payload: {
          recommendation_id: recommendation.id,
          decision_status: data.status,
          confidence: recommendation.confidence,
          rationale: chosenAction,
          evidence_refs: Array.isArray(recommendation.evidence)
            ? recommendation.evidence.map(String)
            : [],
          execution_adaptation: sustainability.execution_adaptation,
        },
        idempotency_key: `recommendation-decided:${recommendation.id}:${data.status}`,
      });
    }

    return { ok: true };
  });
