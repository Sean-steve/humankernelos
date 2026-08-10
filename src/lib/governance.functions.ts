// Governance server functions — Constitution Art. VI (permissions) & Art. XIV (audit + export).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consentCoverage, mergeConsent, type PermissionRow } from "./governance.server";

export const getGovernance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: perms }, { data: audit }] = await Promise.all([
      supabase
        .from("engine_permissions")
        .select("engine_id, scope, granted, reason, updated_at")
        .eq("user_id", userId),
      supabase
        .from("audit_log")
        .select("id, action, resource, detail, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const rows = (perms ?? []) as PermissionRow[];

    return {
      permissions: mergeConsent(rows),
      coverage: consentCoverage(rows),
      audit: (audit ?? []).map((a) => ({
        id: a.id as string,
        action: a.action as string,
        resource: a.resource as string,
        detail: a.detail as Record<string, unknown>,
        created_at: a.created_at as string,
      })),
    };
  });

export const setEnginePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        engine_id: z.string().min(1).max(64),
        scope: z.string().min(1).max(120),
        granted: z.boolean(),
        reason: z.string().max(240).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("engine_permissions").upsert(
      {
        user_id: userId,
        engine_id: data.engine_id,
        scope: data.scope,
        granted: data.granted,
        reason: data.reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,engine_id,scope" },
    );
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: data.granted ? "permission.granted" : "permission.revoked",
      resource: `${data.engine_id}:${data.scope}`,
      detail: { engine_id: data.engine_id, scope: data.scope, granted: data.granted } as never,
    });

    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const tables = [
      "profiles",
      "check_ins",
      "reflections",
      "human_states",
      "recommendations",
      "recommendation_outcomes",
      "learned_patterns",
      "policies",
      "engine_signals",
      "hos_events",
      "engines",
      "engine_permissions",
      "nutrition_logs",
      "body_sessions",
      "routine_completions",
    ] as const;

    const bundle: Record<string, unknown[]> = {};
    for (const table of tables) {
      const query = supabase.from(table).select("*");
      const { data } = await (table === "profiles"
        ? query.eq("id", userId)
        : query.eq("user_id", userId));
      bundle[table] = data ?? [];
    }

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "data.exported",
      resource: "full_bundle",
      detail: { tables: tables.length } as never,
    });

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: bundle,
    };
  });
