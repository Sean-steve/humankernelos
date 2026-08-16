// Capability Registry + Invocation Pipeline (HIS-006 §6–7). Server-only.
//
// A capability is a versioned, permissioned function published by a provider
// engine and invoked by a consumer engine. Every invocation passes the seven
// spec checks in order and is written to the invocation ledger.

import { z } from "zod";
import { REGISTERED_ENGINES } from "./engines/contract";
import { engineIsActive, scopeAllowed, type Db } from "./permissions.server";
import { runAndPersistOrchestrator } from "./mesh.server";
import { adherenceRate, type OutcomeRow } from "./learning.server";

export type CapabilityDescriptor = {
  id: string;
  provider_engine_id: string;
  capability: string;
  version: string;
  description: string;
  /** Data scope the *provider* must hold consent for. */
  required_permission: string | null;
  input: z.ZodTypeAny;
  output: z.ZodTypeAny;
  status: "available" | "deprecated";
  run: (db: Db, userId: string, input: unknown) => Promise<unknown>;
};

const noInput = z.object({}).default({});

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
      return { run_id: r.run_id, signal_count: r.signal_count, generated_at: r.generated_at };
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
    output: z.object({ kcal: z.number(), protein_g: z.number(), water_ml: z.number() }),
    status: "available",
    run: async (db, userId) => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await db
        .from("nutrition_logs")
        .select("kcal, protein_g, water_ml")
        .eq("user_id", userId)
        .gte("occurred_at", since.toISOString());
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
      const { data } = await db
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(200);
      const rows = (data ?? []) as unknown as OutcomeRow[];
      return { rate: adherenceRate(rows), sample: rows.length };
    },
  },
];

export function findCapability(capability: string, version?: string) {
  return CAPABILITIES.find(
    (c) => c.capability === capability && (!version || c.version === version),
  );
}

export function capabilitySeeds() {
  return CAPABILITIES.map((c) => ({
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

/** The invocation pipeline. Runs the seven spec checks, then dispatches. */
export async function invokeCapability(db: Db, userId: string, input: InvokeInput) {
  const started = Date.now();
  const fail = async (code: CapabilityError["code"], message: string, provider = "unknown") => {
    await record(db, userId, input, provider, code, started, message);
    throw new CapabilityError(message, code);
  };

  // 1. consumer engine exists
  const consumer = REGISTERED_ENGINES.find((e) => e.id === input.consumer_engine_id);
  if (!consumer) return fail("unknown_consumer", `Unknown engine "${input.consumer_engine_id}".`);

  // 2. consumer engine enabled
  if (!(await engineIsActive(db, userId, consumer.id)))
    return fail("consumer_disabled", `Engine "${consumer.id}" is not active.`, consumer.id);

  // 3. capability exists
  const cap = findCapability(input.capability);
  if (!cap) return fail("unknown_capability", `Unknown capability "${input.capability}".`);

  // 4. version compatible
  if (input.version && !versionCompatible(input.version, cap.version))
    return fail(
      "version_mismatch",
      `Capability "${cap.capability}" is at ${cap.version}; ${input.version} requested.`,
      cap.provider_engine_id,
    );

  // 5. provider healthy (active + not deprecated)
  if (cap.status !== "available" || !(await engineIsActive(db, userId, cap.provider_engine_id)))
    return fail(
      "provider_unhealthy",
      `Provider "${cap.provider_engine_id}" cannot currently serve "${cap.capability}".`,
      cap.provider_engine_id,
    );

  // 6. permission held for the data the capability touches
  if (
    cap.required_permission &&
    !(await scopeAllowed(db, userId, cap.provider_engine_id, cap.required_permission))
  ) {
    await db.from("audit_log").insert({
      user_id: userId,
      action: "permission.denied",
      resource: `${cap.provider_engine_id}:${cap.required_permission}`,
      detail: { capability: cap.capability, consumer: consumer.id } as never,
    });
    return fail(
      "not_permitted",
      `Consent required: grant "${cap.required_permission}" to "${cap.provider_engine_id}" on the Governance page.`,
      cap.provider_engine_id,
    );
  }

  // 7. input valid
  const parsed = cap.input.safeParse(input.input ?? {});
  if (!parsed.success)
    return fail("invalid_input", `Invalid input for "${cap.capability}".`, cap.provider_engine_id);

  try {
    const raw = await cap.run(db, userId, parsed.data);
    const out = cap.output.parse(raw);
    await record(db, userId, input, cap.provider_engine_id, "succeeded", started);
    return { capability: cap.capability, version: cap.version, output: out };
  } catch (e) {
    // Provider internals never leak to the caller.
    const detail = e instanceof Error ? e.message : String(e);
    await record(db, userId, input, cap.provider_engine_id, "provider_failed", started, detail);
    throw new CapabilityError(
      `Capability "${cap.capability}" failed inside provider "${cap.provider_engine_id}".`,
      "provider_failed",
    );
  }
}
