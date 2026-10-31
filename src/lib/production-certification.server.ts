import type { Db } from "./permissions.server";
import {
  productionConfigReady,
  validateOperationalProof,
  validateProductionEnvironment,
} from "./production.server";

export type CertificationGate = {
  id: string;
  label: string;
  critical: boolean;
  status: "pass" | "fail" | "observing";
  detail: string;
};

function rate(successes: number, total: number) {
  return total <= 0 ? null : successes / total;
}

export async function getProductionCertificationSnapshot(
  db: Db,
  userId: string,
  now = new Date(),
) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const requireExecutionOs = process.env.HOS_REQUIRE_EXECUTION_OS === "true";

  const [enginesResult, invocationsResult, deliveriesResult, connectorsResult, auditResult] =
    await Promise.all([
      db
        .from("engines")
        .select(
          "engine_id, lifecycle_state, health, last_heartbeat_at, last_event_at, last_error, error_count",
        )
        .eq("user_id", userId),
      db
        .from("capability_invocations")
        .select("status, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(2000),
      db
        .from("hos_event_deliveries")
        .select("status, dead_letter, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(5000),
      db
        .from("connectors")
        .select("provider, status, health, last_error")
        .eq("user_id", userId),
      db
        .from("audit_log")
        .select("action, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .in("action", [
          "permission.denied",
          "engine.blocked",
          "lifecycle.remote_rejected",
          "event.dead_lettered",
        ])
        .limit(1000),
    ]);

  for (const result of [
    enginesResult,
    invocationsResult,
    deliveriesResult,
    connectorsResult,
    auditResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const engineRows = enginesResult.data ?? [];
  const invocationRows = invocationsResult.data ?? [];
  const deliveryRows = deliveriesResult.data ?? [];
  const connectorRows = connectorsResult.data ?? [];
  const auditRows = auditResult.data ?? [];

  const operationalEngines = engineRows.filter(
    (engine) =>
      engine.lifecycle_state === "ENABLED" ||
      engine.lifecycle_state === "RUNNING",
  );
  const unhealthyOperational = operationalEngines.filter(
    (engine) =>
      engine.health === "degraded" ||
      engine.health === "failed" ||
      engine.health === "unresponsive",
  );

  const invocationSuccesses = invocationRows.filter(
    (item) => item.status === "succeeded",
  ).length;
  const invocationSuccessRate = rate(
    invocationSuccesses,
    invocationRows.length,
  );
  const deliveredEvents = deliveryRows.filter(
    (item) => item.status === "delivered",
  ).length;
  const deadLetters = deliveryRows.filter(
    (item) => item.dead_letter || item.status === "dead_letter",
  ).length;
  const eventSuccessRate = rate(deliveredEvents, deliveryRows.length);

  const degradedConnectedConnectors = connectorRows.filter(
    (connector) =>
      connector.status === "connected" &&
      (connector.health === "degraded" ||
        connector.health === "unavailable"),
  );

  const configChecks = validateProductionEnvironment();
  const operationalProof = validateOperationalProof(process.env, now.getTime());
  const executionEngine = engineRows.find(
    (engine) => engine.engine_id === "execution-os",
  );

  const configPass = productionConfigReady(configChecks);

  const gates: CertificationGate[] = [
    {
      id: "configuration",
      label: "Production configuration",
      critical: true,
      status: configPass ? "pass" : "fail",
      detail: configPass
        ? "All critical server configuration checks pass."
        : "One or more critical server configuration checks fail.",
    },
    ...operationalProof.map(
      (proof): CertificationGate => ({
        id: proof.name,
        label:
          proof.name === "backup_verified"
            ? "Backup verification"
            : "Restore drill",
        critical: true,
        status: proof.ok ? "pass" : "fail",
        detail: proof.detail,
      }),
    ),
    {
      id: "engine_health",
      label: "Operational engine health",
      critical: true,
      status: unhealthyOperational.length === 0 ? "pass" : "fail",
      detail:
        unhealthyOperational.length === 0
          ? \`\${operationalEngines.length} operational engine(s), none degraded.\`
          : \`\${unhealthyOperational.length} operational engine(s) are degraded, failed, or unresponsive.\`,
    },
    {
      id: "capability_reliability",
      label: "Capability reliability (24h)",
      critical: true,
      status:
        invocationRows.length < 10
          ? "observing"
          : (invocationSuccessRate ?? 0) >= 0.98
            ? "pass"
            : "fail",
      detail:
        invocationRows.length < 10
          ? \`Only \${invocationRows.length} invocation(s); at least 10 are required for a reliability judgment.\`
          : \`\${Math.round((invocationSuccessRate ?? 0) * 10000) / 100}% success across \${invocationRows.length} invocation(s).\`,
    },
    {
      id: "event_mesh",
      label: "Event Mesh dead letters (24h)",
      critical: true,
      status: deadLetters === 0 ? "pass" : "fail",
      detail:
        deadLetters === 0
          ? \`No dead letters across \${deliveryRows.length} recent delivery record(s).\`
          : \`\${deadLetters} dead-letter delivery record(s) require resolution.\`,
    },
    {
      id: "connectors",
      label: "Connected integration health",
      critical: false,
      status:
        degradedConnectedConnectors.length === 0 ? "pass" : "fail",
      detail:
        degradedConnectedConnectors.length === 0
          ? "No connected integration reports degraded/unavailable health."
          : \`\${degradedConnectedConnectors.length} connected integration(s) are degraded.\`,
    },
    {
      id: "execution_os",
      label: "Execution OS production dependency",
      critical: requireExecutionOs,
      status: !requireExecutionOs
        ? "pass"
        : executionEngine &&
            (executionEngine.lifecycle_state === "ENABLED" ||
              executionEngine.lifecycle_state === "RUNNING") &&
            executionEngine.health !== "failed" &&
            executionEngine.health !== "unresponsive"
          ? "pass"
          : "fail",
      detail: !requireExecutionOs
        ? "Execution OS is not marked as a required deployment dependency."
        : executionEngine
          ? \`Execution OS is \${executionEngine.lifecycle_state}/\${executionEngine.health}.\`
          : "Execution OS is required but is not installed for this user.",
    },
  ];

  const failedCritical = gates.filter(
    (gate) => gate.critical && gate.status === "fail",
  );
  const observingCritical = gates.filter(
    (gate) => gate.critical && gate.status === "observing",
  );

  return {
    generated_at: now.toISOString(),
    window: { from: since, to: now.toISOString() },
    status:
      failedCritical.length > 0
        ? "blocked"
        : observingCritical.length > 0
          ? "observing"
          : "certified",
    production_activation_ready:
      failedCritical.length === 0 && observingCritical.length === 0,
    gates,
    metrics: {
      operational_engines: operationalEngines.length,
      unhealthy_operational_engines: unhealthyOperational.length,
      capability_invocations: invocationRows.length,
      capability_success_rate: invocationSuccessRate,
      event_deliveries: deliveryRows.length,
      event_success_rate: eventSuccessRate,
      dead_letters: deadLetters,
      degraded_connected_connectors: degradedConnectedConnectors.length,
      security_control_events: auditRows.length,
    },
    configuration: configChecks.map((check) => ({
      name: check.name,
      ok: check.ok,
      critical: check.critical,
    })),
    operational_proof: operationalProof,
  } as const;
}
