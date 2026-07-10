// Operating protocols — repeatable playbooks the human runs on themselves.

export type Protocol = {
  slug: string;
  name: string;
  cadence: string;
  purpose: string;
  trigger: string;
  steps: string[];
  guardrails: string[];
};

export const protocols: Protocol[] = [
  {
    slug: "morning-boot",
    name: "Morning Boot Sequence",
    cadence: "Daily · 06:30",
    purpose: "Bring the system online in the highest possible operating condition.",
    trigger: "First contact with the day, before any inputs.",
    steps: [
      "Hydrate — 500ml water with electrolytes",
      "Direct light exposure, 10 minutes",
      "Mobility flow, 8 minutes",
      "Read one identity statement out loud",
      "Write today's single most important task",
    ],
    guardrails: [
      "No phone in the first 60 minutes",
      "No news, no social, no email",
      "No caffeine before 90 minutes awake",
    ],
  },
  {
    slug: "deep-work",
    name: "Deep Work Window",
    cadence: "Weekdays · 09:00 – 11:30",
    purpose: "Compound the highest-leverage cognitive output of the day.",
    trigger: "Kernel opens focus window and silences all engines.",
    steps: [
      "Close every tab except the one that matters",
      "Set 90-minute timer, single objective",
      "Work · standing or seated, no context switches",
      "5-minute walk between blocks",
      "Log what shipped, what stalled",
    ],
    guardrails: [
      "No meetings inside the window",
      "No Slack, no inbox, no chat surfaces",
      "If interrupted, name the interrupter in the log",
    ],
  },
  {
    slug: "evening-shutdown",
    name: "Evening Shutdown",
    cadence: "Daily · 21:30",
    purpose: "Close open loops so recovery can actually happen.",
    trigger: "Sunset + 90 minutes, or 21:30 — whichever comes first.",
    steps: [
      "Review today against personal standards",
      "Journal · one paragraph, one truth",
      "Pre-decide tomorrow's first task",
      "Lights dim to warm, screens off",
      "Read paper book, 20 minutes",
    ],
    guardrails: [
      "No screens after 22:00",
      "No stimulating conversations",
      "No decisions about tomorrow after 22:30",
    ],
  },
  {
    slug: "weekly-review",
    name: "Weekly Review",
    cadence: "Sundays · 17:00",
    purpose: "Recalibrate the operating system against reality.",
    trigger: "End of week, before planning the next.",
    steps: [
      "Read this week's journal end-to-end",
      "Score standards adherence, honestly",
      "Name one thing to remove next week",
      "Name one thing to add next week",
      "Update identity statements if needed",
    ],
    guardrails: [
      "No planning without reviewing first",
      "No adding without removing",
      "No lying to the journal",
    ],
  },
  {
    slug: "recovery-protocol",
    name: "Recovery Protocol",
    cadence: "On demand · when HRV drops or stress spikes",
    purpose: "Return the nervous system to baseline in the shortest path.",
    trigger: "Body OS flags HRV below 7-day floor, or stress > 65.",
    steps: [
      "Stop the current task, name it 'paused'",
      "10 minutes outside, no phone",
      "Box breathing · 4-4-4-4, 12 rounds",
      "One glass of water",
      "Return only when the body says yes",
    ],
    guardrails: [
      "No caffeine",
      "No stacking obligations",
      "No self-negotiation about skipping",
    ],
  },
];
