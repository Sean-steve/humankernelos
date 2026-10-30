import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GoalInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  horizon: z.enum(["daily", "weekly", "monthly", "quarterly", "annual", "long_term"]).default("quarterly"),
  priority: z.number().int().min(0).max(1000).default(100),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  progress: z.number().int().min(0).max(100).default(0),
  target_date: z.string().date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("goals")
      .select("*")
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("target_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { goals: data ?? [] };
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GoalInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      title: data.title,
      description: data.description ?? null,
      horizon: data.horizon,
      priority: data.priority,
      status: data.status,
      progress: data.progress,
      target_date: data.target_date ?? null,
      metadata: data.metadata as never,
    };

    if (data.id) {
      const { data: goal, error } = await context.supabase
        .from("goals")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { goal };
    }

    const { data: goal, error } = await context.supabase
      .from("goals")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { goal };
  });

export const updateGoalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      progress: z.number().int().min(0).max(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const status = data.progress >= 100 ? "completed" : "active";
    const { data: goal, error } = await context.supabase
      .from("goals")
      .update({ progress: data.progress, status })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { goal };
  });

export const setGoalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "paused", "completed", "archived"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("goals")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
