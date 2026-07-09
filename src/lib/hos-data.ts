// Static seed data for the HOS Kernel visual shell.
// This lives on the client — real state persistence arrives in a later pass.

export const humanState = {
  energy: 74,
  focus: 68,
  recovery: 81,
  stress: 34,
  mood: 72,
  momentum: 66,
  confidence: 70,
  sleepHours: 7.4,
};

export type StateKey = keyof typeof humanState;

export const stateCards: Array<{
  key: StateKey;
  label: string;
  unit?: string;
  hint: string;
}> = [
  { key: "energy", label: "Energy", hint: "Trending up since 06:40" },
  { key: "focus", label: "Focus", hint: "Deep-work window: 09:00 – 11:30" },
  { key: "recovery", label: "Recovery", hint: "HRV 62 · RHR 54" },
  { key: "stress", label: "Stress", hint: "Below baseline" },
  { key: "mood", label: "Mood", hint: "Steady" },
  { key: "momentum", label: "Momentum", hint: "6-day standards streak" },
];

export const todaysPlan = [
  { time: "06:30", block: "Wake · hydrate · light exposure", tag: "ritual" },
  { time: "07:15", block: "Mobility + Zone 2, 40 min", tag: "body" },
  { time: "09:00", block: "Deep work · highest-leverage task", tag: "focus" },
  { time: "12:15", block: "Meal 1 · protein-forward, low-glycemic", tag: "nutrition" },
  { time: "14:00", block: "Second focus block · lighter cognitive load", tag: "focus" },
  { time: "17:30", block: "Walk + decompression, no inputs", tag: "recovery" },
  { time: "20:30", block: "Reflection · journal · standards review", tag: "ritual" },
  { time: "22:15", block: "Wind-down · lights dim · reading", tag: "recovery" },
] as const;

export const standards = [
  { text: "Sleep at least 7 hours", adherence: 86, streak: 12 },
  { text: "Move my body every day", adherence: 92, streak: 24 },
  { text: "Read 20 minutes before sleep", adherence: 78, streak: 6 },
  { text: "Journal every night", adherence: 71, streak: 3 },
  { text: "No screens first 60 minutes", adherence: 64, streak: 1 },
  { text: "Never break a standard twice", adherence: 95, streak: 41 },
];

export const signals = [
  { source: "Body OS", label: "HRV recovered", value: "+8%", tone: "good" as const },
  { source: "Trading OS", label: "Discipline score", value: "84", tone: "neutral" as const },
  { source: "Finance OS", label: "Budget headroom", value: "healthy", tone: "good" as const },
  { source: "Nutrition Engine", label: "Protein target", value: "at pace", tone: "good" as const },
  { source: "Inventory Engine", label: "Restock needed", value: "3 items", tone: "warn" as const },
];

export const achievements = {
  booksRead: 34,
  workouts: 812,
  meditationSessions: 461,
  consecutiveDays: 341,
  standardsMaintained: 6,
};

export const identity = {
  name: "Operator",
  becoming: "A calm, compounding version of myself",
  primaryStandard: "I never break a standard twice.",
};
