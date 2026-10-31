// Event schema registry (HIS-004 §naming & schema standards).
// Pure + client-safe: no server imports. The Kernel refuses to publish an
// event type it does not know, or a payload that violates the declared schema.

import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1;

export type EventSchema = {
  type: string;
  version: number;
  description: string;
  payload: z.ZodTypeAny;
};

const empty = z.record(z.string(), z.unknown());

export const EVENT_SCHEMAS: Record<string, EventSchema> = {
  CheckInSubmitted: {
    type: "CheckInSubmitted",
    version: 1,
    description: "The operator submitted a state check-in.",
    payload: z
      .object({
        energy: z.number().min(0).max(100).optional(),
        focus: z.number().min(0).max(100).optional(),
        recovery: z.number().min(0).max(100).optional(),
        stress: z.number().min(0).max(100).optional(),
        mood: z.number().min(0).max(100).optional(),
        sleep_hours: z.number().min(0).max(24).optional(),
      })
      .passthrough(),
  },
  MealLogged: {
    type: "MealLogged",
    version: 1,
    description: "A meal or hydration entry was recorded by the Nutrition engine.",
    payload: z
      .object({
        kcal: z.number().min(0).optional(),
        protein_g: z.number().min(0).optional(),
        water_ml: z.number().min(0).optional(),
      })
      .passthrough(),
  },
  WorkoutCompleted: {
    type: "WorkoutCompleted",
    version: 1,
    description: "A training session was completed.",
    payload: z
      .object({
        kind: z.string().max(64).optional(),
        duration_min: z.number().min(0).optional(),
        intensity: z.number().min(0).max(10).optional(),
      })
      .passthrough(),
  },
  RoutineCompleted: {
    type: "RoutineCompleted",
    version: 1,
    description: "A protocol routine step was completed.",
    payload: z.object({ routine_key: z.string().max(120).optional() }).passthrough(),
  },
  ReflectionSaved: {
    type: "ReflectionSaved",
    version: 1,
    description: "A reflection entry was saved.",
    payload: empty,
  },
  OutcomeMeasured: {
    type: "OutcomeMeasured",
    version: 1,
    description: "A recommendation outcome was measured, feeding the learning loop.",
    payload: z
      .object({
        recommendation_id: z.string().optional(),
        executed: z.string().max(32).optional(),
      })
      .passthrough(),
  },
  DailyPlanChanged: {
    type: "DailyPlanChanged",
    version: 1,
    description: "The authoritative Daily Operating Plan changed.",
    payload: z
      .object({
        plan_id: z.string().uuid().optional(),
        plan_date: z.string().optional(),
        reason: z.string().max(160).optional(),
      })
      .passthrough(),
  },
  HumanStateUpdated: {
    type: "HumanStateUpdated",
    version: 1,
    description: "The canonical Human State Vector was rematerialized from current evidence.",
    payload: z
      .object({
        as_of: z.string(),
        coverage: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1).nullable(),
        source_count: z.number().int().min(0),
      })
      .passthrough(),
  },
  RecommendationDecided: {
    type: "RecommendationDecided",
    version: 1,
    description: "The human accepted, modified, dismissed, or completed a PDIE recommendation.",
    payload: z
      .object({
        recommendation_id: z.string().uuid(),
        decision_status: z.string(),
      })
      .passthrough(),
  },
  ScheduleProposalResolved: {
    type: "ScheduleProposalResolved",
    version: 1,
    description: "HOS resolved an external engine schedule proposal.",
    payload: z
      .object({
        proposal_id: z.string().uuid(),
        source_engine: z.string(),
        external_proposal_id: z.string(),
        decision: z.enum(["ACCEPT", "REJECT"]),
      })
      .passthrough(),
  },
};

export class EventSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventSchemaError";
  }
}

export function knownEventTypes() {
  return Object.keys(EVENT_SCHEMAS);
}

/** Validate an event before it is ever written to the store. */
export function validateEvent(
  type: string,
  payload: Record<string, unknown>,
  schemaVersion = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  const schema = EVENT_SCHEMAS[type];
  if (!schema) {
    throw new EventSchemaError(
      `Unknown event type "${type}". Register it in src/lib/events/schemas.ts first.`,
    );
  }
  if (schemaVersion !== schema.version) {
    throw new EventSchemaError(
      `Event "${type}" is at schema version ${schema.version}; received ${schemaVersion}.`,
    );
  }
  const parsed = schema.payload.safeParse(payload);
  if (!parsed.success) {
    throw new EventSchemaError(
      `Payload for "${type}" failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "payload"} ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data as Record<string, unknown>;
}

/** Rows for the persisted schema catalogue, so the registry is inspectable. */
export function eventSchemaSeeds() {
  return Object.values(EVENT_SCHEMAS).map((s) => ({
    event_type: s.type,
    schema_version: s.version,
    description: s.description,
  }));
}
