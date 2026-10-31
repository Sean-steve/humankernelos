// Permission enforcement (Constitution Art. VI). Server-only.
// Consent is resolved from persisted decisions; Kernel-owned engines are
// allowed by default, third-party engines are denied until explicitly granted.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

export class ConsentDeniedError extends Error {
  constructor(
    public engineId: string,
    public scope: string,
  ) {
    super(
      `Consent required: grant "${scope}" to engine "${engineId}" on the Governance page before it can run.`,
    );
    this.name = "ConsentDeniedError";
  }
}

const TRUSTED_KERNEL_ENGINE_IDS = new Set([
  "hsie",
  "pdie",
  "policy",
  "learning",
  "orchestrator",
  "timeline",
  "daily-plan",
]);

async function isKernelOwned(db: Db, userId: string, engineId: string) {
  if (!TRUSTED_KERNEL_ENGINE_IDS.has(engineId)) return false;

  const { data } = await db
    .from("engines")
    .select("engine_id")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .maybeSingle();

  // Trust is rooted in the platform-owned engine identifier, never in
  // manifest-controlled owner text.
  return !!data;
}

/** Resolve whether an engine currently holds consent for a data scope. */
export async function scopeAllowed(
  db: Db,
  userId: string,
  engineId: string,
  scope: string,
): Promise<boolean> {
  const { data } = await db
    .from("engine_permissions")
    .select("granted")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .eq("scope", scope)
    .maybeSingle();

  if (data) return !!data.granted;
  return isKernelOwned(db, userId, engineId);
}

/** Throw + audit when an engine reads a scope it does not hold consent for. */
export async function assertScope(
  db: Db,
  userId: string,
  engineId: string,
  scope: string,
): Promise<void> {
  if (await scopeAllowed(db, userId, engineId, scope)) return;

  await db.from("audit_log").insert({
    user_id: userId,
    action: "permission.denied",
    resource: `${engineId}:${scope}`,
    detail: { engine_id: engineId, scope } as never,
  });

  throw new ConsentDeniedError(engineId, scope);
}

/** Engine lifecycle gate (Spec Ch. 6): a disabled engine cannot act. */
export async function engineIsActive(db: Db, userId: string, engineId: string): Promise<boolean> {
  const { data } = await db
    .from("engines")
    .select("status, lifecycle_state")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .maybeSingle();

  // Persisted installation is authoritative. Declared/catalogued software is
  // not allowed to act until it is installed and placed in an operational state.
  if (!data) return false;

  const lifecycle = data.lifecycle_state ?? "DISABLED";
  return data.status === "active" && (lifecycle === "ENABLED" || lifecycle === "RUNNING");
}

export async function assertEngineActive(db: Db, userId: string, engineId: string): Promise<void> {
  if (await engineIsActive(db, userId, engineId)) return;
  await db.from("audit_log").insert({
    user_id: userId,
    action: "engine.blocked",
    resource: engineId,
    detail: { reason: "engine is not active" } as never,
  });
  throw new Error(`Engine "${engineId}" is not active. Activate it in the Engine Registry.`);
}
