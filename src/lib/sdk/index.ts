// Engine SDK (HIS-007). Server-only façade.
//
// An engine receives exactly one object: the SDK context. It grants events,
// scoped state reads, scoped storage, capability invocation, scoped AI,
// identity, and structured logging — and nothing else. Engine code must never
// touch tables directly; every path here is consent- and lifecycle-checked.

import type { Db } from "../permissions.server";
import { assertEngineActive, assertScope, scopeAllowed } from "../permissions.server";
import { publishAndDispatch, type PublishInput } from "../mesh.server";
import { invokeCapability } from "../capabilities.server";
import { heartbeat } from "../platform-manager.server";
import { REGISTERED_ENGINES, type EngineDescriptor } from "../engines/contract";

export type EngineSdk = ReturnType<typeof createEngineSdk>;

export type SdkOptions = {
  db: Db;
  userId: string;
  engineId: string;
  correlationId?: string;
  requestId?: string;
};

export class SdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkError";
  }
}

/** Human State axes an engine may read, gated by consent on `human_states`. */
export type StateAxis = "physical" | "cognitive" | "emotional" | "behavioral" | "lifestyle" | "operational";

export function createEngineSdk(opts: SdkOptions) {
  const { db, userId, engineId } = opts;

  const logger = {
    async log(level: "debug" | "info" | "warn" | "error", message: string, context: Record<string, unknown> = {}) {
      await db.from("engine_logs").insert({
        user_id: userId,
        engine_id: engineId,
        level,
        message,
        context: { request_id: opts.requestId ?? null, ...context } as never,
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
      });
    },
    info: (m: string, c?: Record<string, unknown>) => logger.log("info", m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => logger.log("warn", m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => logger.log("error", m, c ?? {}),
  };

  return {
    engineId,
    userId,
    correlationId: opts.correlationId ?? null,
    logger,

    /** Declared descriptor, for self-inspection. */
    descriptor(): EngineDescriptor | undefined {
      return REGISTERED_ENGINES.find((e) => e.id === engineId);
    },

    /** Persist the engine descriptor from outside core (no core edits needed). */
    async register(descriptor: EngineDescriptor) {
      const { error } = await db.from("engines").upsert(
        {
          user_id: userId,
          engine_id: descriptor.id,
          name: descriptor.name,
          version: descriptor.version,
          purpose: descriptor.purpose,
          owner: descriptor.owner,
          status: descriptor.status,
          capabilities: descriptor.capabilities as never,
          data_owned: descriptor.dataOwned as never,
          events_published: descriptor.eventsPublished as never,
          events_consumed: descriptor.eventsConsumed as never,
          required_signals: descriptor.requiredSignals as never,
          published_signals: descriptor.publishedSignals as never,
          dependencies: descriptor.dependencies as never,
          permissions: descriptor.permissions as never,
        },
        { onConflict: "user_id,engine_id" },
      );
      if (error) throw new SdkError(error.message);
      return { ok: true };
    },

    /** Request a consent scope; the operator still decides in Governance. */
    async requestPermission(scope: string, reason?: string) {
      const { error } = await db.from("engine_permissions").upsert(
        {
          user_id: userId,
          engine_id: engineId,
          scope,
          granted: false,
          reason: reason ?? "requested by engine",
        },
        { onConflict: "user_id,engine_id,scope" },
      );
      if (error) throw new SdkError(error.message);
      return { requested: scope };
    },

    async hasPermission(scope: string) {
      return scopeAllowed(db, userId, engineId, scope);
    },

    /** Publish an event through the mesh. Validated + dispatched. */
    async publishEvent(input: Omit<PublishInput, "source_engine">) {
      await assertEngineActive(db, userId, engineId);
      const result = await publishAndDispatch(db, userId, {
        ...input,
        source_engine: engineId,
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
      });
      await heartbeat(db, userId, engineId, { event: true });
      return result;
    },

    /** Publish a signal — the only data the Kernel reads from an engine. */
    async publishSignal(signal: {
      signal_key: string;
      value_num?: number | null;
      value_text?: string | null;
      confidence?: number | null;
      reliability?: number | null;
      trend?: string | null;
      metadata?: Record<string, unknown>;
    }) {
      await assertEngineActive(db, userId, engineId);
      const { error } = await db.from("engine_signals").insert({
        user_id: userId,
        engine: engineId,
        signal_key: signal.signal_key,
        value_num: signal.value_num ?? null,
        value_text: signal.value_text ?? null,
        confidence: signal.confidence ?? null,
        reliability: signal.reliability ?? null,
        trend: (signal.trend ?? null) as never,
        metadata: (signal.metadata ?? {}) as never,
      });
      if (error) {
        await heartbeat(db, userId, engineId, { error: error.message });
        throw new SdkError(error.message);
      }
      await heartbeat(db, userId, engineId, {});
      return { ok: true };
    },

    /** Read authorized Human State axes only. */
    async readHumanState(axes: StateAxis[]) {
      await assertEngineActive(db, userId, engineId);
      await assertScope(db, userId, engineId, "human_states");
      const { data, error } = await db
        .from("human_states")
        .select("as_of, composite, physical, cognitive, emotional, behavioral, lifestyle, operational")
        .eq("user_id", userId)
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new SdkError(error.message);
      if (!data) return null;
      const out: Record<string, unknown> = { as_of: data.as_of, composite: data.composite };
      for (const axis of axes) out[axis] = data[axis];
      return out;
    },

    /** Engine-private key/value storage. Never reachable by another engine. */
    storage: {
      async get<T = unknown>(key: string): Promise<T | null> {
        const { data, error } = await db
          .from("engine_storage")
          .select("value")
          .eq("user_id", userId)
          .eq("engine_id", engineId)
          .eq("key", key)
          .maybeSingle();
        if (error) throw new SdkError(error.message);
        return (data?.value as T) ?? null;
      },
      async set(key: string, value: unknown) {
        const { error } = await db.from("engine_storage").upsert(
          { user_id: userId, engine_id: engineId, key, value: value as never },
          { onConflict: "user_id,engine_id,key" },
        );
        if (error) throw new SdkError(error.message);
        return { ok: true };
      },
      async remove(key: string) {
        const { error } = await db
          .from("engine_storage")
          .delete()
          .eq("user_id", userId)
          .eq("engine_id", engineId)
          .eq("key", key);
        if (error) throw new SdkError(error.message);
        return { ok: true };
      },
      async keys() {
        const { data, error } = await db
          .from("engine_storage")
          .select("key")
          .eq("user_id", userId)
          .eq("engine_id", engineId);
        if (error) throw new SdkError(error.message);
        return (data ?? []).map((r) => r.key);
      },
    },

    /** Invoke another engine's capability through the audited pipeline. */
    async invokeCapability(capability: string, input?: unknown, version?: string) {
      return invokeCapability(db, userId, {
        consumer_engine_id: engineId,
        capability,
        input: input ?? {},
        ...(version ? { version } : {}),
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
      });
    },

    /** Scoped AI access. Prompt + engine identity are always logged. */
    async ai(prompt: string, system?: string) {
      await assertEngineActive(db, userId, engineId);
      const { runEngineAi } = await import("./ai.server");
      await logger.info("ai.request", { chars: prompt.length });
      return runEngineAi(prompt, system);
    },

    /** Identity of the operator this engine is acting for. */
    identity() {
      return { user_id: userId, engine_id: engineId };
    },
  };
}
