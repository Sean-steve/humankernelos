// Engine Contract — HOS Constitution Art. V + Architecture Ch. 7.
// The Kernel never reads engine-internal tables. It reads only engine_signals.
//
// NOTE: REGISTERED_ENGINES remains a compile-time catalogue in the current
// foundation. Persisted/runtime-authoritative registration is Phase-2 work.
// Do not treat this array as the final plug-and-play engine architecture.

export type BuiltinHosEventType =
  | "MealLogged"
  | "WorkoutCompleted"
  | "RoutineCompleted"
  | "CheckInSubmitted"
  | "ReflectionSaved"
  | "OutcomeMeasured";

/** External engines may publish additional versioned event names. */
export type HosEventType = string;


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

/** Built-in installable catalogue. Persisted rows are runtime authority. */
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
    name: "Legacy Routine Tracker",
    version: "0.2.0",
    purpose:
      "Compatibility tracker for simple routine completions and streaks. This is not the authoritative Routine Execution OS / HEE and must not be expanded into that domain.",
    owner: "HOS Core (Legacy Compatibility)",
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
  {
    id: "hsie",
    name: "Human State Intelligence",
    version: "0.1.0",
    purpose: "Compute the Human State Vector from all engine signals + check-ins.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["compute_hsv", "trend_analysis"],
    dataOwned: ["human_states"],
    eventsPublished: [],
    eventsConsumed: ["CheckInSubmitted", "MealLogged", "WorkoutCompleted", "RoutineCompleted"],
    publishedSignals: ["hsv.composite"],
    requiredSignals: ["nutrition.kcal", "body.load_7d", "routine.streak"],
    dependencies: ["nutrition", "body", "routine"],
    permissions: {
      dataRequested: ["all engine signals", "check_ins"],
      dataProvided: ["hsv"],
      dataProhibited: ["reflections.entry"],
    },
  },
  {
    id: "pdie",
    name: "Personal Decision Intelligence",
    version: "0.1.0",
    purpose: "Emit explainable recommendations from HSV + policies + identity.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["generate_recommendation", "decide"],
    dataOwned: ["recommendations"],
    eventsPublished: [],
    eventsConsumed: [],
    publishedSignals: [],
    requiredSignals: ["hsv.composite"],
    dependencies: ["hsie", "policy"],
    permissions: {
      dataRequested: ["human_states", "policies", "profiles"],
      dataProvided: ["recommendations"],
      dataProhibited: [],
    },
  },
  {
    id: "policy",
    name: "Policy Service",
    version: "0.1.0",
    purpose: "Store and evaluate the operator's personal if/then operating rules.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["author_policy", "evaluate_policy"],
    dataOwned: ["policies"],
    eventsPublished: [],
    eventsConsumed: [],
    publishedSignals: [],
    requiredSignals: [],
    dependencies: [],
    permissions: {
      dataRequested: [],
      dataProvided: ["policies"],
      dataProhibited: [],
    },
  },
  {
    id: "learning",
    name: "Learning Loop",
    version: "0.1.0",
    purpose:
      "Measure whether recommendations were executed and what they moved; learn personal patterns.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["record_outcome", "derive_patterns", "adherence_tracking"],
    dataOwned: ["recommendation_outcomes", "learned_patterns"],
    eventsPublished: ["OutcomeMeasured"],
    eventsConsumed: [],
    publishedSignals: ["learning.adherence"],
    requiredSignals: [],
    dependencies: ["pdie"],
    permissions: {
      dataRequested: ["recommendations", "recommendation_outcomes"],
      dataProvided: ["adherence", "learned_patterns"],
      dataProhibited: ["reflections.entry"],
    },
  },
  {
    id: "orchestrator",
    name: "Intelligence Orchestrator",
    version: "0.1.0",
    purpose:
      "Fuse all engine signals into one weighted view, resolve engine contradictions, and rank what matters now.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["fuse_signals", "resolve_conflicts", "rank_priorities"],
    dataOwned: ["orchestrator_runs", "signal_conflicts"],
    eventsPublished: [],
    eventsConsumed: ["CheckInSubmitted", "MealLogged", "WorkoutCompleted", "RoutineCompleted"],
    publishedSignals: [],
    requiredSignals: [
      "nutrition.kcal",
      "nutrition.protein_g",
      "nutrition.hydration_ml",
      "body.load_7d",
      "routine.streak",
      "learning.adherence",
    ],
    dependencies: ["nutrition", "body", "routine", "learning"],
    permissions: {
      dataRequested: ["engine_signals", "check_ins"],
      dataProvided: ["fused_axes", "priorities", "conflicts"],
      dataProhibited: ["reflections.entry"],
    },
  },
  {
    id: "timeline",
    name: "Timeline Service",
    version: "0.1.0",
    purpose: "Unify events, check-ins, reflections, recommendations, and signals into one feed.",
    owner: "HOS Kernel",
    status: "active",
    capabilities: ["unified_feed"],
    dataOwned: [],
    eventsPublished: [],
    eventsConsumed: [],
    publishedSignals: [],
    requiredSignals: [],
    dependencies: [],
    permissions: {
      dataRequested: ["hos_events", "check_ins", "reflections", "recommendations", "engine_signals"],
      dataProvided: ["timeline"],
      dataProhibited: [],
    },
  },
];


