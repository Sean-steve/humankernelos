// Personal Decision Intelligence Engine (PDIE)
// Generates explainable recommendations from the Human State Vector.
// Constitution Art. XI (explainability contract), PDIE spec Ch. 6/7.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { outcomeHistoryPrompt, type OutcomeRow, type RecRow } from "./learning.server";
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
- confidence: 0.0-1.0, honest.
- cost_axes: any of physical, cognitive, emotional, behavioral, lifestyle, operational that this may cost. Empty array if none.
- trades_off: true when the recommendation gains one axis at the measurable expense of another.
- sustainability_note: one sentence on the long-term effect. Never sacrifice long-term performance for a short-term win.
- Apply the learned history: prefer directive shapes this operator has actually executed and that measurably helped.
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
    ]);


    const hsvSummary = hsvRow
      ? `HSV as of ${(hsvRow as Record<string, unknown>).as_of}, composite=${(hsvRow as Record<string, unknown>).composite ?? "null"}. ` +
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

    const prompt = [
      identitySummary,
      hsvSummary,
      checkInSummary,
      policySummary,
      historySummary,
      patternSummary,
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
        };

      } else {
        throw error;
      }
    }

    // Persist
    const composite =
      (hsvRow as Record<string, unknown> | null)?.composite as number | null | undefined;
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
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "dismissed", "completed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recommendations")
      .update({ status: data.status, decided_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
