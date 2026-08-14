import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { publishAndDispatch } from "./mesh.server";

const CheckInInput = z.object({
  energy: z.number().min(0).max(100),
  focus: z.number().min(0).max(100),
  recovery: z.number().min(0).max(100),
  stress: z.number().min(0).max(100),
  mood: z.number().min(0).max(100),
  sleepHours: z.number().min(0).max(24),
  note: z.string().max(2000).optional(),
});

const SYSTEM = `You are the Operating Advisor inside the Human Operating System (HOS).
Given the current human state, respond with a single crisp recommendation in exactly this format:

DIRECTIVE: <one sentence, imperative, ≤ 14 words>
WHY: <one sentence explaining the physiological or cognitive reasoning>
AVOID: <one thing the user should not do today>

No preamble. No markdown. No emoji. No sign-off.`;

export const submitCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CheckInInput.parse(data))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    let directive = "";

    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-2.5-flash");
        const summary = `Energy ${data.energy}/100, Focus ${data.focus}/100, Recovery ${data.recovery}/100, Stress ${data.stress}/100, Mood ${data.mood}/100, Sleep ${data.sleepHours}h.${data.note ? " Context: " + data.note : ""}`;
        const { text } = await generateText({
          model,
          system: SYSTEM,
          prompt: summary,
        });
        directive = text.trim();
      } catch (e) {
        console.error("advisor error", e);
      }
    }

    const { data: row, error } = await context.supabase
      .from("check_ins")
      .insert({
        user_id: context.userId,
        energy: data.energy,
        focus: data.focus,
        recovery: data.recovery,
        stress: data.stress,
        mood: data.mood,
        sleep_hours: data.sleepHours,
        note: data.note ?? null,
        directive: directive || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await publishAndDispatch(context.supabase, context.userId, {
      type: "CheckInSubmitted",
      source_engine: "hsie",
      payload: {
        energy: data.energy,
        focus: data.focus,
        recovery: data.recovery,
        stress: data.stress,
        mood: data.mood,
        sleep_hours: data.sleepHours,
      },
      idempotency_key: `checkin:${row.id}`,
    });

    return { checkIn: row, directive };
  });
