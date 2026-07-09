// Extended static seed data for secondary OS surfaces.

export type Trend = "up" | "down" | "flat";

export const humanStateTimeline: Array<{
  label: string;
  energy: number;
  focus: number;
  recovery: number;
  stress: number;
}> = [
  { label: "06:00", energy: 58, focus: 42, recovery: 78, stress: 28 },
  { label: "08:00", energy: 71, focus: 62, recovery: 80, stress: 30 },
  { label: "10:00", energy: 78, focus: 82, recovery: 81, stress: 32 },
  { label: "12:00", energy: 74, focus: 74, recovery: 81, stress: 38 },
  { label: "14:00", energy: 66, focus: 60, recovery: 79, stress: 42 },
  { label: "16:00", energy: 62, focus: 55, recovery: 78, stress: 40 },
  { label: "18:00", energy: 70, focus: 58, recovery: 80, stress: 34 },
];

export const stateNarratives: Record<string, string> = {
  energy: "Recovery held overnight and morning light lifted arousal. Expect a natural dip between 14:00–16:00.",
  focus: "Two clean deep-work windows available today. Second window will be lighter — batch shallow work there.",
  recovery: "HRV above your 30-day baseline. Nervous system is receptive to load.",
  stress: "Below baseline. No cortisol spikes overnight. Safe to introduce challenge.",
  mood: "Steady. No affective volatility flagged in the last 48 hours.",
  momentum: "Six consecutive days holding all seven personal standards.",
};

export type EngineStatus = "online" | "syncing" | "offline";

export const engines: Array<{
  name: string;
  scope: string;
  status: EngineStatus;
  lastSync: string;
  notes: string;
}> = [
  {
    name: "Body OS",
    scope: "Training, mobility, sleep, HRV",
    status: "online",
    lastSync: "2 min ago",
    notes: "Recovery model updated. Zone 2 window confirmed for 07:15.",
  },
  {
    name: "Trading OS",
    scope: "Setups, discipline, journaling",
    status: "online",
    lastSync: "6 min ago",
    notes: "Discipline score 84. No revenge-trade patterns detected.",
  },
  {
    name: "Finance OS",
    scope: "Cash, runway, allocations",
    status: "online",
    lastSync: "12 min ago",
    notes: "Budget headroom healthy through end of month.",
  },
  {
    name: "Nutrition Engine",
    scope: "Protein, glucose, hydration",
    status: "syncing",
    lastSync: "just now",
    notes: "Reconciling last meal window with CGM stream.",
  },
  {
    name: "Inventory Engine",
    scope: "Supplements, gear, household",
    status: "online",
    lastSync: "1 h ago",
    notes: "3 items below threshold — reorder queued for review.",
  },
  {
    name: "Learning OS",
    scope: "Reading, notes, spaced review",
    status: "offline",
    lastSync: "yesterday",
    notes: "Awaiting first sync — connect from Kernel > Engines.",
  },
];

export const signalStream: Array<{
  time: string;
  source: string;
  message: string;
  tone: "good" | "warn" | "neutral" | "bad";
}> = [
  { time: "06:41", source: "Body OS", message: "HRV recovered +8% vs 7-day avg.", tone: "good" },
  { time: "07:02", source: "Nutrition", message: "Overnight glucose stable (mean 92 mg/dL).", tone: "good" },
  { time: "08:15", source: "Trading OS", message: "Pre-market watchlist locked. 2 A+ setups.", tone: "neutral" },
  { time: "09:34", source: "Kernel", message: "Deep-work window opened. Notifications silenced.", tone: "neutral" },
  { time: "11:12", source: "Inventory", message: "Magnesium below 5-day threshold.", tone: "warn" },
  { time: "12:48", source: "Finance OS", message: "Recurring charge above baseline: review.", tone: "warn" },
  { time: "13:20", source: "Body OS", message: "Sitting streak 92 min — stand cue sent.", tone: "warn" },
  { time: "15:05", source: "Learning OS", message: "3 cards due for spaced review.", tone: "neutral" },
];

export const reflectionPrompts = [
  "What did I do today that my future self will thank me for?",
  "Where did I break a standard, and what was the trigger?",
  "What did I learn about how my system actually operates?",
  "What is the one thing I will remove tomorrow?",
  "Where did I operate below my known potential — and why?",
];

export const identityStatements = [
  "I am someone who never breaks a standard twice.",
  "I am someone who moves my body every day.",
  "I am someone who reads before I sleep.",
  "I am someone who tells the truth in my journal.",
  "I am someone who compounds calmly, over decades.",
];
