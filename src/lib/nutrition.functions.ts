import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishAndDispatch } from "./mesh.server";

const NutritionInput = z.object({
  meal: z.string().min(1).max(120),
  kcal: z.number().int().min(0).max(10000).default(0),
  protein_g: z.number().int().min(0).max(500).default(0),
  water_ml: z.number().int().min(0).max(10000).default(0),
  note: z.string().max(500).optional(),
});

export const logMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NutritionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("nutrition_logs")
      .insert({
        user_id: context.userId,
        meal: data.meal,
        kcal: data.kcal,
        protein_g: data.protein_g,
        water_ml: data.water_ml,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Recompute today's totals and publish signals
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: today } = await context.supabase
      .from("nutrition_logs")
      .select("kcal,protein_g,water_ml")
      .gte("occurred_at", start.toISOString());
    const kcal = (today ?? []).reduce((s, r) => s + (r.kcal ?? 0), 0);
    const protein = (today ?? []).reduce((s, r) => s + (r.protein_g ?? 0), 0);
    const water = (today ?? []).reduce((s, r) => s + (r.water_ml ?? 0), 0);
    await context.supabase.from("engine_signals").insert([
      { user_id: context.userId, engine: "nutrition", signal_key: "nutrition.kcal", value_num: kcal },
      { user_id: context.userId, engine: "nutrition", signal_key: "nutrition.protein_g", value_num: protein },
      { user_id: context.userId, engine: "nutrition", signal_key: "nutrition.hydration_ml", value_num: water },
    ]);

    // Publish through the Event Mesh so subscribed engines actually run.
    await publishAndDispatch(context.supabase, context.userId, {
      type: "MealLogged",
      source_engine: "nutrition",
      payload: { meal: data.meal, kcal: data.kcal, protein_g: data.protein_g, water_ml: data.water_ml },
      idempotency_key: `meal:${row.id}`,
    });

    return { log: row };
  });

export const listTodayMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await context.supabase
      .from("nutrition_logs")
      .select("*")
      .gte("occurred_at", start.toISOString())
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { meals: data ?? [] };
  });
