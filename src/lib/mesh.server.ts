// Platform Event Mesh (Constitution Art. VII / HIS-004). Server-only.
//
// Persisted subscriptions determine delivery. Executable handlers and payload
// validators are registered at runtime through the generic adapter registry.
// This keeps the Mesh core unaware of specific external engines.

import {
  fuseSignals,
  rankPriorities,
  type CheckIn,
  type RawSignal,
} from "./orchestrator.server";
import { adherenceRate, type OutcomeRow } from "./learning.server";
import { refreshLearningMemory } from "./learning-memory.server";
import {
  assertEngineActive,
  engineIsActive,
  scopeAllowed,
  type Db,
} from "./permissions.server";
import { materializeHumanState } from "./hsie.server";
import {
  EVENT_SCHEMAS,
  CURRENT_SCHEMA_VERSION,
  EventSchemaError,
} from "./events/schemas";
import {
  listRuntimeEventHandlers,
  registerRuntimeEventHandler,
  registerRuntimeEventSchema,
  resolveRuntimeEventHandler,
  resolveRuntimeEventSchema,
  type RuntimeEventHandler,
} from "./runtime/registry.server";

export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = [250, 1000, 4000];

export function backoffFor(attempt: number) {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 4000;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type MeshEvent = {
  id: string;
  type: string;
  source_engine: string;
  payload: Record<string, unknown>;
  correlation_id: string;
};

export type MeshHandler = RuntimeEventHandler;

/** Recompute the fused view + conflicts and persist an orchestrator run. */
export async function runAndPersistOrchestrator(db: Db, userId: string) {
  const [{ data: signals }, { data: checkIn }] = await Promise.all([
    db
      .from("engine_signals")
      .select(
        "engine, signal_key, value_num, value_text, confidence, reliability, trend, occurred_at",
      )
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(300),
    db
      .from("check_ins")
      .select("energy, focus, recovery, stress, mood, sleep_hours, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { fused, conflicts } = fuseSignals(
    (signals ?? []) as unknown as RawSignal[],
    (checkIn ?? null) as unknown as CheckIn,
  );
  const priorities = rankPriorities(fused);

  const { data: run, error } = await db
    .from("orchestrator_runs")
    .insert({
      user_id: userId,
      fused_axes: fused as never,
      conflicts: conflicts as never,
      priorities: priorities as never,
      signal_count: (signals ?? []).length,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (conflicts.length > 0) {
    const { error: cErr } = await db.from("signal_conflicts").insert(
      conflicts.map((c) => ({
        user_id: userId,
        run_id: run.id,
        axis: c.axis,
        competing: c.competing as never,
        resolution: c.resolution,
        reason: c.reason,
        severity: c.severity,
      })),
    );
    if (cErr) throw new Error(cErr.message);
  }

  // The Orchestrator and HSIE share one fused truth. Every successful fusion
  // materializes the canonical HSV and its evidence trail.
  const hsv = await materializeHumanState(db, userId, fused);

  // Human State remains Kernel-owned. External engines receive only their
  // adapter-defined minimum-necessary projection through Event Mesh delivery.
  if (await engineIsActive(db, userId, "hsie")) {
    await publishAndDispatch(db, userId, {
      type: "HumanStateUpdated",
      source_engine: "hsie",
      payload: {
        as_of: hsv.as_of,
        coverage: hsv.coverage,
        confidence: hsv.confidence,
        source_count: hsv.source_count,
      },
      idempotency_key: `human-state:${run.id}`,
    });
  }

  return {
    run_id: run.id as string,
    generated_at: run.generated_at as string,
    signal_count: (signals ?? []).length,
    fused,
    conflicts,
    priorities,
  };
}

const orchestratorFuse: MeshHandler = {
  engine_id: "orchestrator",
  handler: "fuse_signals",
  scope: "engine_signals",
  run: async (db, userId) => {
    await runAndPersistOrchestrator(db, userId);
  },
};

const learningAdherence: MeshHandler = {
  engine_id: "learning",
  handler: "adherence_recompute",
  scope: "recommendation_outcomes",
  run: async (db, userId) => {
    const { data: outcomes, error } = await db
      .from("recommendation_outcomes")
      .select("recommendation_id, executed, effect, friction, measured_at")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const rate = adherenceRate((outcomes ?? []) as unknown as OutcomeRow[]);
    if (rate === null) return;

    const { error: signalError } = await db.from("engine_signals").insert({
      user_id: userId,
      engine: "learning",
      signal_key: "learning.adherence",
      value_num: rate,
      confidence: Math.min(0.9, 0.4 + (outcomes?.length ?? 0) * 0.05),
    });
    if (signalError) throw new Error(signalError.message);

    // Measured outcomes are the only source allowed to promote learning into
    // durable personal pattern memory.
    await refreshLearningMemory(db, userId);
  },
};

/** Built-in adapters are bootstrapped through the same runtime registry API. */
export const EVENT_HANDLERS: Record<string, MeshHandler[]> = {
  CheckInSubmitted: [orchestratorFuse],
  MealLogged: [orchestratorFuse],
  WorkoutCompleted: [orchestratorFuse],
  RoutineCompleted: [orchestratorFuse],
  OutcomeMeasured: [learningAdherence, orchestratorFuse],
};

for (const [eventType, handlers] of Object.entries(EVENT_HANDLERS)) {
  for (const handler of handlers) registerRuntimeEventHandler(eventType, handler);
}
for (const schema of Object.values(EVENT_SCHEMAS)) {
  registerRuntimeEventSchema(schema);
}

export function subscriptionSeeds() {
  return listRuntimeEventHandlers().map(({ event_type, handler }) => ({
    event_type,
    engine_id: handler.engine_id,
    handler: handler.handler,
  }));
}

export function resolveEventHandler(
  eventType: string,
  engineId: string,
  handler: string,
) {
  return resolveRuntimeEventHandler(eventType, engineId, handler);
}

export type DeliveryResult = {
  engine_id: string;
  handler: string;
  status:
    | "delivered"
    | "failed"
    | "dead_letter"
    | "skipped_disabled"
    | "denied_consent";
  attempts: number;
  error?: string;
};

async function upsertDelivery(
  db: Db,
  userId: string,
  event: MeshEvent,
  engine_id: string,
  handler: string,
  patch: {
    status: string;
    attempts: number;
    last_error: string | null;
    dead_letter: boolean;
    next_attempt_at?: string | null;
  },
) {
  const { error } = await db.from("hos_event_deliveries").upsert(
    {
      user_id: userId,
      event_id: event.id,
      correlation_id: event.correlation_id,
      engine_id,
      handler,
      ...patch,
    },
    { onConflict: "event_id,engine_id,handler" },
  );
  if (error) throw new Error(error.message);
}

/** Deliver one event to one handler with bounded retries. */
export async function deliver(
  db: Db,
  userId: string,
  event: MeshEvent,
  h: MeshHandler,
  startingAttempts = 0,
): Promise<DeliveryResult> {
  if (!(await engineIsActive(db, userId, h.engine_id))) {
    await upsertDelivery(db, userId, event, h.engine_id, h.handler, {
      status: "skipped_disabled",
      attempts: startingAttempts,
      last_error: "engine is not operational",
      dead_letter: false,
    });
    return {
      engine_id: h.engine_id,
      handler: h.handler,
      status: "skipped_disabled",
      attempts: startingAttempts,
    };
  }

  if (h.scope && !(await scopeAllowed(db, userId, h.engine_id, h.scope))) {
    await upsertDelivery(db, userId, event, h.engine_id, h.handler, {
      status: "denied_consent",
      attempts: startingAttempts,
      last_error: `missing consent for scope "${h.scope}"`,
      dead_letter: false,
    });
    await db.from("audit_log").insert({
      user_id: userId,
      action: "permission.denied",
      resource: `${h.engine_id}:${h.scope}`,
      detail: { event_type: event.type, handler: h.handler } as never,
    });
    return {
      engine_id: h.engine_id,
      handler: h.handler,
      status: "denied_consent",
      attempts: startingAttempts,
    };
  }

  let attempts = startingAttempts;
  let lastError = "";

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      await h.run(db, userId, event);
      await upsertDelivery(db, userId, event, h.engine_id, h.handler, {
        status: "delivered",
        attempts,
        last_error: null,
        dead_letter: false,
        next_attempt_at: null,
      });
      return {
        engine_id: h.engine_id,
        handler: h.handler,
        status: "delivered",
        attempts,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempts < MAX_ATTEMPTS) {
        const wait = backoffFor(attempts - 1);
        await upsertDelivery(db, userId, event, h.engine_id, h.handler, {
          status: "failed",
          attempts,
          last_error: lastError,
          dead_letter: false,
          next_attempt_at: new Date(Date.now() + wait).toISOString(),
        });
        await sleep(wait);
      }
    }
  }

  await upsertDelivery(db, userId, event, h.engine_id, h.handler, {
    status: "dead_letter",
    attempts,
    last_error: lastError,
    dead_letter: true,
  });
  await db.from("audit_log").insert({
    user_id: userId,
    action: "event.dead_lettered",
    resource: `${event.type}->${h.engine_id}.${h.handler}`,
    detail: { event_id: event.id, error: lastError } as never,
  });

  return {
    engine_id: h.engine_id,
    handler: h.handler,
    status: "dead_letter",
    attempts,
    error: lastError,
  };
}

/** Persisted subscriptions are the sole delivery authority. */
async function subscribersFor(
  db: Db,
  userId: string,
  eventType: string,
): Promise<MeshHandler[]> {
  const { data, error } = await db
    .from("engine_subscriptions")
    .select("engine_id, handler")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("enabled", true);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => resolveEventHandler(eventType, row.engine_id, row.handler))
    .filter((handler): handler is MeshHandler => !!handler);
}

export type PublishInput = {
  type: string;
  source_engine: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  idempotency_key?: string;
  schema_version?: number;
  occurred_at?: string;
};

async function validateRegisteredEvent(
  db: Db,
  userId: string,
  type: string,
  payload: Record<string, unknown>,
  version: number,
) {
  const runtimeSchema = resolveRuntimeEventSchema(type, version);
  if (!runtimeSchema) {
    throw new EventSchemaError(
      `No runtime validator is registered for event "${type}" version ${version}.`,
    );
  }

  const { data: persisted, error } = await db
    .from("event_schemas")
    .select("active")
    .eq("user_id", userId)
    .eq("event_type", type)
    .eq("schema_version", version)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!persisted) {
    const { error: insertError } = await db.from("event_schemas").insert({
      user_id: userId,
      event_type: type,
      schema_version: version,
      description: runtimeSchema.description,
      payload_schema: { runtime_validator: true } as never,
      active: true,
    });
    if (insertError) throw new Error(insertError.message);
  } else if (!persisted.active) {
    throw new EventSchemaError(`Event schema "${type}" version ${version} is disabled.`);
  }

  const parsed = runtimeSchema.payload.safeParse(payload);
  if (!parsed.success) {
    throw new EventSchemaError(
      `Payload for "${type}" failed validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "payload"} ${issue.message}`)
        .join("; ")}`,
    );
  }

  return parsed.data as Record<string, unknown>;
}

/** Publish an event and dispatch it. The only sanctioned way to emit. */
export async function publishAndDispatch(
  db: Db,
  userId: string,
  input: PublishInput,
) {
  await assertEngineActive(db, userId, input.source_engine);

  const schema_version = input.schema_version ?? CURRENT_SCHEMA_VERSION;
  const payload = await validateRegisteredEvent(
    db,
    userId,
    input.type,
    input.payload ?? {},
    schema_version,
  );

  const insert = {
    user_id: userId,
    type: input.type,
    source_engine: input.source_engine,
    payload: payload as never,
    schema_version,
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
    ...(input.occurred_at ? { occurred_at: input.occurred_at } : {}),
  };

  const { data, error } = await db
    .from("hos_events")
    .insert(insert)
    .select("id, type, source_engine, payload, correlation_id")
    .single();

  if (error) {
    if (error.code === "23505" && input.idempotency_key) {
      return {
        event_id: null,
        deduped: true,
        deliveries: [] as DeliveryResult[],
      };
    }
    throw new Error(error.message);
  }

  const event: MeshEvent = {
    id: data.id as string,
    type: data.type as string,
    source_engine: data.source_engine as string,
    payload: (data.payload ?? {}) as Record<string, unknown>,
    correlation_id: data.correlation_id as string,
  };

  const handlers = await subscribersFor(db, userId, event.type);
  const deliveries: DeliveryResult[] = [];
  for (const handler of handlers) {
    deliveries.push(await deliver(db, userId, event, handler));
  }

  return { event_id: event.id, deduped: false, deliveries };
}
