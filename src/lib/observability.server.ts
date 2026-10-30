import type { Db } from "./permissions.server";

export async function getPlatformObservabilitySnapshot(
  db: Db,
  userId: string,
) {
  const [
    engines,
    invocations,
    deliveries,
    connectors,
  ] = await Promise.all([
    db
      .from("engines")
      .select(
        "engine_id, lifecycle_state, health, last_heartbeat_at, last_event_at, last_error, error_count",
      )
      .eq("user_id", userId)
      .order("engine_id", { ascending: true }),
    db
      .from("capability_invocations")
      .select(
        "consumer_engine_id, provider_engine_id, capability, status, duration_ms, error, created_at, correlation_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("hos_event_deliveries")
      .select(
        "event_id, engine_id, handler, status, attempts, last_error, dead_letter, created_at, correlation_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("connectors")
      .select("provider, status, health, last_sync_at, last_error")
      .eq("user_id", userId)
      .order("provider", { ascending: true }),
  ]);

  for (const result of [engines, invocations, deliveries, connectors]) {
    if (result.error) throw new Error(result.error.message);
  }

  const invocationRows = invocations.data ?? [];
  const deliveryRows = deliveries.data ?? [];
  const engineRows = engines.data ?? [];
  const connectorRows = connectors.data ?? [];

  return {
    generated_at: new Date().toISOString(),
    summary: {
      engines_total: engineRows.length,
      engines_operational: engineRows.filter(
        (engine) =>
          engine.lifecycle_state === "ENABLED" ||
          engine.lifecycle_state === "RUNNING",
      ).length,
      engines_degraded: engineRows.filter(
        (engine) =>
          engine.health === "degraded" ||
          engine.health === "failed" ||
          engine.health === "unresponsive",
      ).length,
      recent_capability_failures: invocationRows.filter(
        (row) => row.status !== "succeeded",
      ).length,
      recent_dead_letters: deliveryRows.filter((row) => row.dead_letter).length,
      connectors_degraded: connectorRows.filter(
        (connector) =>
          connector.health === "degraded" ||
          connector.health === "unavailable",
      ).length,
    },
    engines: engineRows,
    capability_invocations: invocationRows,
    event_deliveries: deliveryRows,
    connectors: connectorRows,
  };
}
