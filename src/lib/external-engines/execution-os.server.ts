import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { EngineDescriptor } from "../engines/contract";
import type { Db } from "../permissions.server";
import {
  registerRuntimeCapability,
  registerRuntimeEventHandler,
  registerRuntimeEventSchema,
  registerRuntimeLifecycleAdapter,
} from "../runtime/registry.server";
import {
  remoteEngineBaseUrl,
  remoteHosRequest,
} from "./remote-engine.server";

export const EXECUTION_OS_ENGINE_ID = "execution-os";
export const EXECUTION_OS_CONTRACT_VERSION = "1.1.0";

const capabilityScopes = {
  "schedule.get": {
    permission: "execution.schedule.read",
    consent: "execution.schedule",
    command: false,
  },
  "session.start": {
    permission: "execution.session.write",
    consent: "execution.performance",
    command: true,
  },
  "session.advance": {
    permission: "execution.session.write",
    consent: "execution.performance",
    command: true,
  },
  "session.close": {
    permission: "execution.session.write",
    consent: "execution.performance",
    command: true,
  },
  "fallback.trigger": {
    permission: "execution.fallback.write",
    consent: "execution.adaptation",
    command: true,
  },
  "discipline.score.get": {
    permission: "execution.discipline.read",
    consent: "execution.analytics",
    command: false,
  },
} as const;

export const EXECUTION_OS_REQUESTED_SCOPES = [
  "execution.schedule.read",
  "execution.schedule.write",
  "execution.session.write",
  "execution.fallback.write",
  "execution.discipline.read",
  "execution.lifecycle.manage",
  "execution.context.write",
  "execution.adaptation.recommend",
  "execution.events.read",
  "execution.events.manage",
  "execution.schedule",
  "execution.performance",
  "execution.adaptation",
  "execution.analytics",
  "execution.control",
  "execution.audit",
  "execution.human_state",
] as const;

export const EXECUTION_OS_DESCRIPTOR: EngineDescriptor = {
  id: EXECUTION_OS_ENGINE_ID,
  name: "Execution OS",
  version: "E9",
  purpose:
    "Execute HOS-delegated routines and performance sessions, recover from execution drift, and return behavioral evidence without owning Human State or the unified Daily Operating Plan.",
  owner: "External Operating Engine",
  status: "active",
  capabilities: Object.keys(capabilityScopes),
  dataOwned: [
    "external.execution_state",
    "external.performance_sessions",
    "external.execution_history",
    "external.adaptations",
  ],
  eventsPublished: [
    "execution.activity.started",
    "execution.activity.completed",
    "execution.session.started",
    "execution.session.advanced",
    "execution.session.closed",
    "execution.fallback.triggered",
    "execution.schedule.proposal.created",
    "execution.schedule.proposal.accepted",
    "execution.schedule.proposal.rejected",
    "execution.decision.requested",
    "execution.behavior.signal",
  ],
  eventsConsumed: [
    "DailyPlanChanged",
    "HumanStateUpdated",
    "RecommendationDecided",
    "ScheduleProposalResolved",
  ],
  publishedSignals: ["execution.latest_outcome"],
  requiredSignals: ["kernel.human_state", "kernel.daily_plan"],
  dependencies: [],
  permissions: {
    dataRequested: [...EXECUTION_OS_REQUESTED_SCOPES],
    dataProvided: [
      "execution events",
      "behavioral evidence",
      "schedule proposals",
      "discipline score",
    ],
    dataProhibited: [
      "full Human State Vector",
      "Personal Policy mutation",
      "private reflections",
      "other engine private storage",
    ],
  },
};

function executionOsSecret() {
  const secret = process.env.HOS_EXECUTION_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "HOS_EXECUTION_SHARED_SECRET must be configured with at least 32 characters.",
    );
  }
  return secret;
}

async function executionOsBaseUrl(db: Db, userId: string) {
  return remoteEngineBaseUrl(
    db,
    userId,
    EXECUTION_OS_ENGINE_ID,
    process.env.EXECUTION_OS_BASE_URL,
  );
}

async function executionOsTenantId(db: Db, userId: string) {
  const { data, error } = await db
    .from("engine_config")
    .select("value")
    .eq("user_id", userId)
    .eq("engine_id", EXECUTION_OS_ENGINE_ID)
    .eq("key", "tenant_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value?.trim() || process.env.HOS_EXECUTION_TENANT_ID || "personal-hos";
}

async function callExecutionOs(
  db: Db,
  userId: string,
  input: {
    path: string;
    body?: unknown;
    permissions: string[];
    consentScopes: string[];
    idempotencyKey?: string;
    correlationId?: string;
  },
) {
  return remoteHosRequest({
    db,
    userId,
    engineId: EXECUTION_OS_ENGINE_ID,
    baseUrl: await executionOsBaseUrl(db, userId),
    sharedSecret: executionOsSecret(),
    tenantId: await executionOsTenantId(db, userId),
    permissions: input.permissions,
    consentScopes: input.consentScopes,
    path: input.path,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    requestId: input.correlationId,
  });
}

export async function invokeExecutionOsCapability(
  db: Db,
  userId: string,
  capability: keyof typeof capabilityScopes,
  input: unknown,
  correlationId?: string,
) {
  const scope = capabilityScopes[capability];
  const response = await callExecutionOs(db, userId, {
    path: `/api/v1/hos/capabilities/${encodeURIComponent(capability)}`,
    body: input ?? {},
    permissions: [scope.permission],
    consentScopes: [scope.consent],
    idempotencyKey: scope.command
      ? correlationId || `hos-${capability}-${randomUUID()}`
      : undefined,
    correlationId,
  });
  const outer = asUnknownRecord(response);
  const data = asUnknownRecord(outer?.data);
  return data?.data ?? outer?.data ?? response;
}

function minutesInTimeZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

async function executionOsTimezone(db: Db, userId: string) {
  const { data, error } = await db
    .from("engine_config")
    .select("value")
    .eq("user_id", userId)
    .eq("engine_id", EXECUTION_OS_ENGINE_ID)
    .eq("key", "timezone")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value?.trim() || process.env.HOS_DEFAULT_TIMEZONE || "UTC";
}

export async function projectDailyPlanForExecutionOs(
  db: Db,
  userId: string,
  planDate = new Date().toISOString().slice(0, 10),
) {
  const { data: plan, error: planError } = await db
    .from("daily_plans")
    .select("id, plan_date, status, updated_at")
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) return null;

  const { data: rows, error } = await db
    .from("daily_plan_items")
    .select(
      "id, title, start_at, end_at, protected, flexibility, status, source_engine, source_id, metadata, updated_at",
    )
    .eq("user_id", userId)
    .eq("plan_id", plan.id)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);

  const timeZone = await executionOsTimezone(db, userId);
  const timed = (rows ?? []).filter((item) => item.start_at && item.end_at);
  const delegated = timed.filter((item) => {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    return (
      item.source_engine === EXECUTION_OS_ENGINE_ID ||
      metadata.execution_delegate === true
    );
  });

  const executionActivities = delegated.map((item) => ({
    id: item.source_id || item.id,
    anchorId: "HOS_DELEGATED_EXECUTION",
    title: item.title,
    timeWindow: "",
    startMinutes: minutesInTimeZone(item.start_at!, timeZone),
    endMinutes: minutesInTimeZone(item.end_at!, timeZone),
    isNonNegotiable: item.protected,
    completed: item.status === "completed",
    modesAllowed: ["GREEN", "YELLOW", "RED"],
    interactiveActionType: "GENERIC",
    isProtected: item.protected,
    category: item.protected ? "PROTECTED_COMMITMENT" : "WORK",
  }));

  const latestUpdatedAt = [plan.updated_at, ...timed.map((item) => item.updated_at)]
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    planId: plan.id,
    planVersion: latestUpdatedAt || "1",
    subjectId: userId,
    localDate: plan.plan_date,
    timezone: timeZone,
    source: "HOS",
    receivedAtUtc: new Date().toISOString(),
    executionActivities,
    commitments: timed.map((item) => ({
      id: item.id,
      title: item.title,
      startMinutes: minutesInTimeZone(item.start_at!, timeZone),
      endMinutes: minutesInTimeZone(item.end_at!, timeZone),
      isProtected: item.protected,
      source: item.source_engine ? "EXTERNAL" : "HOS",
      sourceRef: item.source_id || item.id,
    })),
    delegatedWindows: delegated
      .filter((item) => !item.protected)
      .map((item) => ({
        id: `delegate-${item.id}`,
        startMinutes: minutesInTimeZone(item.start_at!, timeZone),
        endMinutes: minutesInTimeZone(item.end_at!, timeZone),
        allowedActivityIds: [item.source_id || item.id],
        canReallocate: item.flexibility !== "fixed",
        canCompress: item.flexibility !== "fixed",
        canDefer: item.flexibility === "flexible" || item.flexibility === "moveable",
      })),
  };
}

export async function projectHumanStateForExecutionOs(db: Db, userId: string) {
  const [{ data: hsv, error: hsvError }, { data: checkIn, error: checkInError }] =
    await Promise.all([
      db
        .from("human_states")
        .select(
          "as_of, physical, cognitive, emotional, behavioral, lifestyle, operational, confidence, coverage, source_count",
        )
        .eq("user_id", userId)
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("check_ins")
        .select("energy, focus, recovery, stress, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (hsvError) throw new Error(hsvError.message);
  if (checkInError) throw new Error(checkInError.message);
  if (!hsv) return null;

  const familyValue = (family: unknown) => {
    if (!family || typeof family !== "object") return undefined;
    const value = (family as { value?: unknown }).value;
    return typeof value === "number" ? value : undefined;
  };
  const operational = familyValue(hsv.operational);
  const cognitive = familyValue(hsv.cognitive);
  const physical = familyValue(hsv.physical);
  const recoveryNeed =
    typeof checkIn?.recovery === "number"
      ? Math.max(0, Math.min(100, 100 - checkIn.recovery))
      : undefined;
  const constraints: string[] = [];
  if (recoveryNeed !== undefined && recoveryNeed >= 70) constraints.push("RECOVERY_PRIORITY");
  if ((checkIn?.focus ?? cognitive ?? 100) <= 40) constraints.push("SHORT_FOCUS_ONLY");
  if ((physical ?? 100) <= 40) constraints.push("LOW_PHYSICAL_LOAD");
  if ((checkIn?.stress ?? 0) >= 70) constraints.push("HIGH_STRESS");

  return {
    contextId: `hsv-${hsv.as_of}-${hsv.source_count ?? 0}`,
    subjectId: userId,
    source: "HumanKernelOS",
    sourceRef: `human_states:${hsv.as_of}`,
    schemaVersion: "1.0",
    observedAtUtc: checkIn?.created_at || new Date().toISOString(),
    validUntilUtc: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    confidence: Math.max(0, Math.min(1, Number(hsv.confidence ?? 0))),
    energyCapacity:
      typeof checkIn?.energy === "number" ? checkIn.energy : operational,
    cognitiveCapacity: cognitive,
    physicalCapacity: physical,
    recoveryNeed,
    stressLoad:
      typeof checkIn?.stress === "number" ? checkIn.stress : undefined,
    attentionStability:
      typeof checkIn?.focus === "number" ? checkIn.focus : cognitive,
    availability:
      operational === undefined
        ? undefined
        : operational < 30
          ? "UNAVAILABLE"
          : operational < 60
            ? "LIMITED"
            : "AVAILABLE",
    executionConstraints: constraints,
  };
}

async function sendPlanToExecutionOs(
  db: Db,
  userId: string,
  eventId: string,
  planDate?: string,
) {
  const plan = await projectDailyPlanForExecutionOs(db, userId, planDate);
  if (!plan) return;
  await callExecutionOs(db, userId, {
    path: "/api/v1/hos/signals",
    body: { type: "hos.daily_operating_plan.updated", data: { plan } },
    permissions: ["execution.schedule.write"],
    consentScopes: ["execution.schedule"],
    idempotencyKey: `daily-plan-${eventId}`,
    correlationId: eventId,
  });
}

async function sendHumanStateToExecutionOs(db: Db, userId: string, eventId: string) {
  const context = await projectHumanStateForExecutionOs(db, userId);
  if (!context) return;
  await callExecutionOs(db, userId, {
    path: "/api/v1/hos/signals",
    body: { type: "hos.human_state.updated", data: { context } },
    permissions: ["execution.context.write"],
    consentScopes: ["execution.human_state"],
    idempotencyKey: `human-state-${eventId}`,
    correlationId: eventId,
  });
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function executionBehaviorProjection(payload: Record<string, unknown>) {
  const signalType = String(payload.signalType || "");
  const evidence =
    payload.evidence && typeof payload.evidence === "object"
      ? (payload.evidence as Record<string, unknown>)
      : {};
  const eventType = String(evidence.eventType || "");

  // Only direct execution outcomes carry a defensible ordinal value.
  // Fallback, schedule pressure, deviation, override and performance events
  // remain auditable facts until the external engine provides a measured
  // metric rather than HOS inventing one.
  if (signalType !== "EXECUTION_OUTCOME") return null;

  const outcome =
    eventType === "ActivityCompleted"
      ? 100
      : eventType === "ActivityPartiallyCompleted"
        ? 50
        : eventType === "ActivityMissed"
          ? 0
          : null;
  if (outcome === null) return null;

  return {
    key: "execution.latest_outcome",
    axis: "behavioral",
    value: outcome,
    confidence: 1,
    // A single direct outcome is certain as a fact but only moderately
    // representative of broader behavioral state.
    reliability: 0.5,
  };
}

function timestampForMinutes(date: string, minutes: number, timeZone: string) {
  // The HOS plan stores absolute timestamps; Execution OS proposals use local
  // minutes. For proposal review we preserve the intended wall-clock time and
  // use a timezone-labelled ISO-like value only after finding the offset.
  const [year, month, day] = date.split("-").map(Number);
  const targetUtc = new Date(Date.UTC(year!, month! - 1, day!, Math.floor(minutes / 60), minutes % 60));
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
  });
  const zone = formatter.formatToParts(targetUtc).find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/GMT([+-]\d{2}:\d{2})/);
  const offset = match?.[1] ?? "+00:00";
  return `${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00${offset}`;
}

async function ingestExecutionScheduleProposal(
  db: Db,
  userId: string,
  event: { id: string; payload: Record<string, unknown> },
) {
  const payload =
    event.payload.payload && typeof event.payload.payload === "object"
      ? (event.payload.payload as Record<string, unknown>)
      : event.payload;
  const status = String(payload.status || "PROPOSED");
  if (status !== "PROPOSED") return;

  const externalProposalId = String(
    payload.id || event.payload.subject || event.id,
  );
  const today = new Date().toISOString().slice(0, 10);
  const { data: plan } = await db
    .from("daily_plans")
    .select("plan_date")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();
  const planDate = plan?.plan_date ?? today;
  const timeZone = await executionOsTimezone(db, userId);
  let allocations = Array.isArray(payload.allocations)
    ? (payload.allocations as Array<Record<string, unknown>>)
    : [];
  if (
    allocations.length === 0 &&
    typeof payload.startMinutes === "number" &&
    typeof payload.endMinutes === "number"
  ) {
    allocations = [
      {
        activityId: payload.taskId ?? "execution-activity",
        title: payload.taskId ?? "Execution activity",
        allocatedStartMinutes: payload.startMinutes,
        allocatedEndMinutes: payload.endMinutes,
        reasonForAdjustment: payload.reason,
        priority: 100,
      },
    ];
  }
  const first = allocations[0];

  const sourceId = externalProposalId;
  const { data: existing, error: existingError } = await db
    .from("daily_plan_proposals")
    .select("id")
    .eq("user_id", userId)
    .eq("source_engine", EXECUTION_OS_ENGINE_ID)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const title =
    allocations.length > 1
      ? `Execution schedule adjustment (${allocations.length} blocks)`
      : String(first?.title || first?.activityId || "Execution schedule adjustment");

  const { error } = await db.from("daily_plan_proposals").insert({
    user_id: userId,
    plan_date: planDate,
    source_engine: EXECUTION_OS_ENGINE_ID,
    source_id: sourceId,
    title,
    description: String(
      payload.reason ||
        first?.reasonForAdjustment ||
        "Execution OS requested a schedule adjustment.",
    ),
    requested_start:
      typeof first?.allocatedStartMinutes === "number"
        ? timestampForMinutes(planDate, first.allocatedStartMinutes, timeZone)
        : null,
    requested_end:
      typeof first?.allocatedEndMinutes === "number"
        ? timestampForMinutes(planDate, first.allocatedEndMinutes, timeZone)
        : null,
    flexibility: "flexible",
    priority: Number(first?.priority ?? 100),
    protected: allocations.some((allocation) => Boolean(allocation.isProtected)),
    status: "pending",
    resolution: {
      external_proposal_id: externalProposalId,
      external_plan_id: payload.planId ?? null,
      external_plan_version: payload.planVersion ?? null,
      external_allocations: allocations,
    } as never,
  });
  if (error) throw new Error(error.message);
}

for (const [capability, scope] of Object.entries(capabilityScopes) as Array<
  [keyof typeof capabilityScopes, (typeof capabilityScopes)[keyof typeof capabilityScopes]]
>) {
  registerRuntimeCapability({
    id: `${EXECUTION_OS_ENGINE_ID}.${capability}@${EXECUTION_OS_CONTRACT_VERSION}`,
    provider_engine_id: EXECUTION_OS_ENGINE_ID,
    capability,
    version: EXECUTION_OS_CONTRACT_VERSION,
    description: `Remote Execution OS capability: ${capability}`,
    required_permission: scope.permission,
    input: z.record(z.string(), z.unknown()).default({}),
    output: z.unknown(),
    status: "available",
    run: (db, userId, input, context) =>
      invokeExecutionOsCapability(
        db,
        userId,
        capability,
        input,
        context?.correlationId,
      ),
  });
}

registerRuntimeLifecycleAdapter({
  engine_id: EXECUTION_OS_ENGINE_ID,
  beforeTransition: async (db, userId, _from, to) => {
    let action: "ACTIVATE" | "RESUME" | "PAUSE" | null = null;
    if (to === "ENABLED" || to === "RUNNING") action = "ACTIVATE";
    if (to === "SUSPENDED" || to === "DISABLED" || to === "UNINSTALLED") action = "PAUSE";
    if (!action) return;
    await callExecutionOs(db, userId, {
      path: "/api/v1/hos/lifecycle",
      body: { action, reason: `HumanKernelOS lifecycle transition to ${to}` },
      permissions: ["execution.lifecycle.manage"],
      consentScopes: ["execution.control"],
      idempotencyKey: `lifecycle-${to}-${randomUUID()}`,
    });
  },
  health: async (db, userId) => {
    try {
      const base = await executionOsBaseUrl(db, userId);
      const response = await fetch(`${base}/api/v1/hos/readiness`);
      if (!response.ok) return { health: "degraded", note: `Readiness HTTP ${response.status}` };
      const payload = (await response.json()) as {
        data?: { status?: string };
      };
      return payload.data?.status === "ready"
        ? { health: "healthy", note: "Execution OS HOS boundary ready" }
        : { health: "degraded", note: "Execution OS reports not_ready" };
    } catch (error) {
      return {
        health: "unresponsive",
        note: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

registerRuntimeEventHandler("DailyPlanChanged", {
  engine_id: EXECUTION_OS_ENGINE_ID,
  handler: "accept_hos_daily_plan",
  scope: "execution.schedule.write",
  run: async (db, userId, event) => {
    await sendPlanToExecutionOs(
      db,
      userId,
      event.id,
      typeof event.payload.plan_date === "string"
        ? event.payload.plan_date
        : undefined,
    );
  },
});

registerRuntimeEventHandler("HumanStateUpdated", {
  engine_id: EXECUTION_OS_ENGINE_ID,
  handler: "accept_hos_human_state",
  scope: "execution.context.write",
  run: async (db, userId, event) => {
    await sendHumanStateToExecutionOs(db, userId, event.id);
  },
});

registerRuntimeEventHandler("ScheduleProposalResolved", {
  engine_id: EXECUTION_OS_ENGINE_ID,
  handler: "resolve_execution_schedule_proposal",
  scope: "execution.schedule.write",
  run: async (db, userId, event) => {
    if (event.payload.source_engine !== EXECUTION_OS_ENGINE_ID) return;
    const externalProposalId = String(event.payload.external_proposal_id || "");
    const decision = String(event.payload.decision || "");
    if (!externalProposalId || !["ACCEPT", "REJECT"].includes(decision)) return;
    await callExecutionOs(db, userId, {
      path: "/api/v1/hos/signals",
      body: {
        type: "hos.schedule_proposal.resolved",
        data: { proposalId: externalProposalId, decision },
      },
      permissions: ["execution.schedule.write"],
      consentScopes: ["execution.schedule"],
      idempotencyKey: `schedule-resolution-${event.id}`,
      correlationId: event.id,
    });
  },
});

registerRuntimeEventHandler("RecommendationDecided", {
  engine_id: EXECUTION_OS_ENGINE_ID,
  handler: "accept_pdie_execution_advisory",
  scope: "execution.adaptation.recommend",
  run: async (db, userId, event) => {
    const adaptation =
      event.payload.execution_adaptation &&
      typeof event.payload.execution_adaptation === "object"
        ? (event.payload.execution_adaptation as Record<string, unknown>)
        : null;
    if (!adaptation) return;
    const type = String(adaptation.type || "");
    const allowed = new Set([
      "PREFER_SHORTER_BLOCKS",
      "PREFER_RECOVERY",
      "REDUCE_CONTEXT_SWITCHING",
      "PREFER_LOWER_COGNITIVE_LOAD",
      "PREFER_LOWER_PHYSICAL_LOAD",
    ]);
    if (!allowed.has(type)) return;

    await callExecutionOs(db, userId, {
      path: "/api/v1/hos/signals",
      body: {
        type: "hos.pdie.recommendation.created",
        data: {
          recommendation: {
            id: String(event.payload.recommendation_id),
            subjectId: userId,
            source: "PDIE",
            recommendationVersion: "1.0",
            type,
            confidence: Number(event.payload.confidence ?? 0),
            rationale: String(event.payload.rationale || ""),
            evidenceRefs: Array.isArray(event.payload.evidence_refs)
              ? event.payload.evidence_refs.map(String)
              : [],
            issuedAtUtc: new Date().toISOString(),
            expiresAtUtc: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            parameters: {
              ...(typeof adaptation.max_block_minutes === "number"
                ? { maxBlockMinutes: adaptation.max_block_minutes }
                : {}),
              ...(typeof adaptation.strength === "number"
                ? { strength: adaptation.strength }
                : {}),
            },
            status: "RECEIVED",
          },
        },
      },
      permissions: ["execution.adaptation.recommend"],
      consentScopes: ["execution.adaptation"],
      idempotencyKey: `pdie-${event.id}`,
      correlationId: event.id,
    });
  },
});

registerRuntimeEventHandler("execution.behavior.signal", {
  engine_id: "orchestrator",
  handler: "ingest_execution_behavior",
  scope: "engine_signals",
  run: async (db, userId, event) => {
    const projection = executionBehaviorProjection(event.payload);
    if (!projection) return;
    const { error } = await db.from("engine_signals").insert({
      user_id: userId,
      engine: EXECUTION_OS_ENGINE_ID,
      signal_key: projection.key,
      value_num: projection.value,
      confidence: projection.confidence,
      reliability: projection.reliability,
      trend: "unknown",
      metadata: {
        hos_axis: projection.axis,
        normalized_value: projection.value,
        base_reliability: projection.reliability,
        external_event_id: event.id,
        evidence: event.payload.evidence ?? null,
        provenance: event.payload.provenance ?? null,
      } as never,
      ...(typeof event.payload.external_occurred_at === "string"
        ? { occurred_at: event.payload.external_occurred_at }
        : {}),
    });
    if (error) throw new Error(error.message);
    const { runAndPersistOrchestrator } = await import("../mesh.server");
    await runAndPersistOrchestrator(db, userId);
  },
});

registerRuntimeEventHandler("execution.schedule.proposal.created", {
  engine_id: "daily-plan",
  handler: "ingest_execution_schedule_proposal",
  scope: null,
  run: ingestExecutionScheduleProposal,
});

const executionEventTypes = [
  "execution.activity.started",
  "execution.activity.completed",
  "execution.session.started",
  "execution.session.advanced",
  "execution.session.closed",
  "execution.fallback.triggered",
  "execution.schedule.proposal.created",
  "execution.schedule.proposal.accepted",
  "execution.schedule.proposal.rejected",
  "execution.decision.requested",
] as const;

for (const type of executionEventTypes) {
  registerRuntimeEventSchema({
    type,
    version: 1,
    description: `Execution OS external event: ${type}`,
    payload: z.object({}).passthrough(),
  });
}
registerRuntimeEventSchema({
  type: "execution.behavior.signal",
  version: 1,
  description: "Behavioral execution evidence projected by Execution OS.",
  payload: z
    .object({
      signalType: z.string().min(1),
      sourceEventId: z.string().min(1),
      evidence: z.record(z.string(), z.unknown()),
      provenance: z.record(z.string(), z.unknown()),
    })
    .passthrough(),
});

export function executionOsInboundSubscriptionSeeds() {
  return [
    {
      engine_id: "orchestrator",
      event_type: "execution.behavior.signal",
      handler: "ingest_execution_behavior",
    },
    {
      engine_id: "daily-plan",
      event_type: "execution.schedule.proposal.created",
      handler: "ingest_execution_schedule_proposal",
    },
  ];
}
