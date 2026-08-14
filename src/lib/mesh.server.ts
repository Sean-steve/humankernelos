// Platform Event Mesh (Constitution Art. VII / HIS-004). Server-only.
// Events are published once (idempotency key), then dispatched to every
// subscribed, active, consented engine handler with retries and dead-lettering.

import {
  fuseSignals,
  rankPriorities,
  type CheckIn,
  type RawSignal,
} from "./orchestrator.server";
import { adherenceRate, type OutcomeRow } from "./learning.server";
import {
  assertEngineActive,
  engineIsActive,
  scopeAllowed,
  type Db,
} from "./permissions.server";

export const MAX_ATTEMPTS = 3;

export type MeshEvent = {
  id: string;
  type: string;
  source_engine: string;
  payload: Record<string, unknown>;
  correlation_id: string;
};

export type MeshHandler = {
  engine_id: string;
  handler: string;
  /** Data scope the handler needs consent for; null = owns its own data. */
  scope: string | null;
  run: (db: Db, userId: string, event: MeshEvent) => Promise<void>;
};

/** Recompute the fused view + conflicts and persist an orchestrator run. */
export async function runAndPersistOrchestrator(db: Db, userId: string) {
  const [{ data: signals }, { data: checkIn }] = await Promise.all([
    db
      .from("engine_signals")
      .select("engine, signal_key, value_num, value_text, confidence, reliability, trend, occurred_at")
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
    const { data: outcomes } = await db
      .from("recommendation_outcomes")
      .select("recommendation_id, executed, effect, friction, measured_at")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(200);

    const rate = adherenceRate((outcomes ?? []) as unknown as OutcomeRow[]);
    if (rate === null) return;

    const { error } = await db.from("engine_signals").insert({
      user_id: userId,
      engine: "learning",
      signal_key: "learning.adherence",
      value_num: rate,
      confidence: Math.min(0.9, 0.4 + (outcomes?.length ?? 0) * 0.05),
    });
    if (error) throw new Error(error.message);
  },
};

/** Event type -> handlers. The single source of truth for subscriptions. */
export const EVENT_HANDLERS: Record<string, MeshHandler[]> = {
  CheckInSubmitted: [orchestratorFuse],
  MealLogged: [orchestratorFuse],
  WorkoutCompleted: [orchestratorFuse],
  RoutineCompleted: [orchestratorFuse],
  OutcomeMeasured: [learningAdherence, orchestratorFuse],
};

export function subscriptionSeeds() {
  return Object.entries(EVENT_HANDLERS).flatMap(([event_type, handlers]) =>
    handlers.map((h) => ({ event_type, engine_id: h.engine_id, handler: h.handler })),
  );
}

function findHandler(eventType: string, engineId: string, handler: string) {
  return (EVENT_HANDLERS[eventType] ?? []).find(
    (h) => h.engine_id === engineId && h.handler === handler,
  );
}

export type DeliveryResult = {
  engine_id: string;
  handler: string;
  status: "delivered" | "failed" | "dead_letter" | "skipped_disabled" | "denied_consent";
  attempts: number;
  error?: string;
};

async function upsertDelivery(
  db: Db,
  userId: string,
  event: MeshEvent,
  engine_id: string,
  handler: string,
  patch: { status: string; attempts: number; last_error: string | null; dead_letter: boolean },
) {
  await db.from("hos_event_deliveries").upsert(
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
      last_error: "engine is not active",
      dead_letter: false,
    });
    return { engine_id: h.engine_id, handler: h.handler, status: "skipped_disabled", attempts: startingAttempts };
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
    return { engine_id: h.engine_id, handler: h.handler, status: "denied_consent", attempts: startingAttempts };
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
      });
      return { engine_id: h.engine_id, handler: h.handler, status: "delivered", attempts };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
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

/** Resolve subscribers for an event: persisted subscriptions, else declared. */
async function subscribersFor(db: Db, userId: string, eventType: string): Promise<MeshHandler[]> {
  const { data } = await db
    .from("engine_subscriptions")
    .select("engine_id, handler, enabled")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("enabled", true);

  if (data && data.length > 0) {
    return data
      .map((r) => findHandler(eventType, r.engine_id, r.handler))
      .filter((h): h is MeshHandler => !!h);
  }
  return EVENT_HANDLERS[eventType] ?? [];
}

export type PublishInput = {
  type: string;
  source_engine: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  idempotency_key?: string;
  schema_version?: number;
};

/** Publish an event and dispatch it. The only sanctioned way to emit. */
export async function publishAndDispatch(db: Db, userId: string, input: PublishInput) {
  await assertEngineActive(db, userId, input.source_engine);

  const insert = {
    user_id: userId,
    type: input.type,
    source_engine: input.source_engine,
    payload: (input.payload ?? {}) as never,
    schema_version: input.schema_version ?? 1,
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
  };

  const { data, error } = await db
    .from("hos_events")
    .insert(insert)
    .select("id, type, source_engine, payload, correlation_id")
    .single();

  if (error) {
    // Duplicate idempotency key: the event already exists — treat as success.
    if (error.code === "23505" && input.idempotency_key) {
      return { event_id: null, deduped: true, deliveries: [] as DeliveryResult[] };
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
  for (const h of handlers) {
    deliveries.push(await deliver(db, userId, event, h));
  }

  return { event_id: event.id, deduped: false, deliveries };
}
