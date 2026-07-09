import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { StateRing } from "@/components/hos/StateRing";
import { humanState, stateCards } from "@/lib/hos-data";
import { humanStateTimeline, stateNarratives } from "@/lib/hos-extras";

export const Route = createFileRoute("/human-state")({
  head: () => ({
    meta: [
      { title: "Human State — Human OS" },
      {
        name: "description",
        content:
          "The living read-out of your energy, focus, recovery, stress, mood, and momentum — the signals the Kernel operates on.",
      },
    ],
  }),
  component: HumanStatePage,
});

function HumanStatePage() {
  const max = 100;

  return (
    <Shell>
      <PageHeader
        eyebrow="Human state"
        title="How the system reads you."
        intro="These are the six core signals the Kernel uses to calibrate every decision — the plan, the advisor, and the load each engine may request from you."
      />

      {/* Six-up */}
      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stateCards.map(({ key, label, hint }) => {
          const value = humanState[key];
          const inverse = key === "stress";
          return (
            <article
              key={key}
              className="rounded-2xl border hairline bg-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 font-display text-4xl leading-none">
                    {value}
                    <span className="ml-1 text-sm text-muted-foreground">/100</span>
                  </div>
                </div>
                <StateRing value={value} inverse={inverse} size={56} stroke={4} />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {stateNarratives[key] ?? hint}
              </p>
            </article>
          );
        })}
      </section>

      {/* Timeline */}
      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Today, hour by hour
        </div>
        <h2 className="mt-1 font-display text-xl">
          Where your operating condition moves
        </h2>

        <div className="mt-8 grid grid-cols-7 gap-3">
          {humanStateTimeline.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-1">
                <Bar value={t.energy} max={max} color="var(--color-primary)" />
                <Bar value={t.focus} max={max} color="var(--color-accent)" />
                <Bar value={t.recovery} max={max} color="var(--color-success)" />
                <Bar value={t.stress} max={max} color="var(--color-warning)" />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {t.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <Legend color="var(--color-primary)" label="Energy" />
          <Legend color="var(--color-accent)" label="Focus" />
          <Legend color="var(--color-success)" label="Recovery" />
          <Legend color="var(--color-warning)" label="Stress" />
        </div>
      </section>

      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Sleep · last night
        </div>
        <div className="mt-3 grid gap-6 md:grid-cols-4">
          <Stat label="Total" value={`${humanState.sleepHours}h`} />
          <Stat label="Deep" value="1h 42m" />
          <Stat label="REM" value="1h 28m" />
          <Stat label="Efficiency" value="92%" />
        </div>
      </section>
    </Shell>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(4, (value / max) * 100);
  return (
    <div className="relative flex-1 overflow-hidden rounded-sm bg-background/40">
      <div
        style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
        className="absolute inset-x-0 bottom-0"
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
