import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReflectionInput = z.object({
  prompt: z.string().min(1).max(500),
  entry: z.string().min(1).max(10000),
});

export const submitReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReflectionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reflections")
      .insert({
        user_id: context.userId,
        prompt: data.prompt,
        entry: data.entry,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { reflection: row };
  });
