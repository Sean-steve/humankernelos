// Engine SDK (HIS-007). Server-only façade.
//
// Engines receive one constrained SDK context. Persisted installation/lifecycle
// remains authoritative; executable capability/event adapters are registered
// through the runtime registry rather than hardcoded into Kernel routing.

import type { Db } from "../permissions.server";
import { assertEngineActive, assertScope, scopeAllowed } from "../permissions.server";
import { publishAndDispatch, type PublishInput } from "../mesh.server";
import { invokeCapability } from "../capabilities.server";
import {
  heartbeat,
  PLATFORM_VERSION,
  SDK_VERSION,
  stateIsOperational,
  type LifecycleState,
} from "../platform-manager.server";
import { REGISTERED_ENGINES, type EngineDescriptor } from "../engines/contract";
import { validateEngineManifest } from "../engines/manifest";
import {
  registerRuntimeCapability,
  registerRuntimeEventHandler,
  registerRuntimeEventSchema,
  type RuntimeCapability,
  type RuntimeEventHandler,
  type RuntimeEventSchema,
} from "../runtime/registry.server";

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

export type StateAxis =
  | "physical"
  | "cognitive"
  | "emotional"
  | "behavioral"
  | "lifestyle"
  | "operational";

export function createEngineSdk(opts: SdkOptions) {
  const { db, userId, engineId } = opts;

  async function installedManifest() {
    const { data, error } = await db
      .from("engines")
      .select(
        "engine_id, name, version, purpose, owner, status, lifecycle_state, capabilities, data_owned, events_published, events_consumed, required_signals, published_signals, dependencies, permissions",
      )
      .eq("user_id", userId)
      .eq("engine_id", engineId)
      .maybeSingle();
    if (error) throw new SdkError(error.message);
    return data;
  }

  async function requireInstalled() {
    const manifest = await installedManifest();
    if (!manifest) {
      throw new SdkError(
        `Engine "${engineId}" must register its manifest before using SDK registration APIs.`,
      );
    }
    return manifest;
  }

  const logger = {
    async log(
      level: "debug" | "info" | "warn" | "error",
      message: string,
      context: Record<string, unknown> = {},
    ) {
      await db.from("engine_logs").insert({
        user_id: userId,
        engine_id: engineId,
        level,
        message,
        context: { request_id: opts.requestId ?? null, ...context } as never,
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
      });
    },
    info: (m: string, c?: Record<string, unknown>) =>
      logger.log("info", m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) =>
      logger.log("warn", m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) =>
      logger.log("error", m, c ?? {}),
  };

  return {
    engineId,
    userId,
    correlationId: opts.correlationId ?? null,
    logger,

    /** Package-catalogue descriptor only; not runtime authority. */
    descriptor(): EngineDescriptor | undefined {
      return REGISTERED_ENGINES.find((e) => e.id === engineId);
    },

    /** Persisted manifest/lifecycle — the runtime authority for this user. */
    manifest: installedManifest,

    /**
     * Register/update the engine manifest without auto-activating the engine.
     * First registration enters REGISTERED/inactive; Platform Manager controls
     * subsequent lifecycle transitions.
     */
    async register(descriptor: EngineDescriptor) {
      const manifest = validateEngineManifest(descriptor);
      if (manifest.id !== engineId) {
        throw new SdkError(
          `SDK engine id "${engineId}" cannot register manifest "${manifest.id}".`,
        );
      }

      const existing = await installedManifest();
      const metadata = {
        name: manifest.name,
        version: manifest.version,
        purpose: manifest.purpose,
        owner: manifest.owner,
        capabilities: manifest.capabilities as never,
        data_owned: manifest.dataOwned as never,
        events_published: manifest.eventsPublished as never,
        events_consumed: manifest.eventsConsumed as never,
        required_signals: manifest.requiredSignals as never,
        published_signals: manifest.publishedSignals as never,
        dependencies: manifest.dependencies as never,
        permissions: manifest.permissions as never,
        platform_version: PLATFORM_VERSION,
        sdk_version: SDK_VERSION,
      };

      if (existing) {
        const { error } = await db
          .from("engines")
          .update(metadata)
          .eq("user_id", userId)
          .eq("engine_id", engineId);
        if (error) throw new SdkError(error.message);
      } else {
        const { error } = await db.from("engines").insert({
          user_id: userId,
          engine_id: engineId,
          ...metadata,
          status: "inactive",
          lifecycle_state: "REGISTERED",
          health: "disabled",
        });
        if (error) throw new SdkError(error.message);
      }

      await db.from("audit_log").insert({
        user_id: userId,
        action: existing ? "engine.manifest_updated" : "engine.registered",
        resource: engineId,
        detail: { version: manifest.version } as never,
      });

      return {
        ok: true,
        lifecycle_state: existing?.lifecycle_state ?? "REGISTERED",
      };
    },

    /** Register executable capability code + persisted discovery metadata. */
    async registerCapability(
      capability: Omit<RuntimeCapability, "provider_engine_id">,
    ) {
      await requireInstalled();
      const runtime: RuntimeCapability = {
        ...capability,
        provider_engine_id: engineId,
      };
      registerRuntimeCapability(runtime);

      const { error } = await db.from("engine_capabilities").upsert(
        {
          user_id: userId,
          provider_engine_id: engineId,
          capability: runtime.capability,
          version: runtime.version,
          required_permission: runtime.required_permission,
          input_schema: { runtime_validator: true } as never,
          output_schema: { runtime_validator: true } as never,
          status: runtime.status,
        },
        {
          onConflict: "user_id,provider_engine_id,capability,version",
        },
      );
      if (error) throw new SdkError(error.message);

      return {
        capability: runtime.capability,
        version: runtime.version,
        provider_engine_id: engineId,
      };
    },

    /** Register a versioned event validator and persist its schema catalogue row. */
    async registerEventSchema(schema: RuntimeEventSchema) {
      await requireInstalled();
      registerRuntimeEventSchema(schema);

      const { error } = await db.from("event_schemas").upsert(
        {
          user_id: userId,
          event_type: schema.type,
          schema_version: schema.version,
          description: schema.description,
          payload_schema: { runtime_validator: true } as never,
          active: true,
        },
        { onConflict: "user_id,event_type,schema_version" },
      );
      if (error) throw new SdkError(error.message);

      return { event_type: schema.type, schema_version: schema.version };
    },

    /** Register executable event handling + persisted subscription metadata. */
    async subscribeEvent(
      eventType: string,
      handler: Omit<RuntimeEventHandler, "engine_id">,
    ) {
      const manifest = await requireInstalled();
      const runtime: RuntimeEventHandler = {
        ...handler,
        engine_id: engineId,
      };
      registerRuntimeEventHandler(eventType, runtime);

      const { error } = await db.from("engine_subscriptions").upsert(
        {
          user_id: userId,
          engine_id: engineId,
          event_type: eventType,
          handler: runtime.handler,
          enabled: stateIsOperational(
            manifest.lifecycle_state as LifecycleState,
          ),
        },
        { onConflict: "user_id,engine_id,event_type,handler" },
      );
      if (error) throw new SdkError(error.message);

      return { event_type: eventType, handler: runtime.handler };
    },

    /** Request a consent scope; the operator still decides in Governance. */
    async requestPermission(scope: string, reason?: string) {
      await requireInstalled();
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
      await requireInstalled();
      return scopeAllowed(db, userId, engineId, scope);
    },

    async requestCapabilityAccess(
      providerEngineId: string,
      capability: string,
      reason?: string,
    ) {
      const scope = `capability:${providerEngineId}.${capability}`;
      return this.requestPermission(
        scope,
        reason ?? `Required to invoke ${providerEngineId}.${capability}`,
      );
    },

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

    async readHumanState(axes: StateAxis[]) {
      await assertEngineActive(db, userId, engineId);
      await assertScope(db, userId, engineId, "human_states");
      const { data, error } = await db
        .from("human_states")
        .select(
          "as_of, composite, physical, cognitive, emotional, behavioral, lifestyle, operational",
        )
        .eq("user_id", userId)
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new SdkError(error.message);
      if (!data) return null;

      const out: Record<string, unknown> = {
        as_of: data.as_of,
        composite: data.composite,
      };
      for (const axis of axes) out[axis] = data[axis];
      return out;
    },

    storage: {
      async get<T = unknown>(key: string): Promise<T | null> {
        await assertEngineActive(db, userId, engineId);
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
        await assertEngineActive(db, userId, engineId);
        const { error } = await db.from("engine_storage").upsert(
          {
            user_id: userId,
            engine_id: engineId,
            key,
            value: value as never,
          },
          { onConflict: "user_id,engine_id,key" },
        );
        if (error) throw new SdkError(error.message);
        return { ok: true };
      },
      async remove(key: string) {
        await assertEngineActive(db, userId, engineId);
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
        await assertEngineActive(db, userId, engineId);
        const { data, error } = await db
          .from("engine_storage")
          .select("key")
          .eq("user_id", userId)
          .eq("engine_id", engineId);
        if (error) throw new SdkError(error.message);
        return (data ?? []).map((r) => r.key);
      },
    },

    async invokeCapability(
      capability: string,
      input?: unknown,
      version?: string,
      providerEngineId?: string,
    ) {
      await assertEngineActive(db, userId, engineId);
      return invokeCapability(db, userId, {
        consumer_engine_id: engineId,
        ...(providerEngineId ? { provider_engine_id: providerEngineId } : {}),
        capability,
        input: input ?? {},
        ...(version ? { version } : {}),
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
      });
    },

    async ai(prompt: string, system?: string) {
      await assertEngineActive(db, userId, engineId);
      const { runEngineAi } = await import("./ai.server");
      await logger.info("ai.request", { chars: prompt.length });
      return runEngineAi(prompt, system);
    },

    identity() {
      return { user_id: userId, engine_id: engineId };
    },
  };
}
