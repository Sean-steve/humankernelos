import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AdvisorInput = z.object({
  humanState: z.object({
    energy: z.number(),
    focus: z.number(),
    recovery: z.number(),
    stress: z.number(),
    mood: z.number(),
    sleepHours: z.number(),
  }),
  context: z.string().optional(),
});

const SYSTEM_PROMPT = `You are the Operating Advisor inside the Human Operating System (HOS) — the Kernel that manages the highest operating condition of one human being.

You are not a chatbot. You are a calm, decisive advisor.

Given the current human state, respond with a single crisp recommendation in exactly this format:

DIRECTIVE: <one sentence, imperative, ≤ 14 words>
WHY: <one sentence explaining the physiological or cognitive reasoning>
AVOID: <one thing the user should not do today>

No preamble. No markdown. No emoji. No sign-off.`;

export const getAdvisorDirective = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdvisorInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const stateSummary = `Energy ${data.humanState.energy}/100, Focus ${data.humanState.focus}/100, Recovery ${data.humanState.recovery}/100, Stress ${data.humanState.stress}/100, Mood ${data.humanState.mood}/100, Sleep ${data.humanState.sleepHours}h last night.${data.context ? " Context: " + data.context : ""}`;

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: stateSummary,
    });

    return { text: text.trim() };
  });
