// Capability Registry + Invocation Pipeline (HIS-006 §6–7). Server-only.
//
// Persisted engine_capabilities rows are authoritative for discovery and
// availability. Executable handlers are supplied by the runtime adapter
// registry, allowing an engine package to register capabilities without
// adding provider-specific branches to this core pipeline.

import { z } from "zod";
import { engineIsActive, scopeAllowed, type Db } from "./permissions.server";
import { runAndPersistOrchestrator } from "./mesh.server";
import { adherenceRate, type OutcomeRow } from "./learning.server";
import {
  listRuntimeCapabilities,
  registerRuntimeCapability,
  resolveRuntimeCapability,
  type RuntimeCapability,
} from "./runtime/registry.server";

export type CapabilityDescriptor = RuntimeCapability;

const noInput = z.object({}).default({});

/** Built-in adapters are package catalogue entries, not runtime authority. */
export const CAPABILITIES: CapabilityDescriptor[] = [
  {
    id: "orchestrator.fuse_state@1.0.0",
    provider_engine_id: "orchestrator",
    capability: "fuse_state",
    version: "1.0.0",
    description: "Fuse all engine signals into the current human state and priorities.",
    required_permission: "engine_signals",
    input: noInput,
    output: z.object({
      run_id: z.string(),
      signal_count: z.number(),
      generated_at: z.string(),
    }),
    status: "available",
    run: async (db, userId) => {
      const r = await runAndPersistOrchestrator(db, userId);
      return {
        run_id: r.run_id,
        signal_count: r.signal_count,
        generated_at: r.generated_at,
      };
    },
  },
  {
    id: "nutrition.daily_macros@1.0.0",
    provider_engine_id: "nutrition",
    capability: "daily_macros",
    version: "1.0.0",
    description: "Return today's calories, protein and hydration totals.",
    required_permission: null,
    input: noInput,
    output: z.object({
      kcal: z.number(),
      protein_g: z.number(),
      water_ml: z.number(),
    }),
    status: "available",
    run: async (db, userId) => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data, error } = await db
        .from("nutrition_logs")
        .select("kcal, protein_g, water_ml")
        .eq("user_id", userId)
        .gte("occurred_at", since.toISOString());
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return {
        kcal: rows.reduce((s, r) => s + (r.kcal ?? 0), 0),
        protein_g: rows.reduce((s, r) => s + (r.protein_g ?? 0), 0),
        water_ml: rows.reduce((s, r) => s + (r.water_ml ?? 0), 0),
      };
    },
  },
  {
    id: "learning.adherence_rate@1.0.0",
    provider_engine_id: "learning",
    capability: "adherence_rate",
    version: "1.0.0",
    description: "Share of recommendations actually executed, 0..1.",
    required_permission: "recommendation_outcomes",
    input: noInput,
    output: z.object({ rate: z.number().nullable(), sample: z.number() }),
    status: "available",
    run: async (db, userId) => {
      const { data, error } = await db
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as OutcomeRow[];
      return { rate: adherenceRate(rows), sample: rows.length };
    },
  },
];

for (const capability of CAPABILITIES) registerRuntimeCapability(capability);

export function findCapability(
  providerEngineId: string,
  capability: string,
  version?: string,
) {
  return resolveRuntimeCapability(providerEngineId, capability, version);
}

export function capabilitySeeds() {
  return listRuntimeCapabilities().map((c) => ({
    provider_engine_id: c.provider_engine_id,
    capability: c.capability,
    version: c.version,
    required_permission: c.required_permission,
    status: c.status,
  }));
}

export class CapabilityError extends Error {
  constructor(
    message: string,
    public code:
      | "unknown_consumer"
      | "consumer_disabled"
      | "unknown_capability"
      | "ambiguous_provider"
      | "provider_unavailable"
      | "provider_unhealthy"
      | "not_permitted"
      | "invalid_input"
      | "version_mismatch"
      | "provider_failed",
  ) {
    super(message);
    this.name = "CapabilityError";
  }
}

export type InvokeInput = {
  consumer_engine_id: string;
  provider_engine_id?: string;
  capability: string;
  version?: string;
  input?: unknown;
  correlation_id?: string;
};

/** Version compatibility: same major, provider minor >= requested minor. */
export function versionCompatible(requested: string, provided: string) {
  const [rMaj, rMin = "0"] = requested.split(".");
  const [pMaj, pMin = "0"] = provided.split(".");
  if (rMaj !== pMaj) return false;
  return Number(pMin) >= Number(rMin);
}

function semverParts(v: string) {
  return v.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareSemver(a: string, b: string) {
  const aa = semverParts(a);
  const bb = semverParts(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const delta = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

async function record(
  db: Db,
  userId: string,
  input: InvokeInput,
  provider: string,
  status: string,
  started: number,
  error?: string,
) {
  await db.from("capability_invocations").insert({
    user_id: userId,
    consumer_engine_id: input.consumer_engine_id,
    provider_engine_id: provider,
    capability: input.capability,
    status,
    duration_ms: Math.max(0, Date.now() - started),
    error: error ?? null,
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
  });
}

async function resolvePersistedCapability(
  db: Db,
  userId: string,
  input: InvokeInput,
) {
  let query = db
    .from("engine_capabilities")
    .select("provider_engine_id, capability, version, required_permission, status")
    .eq("user_id", userId)
    .eq("capability", input.capability)
    .eq("status", "available");

  if (input.provider_engine_id) {
    query = query.eq("provider_engine_id", input.provider_engine_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (row) => !input.version || versionCompatible(input.version, row.version),
  );

  if ((data ?? []).length > 0 && rows.length === 0 && input.version) {
    return { kind: "version_mismatch" as const, rows: data ?? [] };
  }

  if (rows.length === 0) return { kind: "missing" as const, rows: [] };

  const providers = new Set(rows.map((row) => row.provider_engine_id));
  if (!input.provider_engine_id && providers.size > 1) {
    return { kind: "ambiguous" as const, rows };
  }

  rows.sort((a, b) => compareSemver(b.version, a.version));
  return { kind: "resolved" as const, row: rows[0]! };
}

/** Persisted discovery + lifecycle/consent gates + runtime adapter dispatch. */
export async function invokeCapability(db: Db, userId: string, input: InvokeInput) {
  const started = Date.now();
  const fail = async (
    code: CapabilityError["code"],
    message: string,
    provider = "unknown",
  ) => {
    await record(db, userId, input, provider, code, started, message);
    throw new CapabilityError(message, code);
  };

  // 1. consumer must be actually installed for this user.
  const { data: consumer, error: consumerError } = await db
    .from("engines")
    .select("engine_id")
    .eq("user_id", userId)
    .eq("engine_id", input.consumer_engine_id)
    .maybeSingle();
  if (consumerError) throw new Error(consumerError.message);
  if (!consumer) {
    return fail("unknown_consumer", `Engine "${input.consumer_engine_id}" is not installed.`);
  }

  // 2. installed consumer must be operational.
  if (!(await engineIsActive(db, userId, consumer.engine_id))) {
    return fail(
      "consumer_disabled",
      `Engine "${consumer.engine_id}" is not operational.`,
      consumer.engine_id,
    );
  }

  // 3–4. capability/provider/version are discovered from persisted registry.
  const persisted = await resolvePersistedCapability(db, userId, input);
  if (persisted.kind === "missing") {
    return fail("unknown_capability", `Capability "${input.capability}" is not registered.`);
  }
  if (persisted.kind === "version_mismatch") {
    return fail(
      "version_mismatch",
      `No compatible registered version of "${input.capability}" satisfies "${input.version}".`,
    );
  }
  if (persisted.kind === "ambiguous") {
    return fail(
      "ambiguous_provider",
      `Capability "${input.capability}" has multiple providers; specify provider_engine_id.`,
    );
  }

  const registered = persisted.row;

  // 5. provider lifecycle is authoritative.
  if (!(await engineIsActive(db, userId, registered.provider_engine_id))) {
    return fail(
      "provider_unhealthy",
      `Provider "${registered.provider_engine_id}" is not operational.`,
      registered.provider_engine_id,
    );
  }

  // 6a. the consumer must be explicitly authorized to invoke this capability.
  // Kernel-owned consumers retain the existing trusted-default behavior;
  // external engines fail closed until the operator grants this scope.
  const invocationScope = `capability:${registered.provider_engine_id}.${registered.capability}`;
  if (!(await scopeAllowed(db, userId, consumer.engine_id, invocationScope))) {
    await db.from("audit_log").insert({
      user_id: userId,
      action: "permission.denied",
      resource: `${consumer.engine_id}:${invocationScope}`,
      detail: {
        capability: registered.capability,
        provider: registered.provider_engine_id,
        consumer: consumer.engine_id,
      } as never,
    });
    return fail(
      "not_permitted",
      `Engine "${consumer.engine_id}" is not authorized for "${invocationScope}".`,
      registered.provider_engine_id,
    );
  }

  // 6b. provider-side data consent is evaluated before provider code executes.
  if (
    registered.required_permission &&
    !(await scopeAllowed(
      db,
      userId,
      registered.provider_engine_id,
      registered.required_permission,
    ))
  ) {
    await db.from("audit_log").insert({
      user_id: userId,
      action: "permission.denied",
      resource: `${registered.provider_engine_id}:${registered.required_permission}`,
      detail: {
        capability: registered.capability,
        consumer: consumer.engine_id,
      } as never,
    });
    return fail(
      "not_permitted",
      `Consent required for "${registered.required_permission}".`,
      registered.provider_engine_id,
    );
  }

  // Runtime code is resolved separately from persisted metadata.
  const runtime = resolveRuntimeCapability(
    registered.provider_engine_id,
    registered.capability,
    registered.version,
  );
  if (!runtime || runtime.status !== "available") {
    return fail(
      "provider_unavailable",
      `Provider "${registered.provider_engine_id}" has no loaded runtime adapter for "${registered.capability}@${registered.version}".`,
      registered.provider_engine_id,
    );
  }

  // 7. validate the provider contract before domain logic.
  const parsed = runtime.input.safeParse(input.input ?? {});
  if (!parsed.success) {
    return fail(
      "invalid_input",
      `Invalid input for "${registered.capability}".`,
      registered.provider_engine_id,
    );
  }

  try {
    const raw = await runtime.run(db, userId, parsed.data);
    const out = runtime.output.parse(raw);
    await record(
      db,
      userId,
      input,
      registered.provider_engine_id,
      "succeeded",
      started,
    );
    return {
      capability: registered.capability,
      provider_engine_id: registered.provider_engine_id,
      version: registered.version,
      output: out,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await record(
      db,
      userId,
      input,
      registered.provider_engine_id,
      "provider_failed",
      started,
      detail,
    );
    throw new CapabilityError(
      `Capability "${registered.capability}" failed inside provider "${registered.provider_engine_id}".`,
      "provider_failed",
    );
  }
}
