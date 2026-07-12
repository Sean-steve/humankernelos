// The Engine contract: how any future engine plugs into the Kernel.
// The Kernel never reads engine-internal tables. It only reads engine_signals.

export type HosEventType =
  | "MealLogged"
  | "WorkoutCompleted"
  | "RoutineCompleted"
  | "CheckInSubmitted"
  | "ReflectionSaved";

export type EngineSignal = {
  engine: string;
  signal_key: string;
  value_num?: number | null;
  value_text?: string | null;
};

export interface EngineDescriptor {
  id: string;
  name: string;
  emits: HosEventType[];
  signals: string[];
}

export const REGISTERED_ENGINES: EngineDescriptor[] = [
  {
    id: "nutrition",
    name: "Nutrition Engine",
    emits: ["MealLogged"],
    signals: ["nutrition.hydration_ml", "nutrition.protein_g", "nutrition.kcal"],
  },
  {
    id: "body",
    name: "Body Engine",
    emits: ["WorkoutCompleted"],
    signals: ["body.load_7d", "body.last_session_min"],
  },
  {
    id: "routine",
    name: "Routine Engine",
    emits: ["RoutineCompleted"],
    signals: ["routine.streak", "routine.completed_today"],
  },
];
