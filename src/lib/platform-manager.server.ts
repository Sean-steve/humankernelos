// Platform Manager (HIS-006). Server-only.
// Owns the engine lifecycle state machine, dependency/version resolution,
// health derivation, configuration, and the uninstall sequence.

import { REGISTERED_ENGINES, type EngineDescriptor } from "./engines/contract";
import type { Db } from "./permissions.server";

export const PLATFORM_VERSION = "1.0.0";
export const SDK_VERSION = "1.0.0";

export const LIFECYCLE_STATES = [
  "DISCOVERED",
  "INSTALLED",
  "REGISTERED",
  "VALIDATED",
  "ENABLED",
  "RUNNING",
  "SUSPENDED",
  "DISABLED",
  "UNINSTALLED",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Legal transitions only — anything else is rejected (HIS-006 §lifecycle). */
export const TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DISCOVERED: ["INSTALLED"],
  INSTALLED: ["REGISTERED", "UNINSTALLED"],
  REGISTERED: ["VALIDATED", "DISABLED", "UNINSTALLED"],
  VALIDATED: ["ENABLED", "DISABLED", "UNINSTALLED"],
  ENABLED: ["RUNNING", "SUSPENDED", "DISABLED"],
  RUNNING: ["SUSPENDED", "DISABLED"],
  SUSPENDED: ["ENABLED", "DISABLED"],
  DISABLED: ["ENABLED", "UNINSTALLED"],
  UNINSTALLED: [],
};

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

export function canTransition(from: LifecycleState, to: LifecycleState) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Only ENABLED/RUNNING engines may act. SUSPENDED keeps state, stops work. */
export function stateIsOperational(state: LifecycleState) {
  return state === "ENABLED" || state === "RUNNING";
}

export function statusForState(state: LifecycleState): "active" | "inactive" | "deprecated" {
  if (stateIsOperational(state)) return "active";
  if (state === "UNINSTALLED") return "deprecated";
  return "inactive";
}

export type HealthState = "healthy" | "degraded" | "unresponsive" | "disabled" | "failed";

export type HealthInput = {
  lifecycle_state: LifecycleState;
  last_heartbeat_at: string | null;
  error_count: number;
  last_error: string | null;
};

const UNRESPONSIVE_AFTER_MS = 1000 * 60 * 60 * 24; // 24h without a heartbeat

/** Derive health from lifecycle + heartbeat + error history. */
export function deriveHealth(input: HealthInput, now = Date.now()): HealthState {
  if (!stateIsOperational(input.lifecycle_state)) return "disabled";
  if (input.error_count >= 10) return "failed";
  if (
    input.last_heartbeat_at &&
    now - new Date(input.last_heartbeat_at).getTime() > UNRESPONSIVE_AFTER_MS
  )
    return "unresponsive";
  if (input.error_count > 0 || input.last_error) return "degraded";
  return "healthy";
}

export type ResolutionResult = { ok: true } | { ok: false; reasons: string[] };

/** Dependency + version resolution at install/upgrade time. */
export function resolveDependencies(
  descriptor: EngineDescriptor,
  installedEngineIds: string[],
  platformVersion = PLATFORM_VERSION,
): ResolutionResult {
  const reasons: string[] = [];
  const known = new Set([...installedEngineIds, ...REGISTERED_ENGINES.map((e) => e.id)]);

  for (const dep of descriptor.dependencies) {
    if (!known.has(dep)) reasons.push(`missing dependency "${dep}"`);
  }
  if (platformVersion.split(".")[0] !== PLATFORM_VERSION.split(".")[0]) {
    reasons.push(`platform ${platformVersion} is incompatible with ${PLATFORM_VERSION}`);
  }
  if (descriptor.dependencies.includes(descriptor.id)) {
    reasons.push("engine declares itself as a dependency");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export type EngineRow = {
  engine_id: string;
  lifecycle_state: string;
  last_heartbeat_at: string | null;
  last_event_at: string | null;
  error_count: number;
  last_error: string | null;
  health: string;
};

/** Apply a lifecycle transition, writing engine row + health event + audit. */
export async function transition(
  db: Db,
  userId: string,
  engineId: string,
  to: LifecycleState,
  note?: string,
) {
  const { data: row } = await db
    .from("engines")
    .select("lifecycle_state, last_heartbeat_at, error_count, last_error")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .maybeSingle();

  if (!row) throw new LifecycleError(`Engine "${engineId}" is not installed.`);

  const from = row.lifecycle_state as LifecycleState;
  if (from === to) return { engine_id: engineId, state: to, unchanged: true };

  if (!canTransition(from, to)) {
    await db.from("audit_log").insert({
      user_id: userId,
      action: "lifecycle.rejected",
      resource: engineId,
      detail: { from, to } as never,
    });
    throw new LifecycleError(`Illegal transition ${from} → ${to} for engine "${engineId}".`);
  }

  const health = deriveHealth({
    lifecycle_state: to,
    last_heartbeat_at: row.last_heartbeat_at as string | null,
    error_count: (row.error_count as number) ?? 0,
    last_error: row.last_error as string | null,
  });

  const { error } = await db
    .from("engines")
    .update({ lifecycle_state: to, status: statusForState(to), health })
    .eq("user_id", userId)
    .eq("engine_id", engineId);
  if (error) throw new Error(error.message);

  await db.from("engine_health_events").insert({
    user_id: userId,
    engine_id: engineId,
    health,
    note: note ?? `${from} → ${to}`,
  });
  await db.from("audit_log").insert({
    user_id: userId,
    action: "lifecycle.transition",
    resource: engineId,
    detail: { from, to, health } as never,
  });

  return { engine_id: engineId, state: to, health, unchanged: false };
}

/** Heartbeat + error accounting, used by the SDK on every engine action. */
export async function heartbeat(
  db: Db,
  userId: string,
  engineId: string,
  opts: { error?: string; event?: boolean } = {},
) {
  const { data: row } = await db
    .from("engines")
    .select("lifecycle_state, error_count")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .maybeSingle();
  if (!row) return;

  const error_count = opts.error ? ((row.error_count as number) ?? 0) + 1 : 0;
  const now = new Date().toISOString();
  const health = deriveHealth({
    lifecycle_state: row.lifecycle_state as LifecycleState,
    last_heartbeat_at: now,
    error_count,
    last_error: opts.error ?? null,
  });

  await db
    .from("engines")
    .update({
      last_heartbeat_at: now,
      error_count,
      last_error: opts.error ?? null,
      health,
      ...(opts.event ? { last_event_at: now } : {}),
    })
    .eq("user_id", userId)
    .eq("engine_id", engineId);
}

/**
 * Uninstall sequence: disable → stop consumption → stop publication →
 * deregister → archive audit history.
 */
export async function uninstall(db: Db, userId: string, engineId: string) {
  const { data: row } = await db
    .from("engines")
    .select("lifecycle_state")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .maybeSingle();
  if (!row) throw new LifecycleError(`Engine "${engineId}" is not installed.`);

  const from = row.lifecycle_state as LifecycleState;
  if (stateIsOperational(from) || from === "SUSPENDED") {
    await transition(db, userId, engineId, "DISABLED", "uninstall: disabling first");
  }

  // Stop event consumption.
  await db
    .from("engine_subscriptions")
    .update({ enabled: false })
    .eq("user_id", userId)
    .eq("engine_id", engineId);

  // Stop capability publication.
  await db
    .from("engine_capabilities")
    .update({ status: "deprecated" })
    .eq("user_id", userId)
    .eq("provider_engine_id", engineId);

  // Revoke consent and clear configuration; keep the audit trail.
  await db
    .from("engine_permissions")
    .update({ granted: false, reason: "engine uninstalled" })
    .eq("user_id", userId)
    .eq("engine_id", engineId);
  await db.from("engine_config").delete().eq("user_id", userId).eq("engine_id", engineId);

  await transition(db, userId, engineId, "UNINSTALLED", "uninstalled");

  await db.from("audit_log").insert({
    user_id: userId,
    action: "engine.uninstalled",
    resource: engineId,
    detail: { from } as never,
  });

  return { engine_id: engineId, state: "UNINSTALLED" as const };
}
