// Personal Policy Service — CSPS Ch. 10.
// Users author their own if/then operating rules; PDIE consults active ones.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PolicyInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  when_condition: z.record(z.string(), z.unknown()).default({}),
  then_action: z.record(z.string(), z.unknown()).default({}),
  priority: z.number().int().min(0).max(1000).default(100),
  active: z.boolean().default(true),
});

export const listPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("policies")
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return { policies: data ?? [] };
  });

export const upsertPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PolicyInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      when_condition: data.when_condition as never,
      then_action: data.then_action as never,
      priority: data.priority,
      active: data.active,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("policies")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("policies").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const togglePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("policies")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("policies")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
