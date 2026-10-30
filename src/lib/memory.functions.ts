import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refreshLearningMemory } from "./learning-memory.server";

export const listPersonalMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("personal_memory")
      .select("*")
      .eq("active", true)
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("last_observed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { memories: data ?? [] };
  });

export const listDecisionMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("decision_memory")
      .select("*")
      .order("decided_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { decisions: data ?? [] };
  });

export const upsertPersonalMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      memory_type: z.enum(["preference", "pattern", "constraint", "identity", "lesson", "context"]),
      memory_key: z.string().min(1).max(160),
      summary: z.string().min(1).max(1000),
      evidence: z.array(z.string().max(240)).max(30).default([]),
      confidence: z.number().min(0).max(1).nullable().optional(),
      active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: memory, error } = await context.supabase
      .from("personal_memory")
      .upsert(
        {
          user_id: context.userId,
          memory_type: data.memory_type,
          memory_key: data.memory_key,
          summary: data.summary,
          evidence: data.evidence as never,
          confidence: data.confidence ?? null,
          active: data.active,
          last_observed_at: now,
        },
        { onConflict: "user_id,memory_key" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { memory };
  });

export const synthesizePersonalMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await refreshLearningMemory(
      context.supabase,
      context.userId,
    );
    return {
      synthesized: result.memory_count,
      patterns: result.pattern_count,
    };
  });

export const setPersonalMemoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("personal_memory")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
