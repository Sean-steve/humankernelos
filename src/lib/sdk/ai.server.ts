// Scoped AI access for engines (HIS-007). Server-only.
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "../ai-gateway.server";

export async function runEngineAi(prompt: string, system?: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this workspace.");

  const provider = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: provider("google/gemini-2.5-flash"),
    ...(system ? { system } : {}),
    prompt,
  });
  return { text };
}
