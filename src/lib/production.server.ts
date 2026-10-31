import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ProductionCheck = {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
};

function isHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): ProductionCheck[] {
  const production = env.NODE_ENV === "production";
  const requireExecutionOs = env.HOS_REQUIRE_EXECUTION_OS === "true";
  const serviceSecret =
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const executionSecret = env.HOS_EXECUTION_SHARED_SECRET || "";

  return [
    {
      name: "supabase_url",
      ok: Boolean(env.SUPABASE_URL) && (!production || isHttpsUrl(env.SUPABASE_URL)),
      critical: true,
      detail: env.SUPABASE_URL
        ? production && !isHttpsUrl(env.SUPABASE_URL)
          ? "Production Supabase URL must use HTTPS."
          : "Supabase URL configured."
        : "Supabase URL is missing.",
    },
    {
      name: "supabase_publishable_key",
      ok: Boolean(env.SUPABASE_PUBLISHABLE_KEY),
      critical: true,
      detail: env.SUPABASE_PUBLISHABLE_KEY
        ? "Publishable key configured."
        : "Publishable key is missing.",
    },
    {
      name: "supabase_server_secret",
      ok: serviceSecret.length >= 20,
      critical: true,
      detail: serviceSecret.length >= 20
        ? "Server-only Supabase credential configured."
        : "A server-only Supabase secret/service-role credential is required.",
    },
    {
      name: "execution_os_url",
      ok:
        !requireExecutionOs ||
        (Boolean(env.EXECUTION_OS_BASE_URL) &&
          (!production || isHttpsUrl(env.EXECUTION_OS_BASE_URL))),
      critical: requireExecutionOs,
      detail: !requireExecutionOs
        ? "Execution OS is optional for this deployment."
        : env.EXECUTION_OS_BASE_URL
          ? "Execution OS URL configured."
          : "Execution OS is required but its base URL is missing.",
    },
    {
      name: "execution_os_shared_secret",
      ok: !requireExecutionOs || executionSecret.trim().length >= 32,
      critical: requireExecutionOs,
      detail: !requireExecutionOs
        ? "Execution OS shared secret is optional for this deployment."
        : executionSecret.trim().length >= 32
          ? "Execution OS shared secret satisfies the minimum length."
          : "Execution OS requires a shared secret of at least 32 characters.",
    },
  ];
}

export function productionConfigReady(
  checks: ProductionCheck[] = validateProductionEnvironment(),
) {
  return checks.every((check) => !check.critical || check.ok);
}

export function createProductionServiceDb(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient<Database> {
  const url = env.SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("Production database credentials are not configured.");
  }

  return createClient<Database>(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getPublicProductionReadiness(
  env: NodeJS.ProcessEnv = process.env,
) {
  const checks = validateProductionEnvironment(env);
  const configOk = productionConfigReady(checks);

  let databaseOk = false;
  if (configOk) {
    try {
      const db = createProductionServiceDb(env);
      const { error } = await db.from("engines").select("id").limit(1);
      databaseOk = !error;
    } catch {
      databaseOk = false;
    }
  }

  const ready = configOk && databaseOk;
  return {
    ready,
    status: ready ? "ready" : "not_ready",
    checks: {
      configuration: configOk ? "ok" : "failed",
      database: databaseOk ? "ok" : "failed",
    },
  } as const;
}
