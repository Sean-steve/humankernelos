// Engine Contract — HOS Constitution Art. V + Architecture Ch. 7.
// The Kernel never reads engine-internal tables. It reads only engine_signals.

export type HosEventType =
  | "MealLogged"
  | "WorkoutCompleted"
  | "RoutineCompleted"
  | "CheckInSubmitted"
  | "ReflectionSaved";

export type SignalTrend =
  | "improving"
  | "declining"
  | "stable"
  | "volatile"
  | "unknown";

export type EngineSignal = {
  engine: string;
  signal_key: string;
  value_num?: number | null;
  value_text?: string | null;
  confidence?: number | null; // 0..1
  reliability?: number | null; // 0..1
  trend?: SignalTrend | null;
  metadata?: Record<string, unknown>;
};

// Full descriptor per Constitution Art. V and Spec Ch. 7
export interface EngineDescriptor {
  id: string;
  name: string;
  version: string;
  purpose: string;
  owner: string;
  status: "active" | "inactive" | "deprecated";
  capabilities: string[];
  dataOwned: string[]; // domain tables this engine owns
  eventsPublished: HosEventType[];
  eventsConsumed: HosEventType[];
  publishedSignals: string[];
  requiredSignals: string[]; // signals this engine consumes
  dependencies: string[]; // other engine ids
  permissions: {
    dataRequested: string[];
    dataProvided: string[];
    dataProhibited: string[];
  };
}

export const REGISTERED_ENGINES: EngineDescriptor[] = [
  {
    id: "nutrition",
    name: "Nutrition Engine",
    version: "0.2.0",
    purpose: "Track meals, hydration, and macros; emit nutrition signals to the Kernel.",
    owner: "HOS Core",
    status: "active",
    capabilities: ["log_meal", "compute_daily_macros", "hydration_tracking"],
    dataOwned: ["nutrition_logs"],
    eventsPublished: ["MealLogged"],
    eventsConsumed: [],
    publishedSignals: [
      "nutrition.kcal",
      "nutrition.protein_g",
      "nutrition.hydration_ml",
    ],
    requiredSignals: [],
    dependencies: [],
    permissions: {
      dataRequested: [],
      dataProvided: ["kcal", "protein_g", "hydration_ml"],
      dataProhibited: ["body_sessions", "reflections"],
    },
  },
  {
    id: "body",
    name: "Body Engine",
    version: "0.2.0",
    purpose: "Track training load and physical readiness; emit body signals.",
    owner: "HOS Core",
    status: "active",
    capabilities: ["log_session", "compute_7d_load"],
    dataOwned: ["body_sessions"],
    eventsPublished: ["WorkoutCompleted"],
    eventsConsumed: [],
    publishedSignals: ["body.load_7d", "body.last_session_min"],
    requiredSignals: ["kernel.recovery"],
    dependencies: [],
    permissions: {
      dataRequested: ["recovery"],
      dataProvided: ["load_7d", "last_session_min"],
      dataProhibited: ["nutrition_logs", "reflections"],
    },
  },
  {
    id: "routine",
    name: "Routine Engine",
    version: "0.2.0",
    purpose: "Track daily protocol adherence; emit streak and completion signals.",
    owner: "HOS Core",
    status: "active",
    capabilities: ["mark_complete", "streak_calculation"],
    dataOwned: ["routine_completions"],
    eventsPublished: ["RoutineCompleted"],
    eventsConsumed: [],
    publishedSignals: ["routine.streak", "routine.completed_today"],
    requiredSignals: [],
    dependencies: [],
    permissions: {
      dataRequested: [],
      dataProvided: ["streak", "completed_today"],
      dataProhibited: ["nutrition_logs", "body_sessions"],
    },
  },
];
