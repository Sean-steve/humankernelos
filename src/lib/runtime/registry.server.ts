import type { ZodTypeAny } from "zod";
import type { Db } from "../permissions.server";

export type RuntimeCapability = {
  id: string;
  provider_engine_id: string;
  capability: string;
  version: string;
  description: string;
  required_permission: string | null;
  input: ZodTypeAny;
  output: ZodTypeAny;
  status: "available" | "deprecated";
  run: (
    db: Db,
    userId: string,
    input: unknown,
    context?: { correlationId?: string },
  ) => Promise<unknown>;
};

export type RuntimeEventHandler = {
  engine_id: string;
  handler: string;
  scope: string | null;
  run: (db: Db, userId: string, event: {
    id: string;
    type: string;
    source_engine: string;
    payload: Record<string, unknown>;
    correlation_id: string;
  }) => Promise<void>;
};

export type RuntimeEventSchema = {
  type: string;
  version: number;
  description: string;
  payload: ZodTypeAny;
};

export type RuntimeLifecycleAdapter = {
  engine_id: string;
  beforeTransition?: (
    db: Db,
    userId: string,
    from: string,
    to: string,
  ) => Promise<void>;
  health?: (db: Db, userId: string) => Promise<{
    health: "healthy" | "degraded" | "unresponsive" | "failed";
    note?: string;
  }>;
};

const capabilities = new Map<string, RuntimeCapability>();
const eventHandlers = new Map<string, RuntimeEventHandler>();
const eventSchemas = new Map<string, RuntimeEventSchema>();
const lifecycleAdapters = new Map<string, RuntimeLifecycleAdapter>();

function capabilityKey(provider: string, capability: string, version: string) {
  return `${provider}::${capability}::${version}`;
}

function eventHandlerKey(eventType: string, engineId: string, handler: string) {
  return `${eventType}::${engineId}::${handler}`;
}

function eventSchemaKey(eventType: string, version: number) {
  return `${eventType}::${version}`;
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

export function registerRuntimeCapability(capability: RuntimeCapability) {
  capabilities.set(
    capabilityKey(capability.provider_engine_id, capability.capability, capability.version),
    capability,
  );
  return capability;
}

export function resolveRuntimeCapability(
  providerEngineId: string,
  capability: string,
  version?: string,
): RuntimeCapability | undefined {
  if (version) {
    return capabilities.get(capabilityKey(providerEngineId, capability, version));
  }

  return Array.from(capabilities.values())
    .filter(
      (item) =>
        item.provider_engine_id === providerEngineId &&
        item.capability === capability &&
        item.status === "available",
    )
    .sort((a, b) => compareSemver(b.version, a.version))[0];
}

export function listRuntimeCapabilities() {
  return Array.from(capabilities.values());
}

export function registerRuntimeEventHandler(eventType: string, handler: RuntimeEventHandler) {
  eventHandlers.set(eventHandlerKey(eventType, handler.engine_id, handler.handler), handler);
  return handler;
}

export function resolveRuntimeEventHandler(
  eventType: string,
  engineId: string,
  handler: string,
): RuntimeEventHandler | undefined {
  return eventHandlers.get(eventHandlerKey(eventType, engineId, handler));
}

export function listRuntimeEventHandlers(eventType?: string) {
  const rows = Array.from(eventHandlers.entries()).map(([key, handler]) => ({
    event_type: key.split("::")[0]!,
    handler,
  }));
  return eventType ? rows.filter((row) => row.event_type === eventType) : rows;
}

export function registerRuntimeEventSchema(schema: RuntimeEventSchema) {
  eventSchemas.set(eventSchemaKey(schema.type, schema.version), schema);
  return schema;
}

export function resolveRuntimeEventSchema(type: string, version: number) {
  return eventSchemas.get(eventSchemaKey(type, version));
}

export function listRuntimeEventSchemas() {
  return Array.from(eventSchemas.values());
}

export function registerRuntimeLifecycleAdapter(adapter: RuntimeLifecycleAdapter) {
  lifecycleAdapters.set(adapter.engine_id, adapter);
  return adapter;
}

export function resolveRuntimeLifecycleAdapter(engineId: string) {
  return lifecycleAdapters.get(engineId);
}

export function listRuntimeLifecycleAdapters() {
  return Array.from(lifecycleAdapters.values());
}

/** Test-only isolation for registry conformance tests. */
export function resetRuntimeRegistryForTests() {
  capabilities.clear();
  eventHandlers.clear();
  eventSchemas.clear();
  lifecycleAdapters.clear();
}
