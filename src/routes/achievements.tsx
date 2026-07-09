import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { achievements } from "@/lib/hos-data";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Lifetime Ledger — Human OS" },
      {
        name: "description",
        content:
          "The compounding proof of who you are. Books, workouts, meditations, and consecutive days — recorded, never lost.",
      },
    ],
  }),
  component: AchievementsPage,
});

const milestones: Array<{
  when: string;
  title: string;
  note: string;
}> = [
  { when: "2026-07-04", title: "6 standards held simultaneously", note: "First week clearing every line." },
  { when: "2026-06-21", title: "800th workout", note: "Zone 2, 45 min. Quiet." },
  { when: "2026-05-14", title: "One year without a phone in bed", note: "Sleep score up 14 pts vs baseline." },
  { when: "2026-03-02", title: "300-day journaling streak", note: "Longest continuous run of reflection." },
  { when: "2025-11-30", title: "First deload week completed to plan", note: "Recovery model calibrated." },
];

export function AchievementsPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Lifetime ledger"
        title="Compounding proof of who you are."
        intro="No feed. No badges. Only the counts and the moments the Kernel records because they cannot be argued with."
      />

      {/* Big counts */}
      <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Big label="Books read" value={achievements.booksRead} />
        <Big label="Workouts" value={achievements.workouts} />
        <Big label="Meditations" value={achievements.meditationSessions} />
        <Big label="Consecutive days" value={achievements.consecutiveDays} />
        <Big label="Standards held" value={achievements.standardsMaintained} />
      </section>

      {/* Milestones */}
      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Milestones
        </div>
        <h2 className="mt-1 font-display text-xl">Moments the system will not forget</h2>

        <ol className="mt-6 space-y-0">
          {milestones.map((m) => (
            <li
              key={m.when}
              className="grid grid-cols-[110px_1fr] items-start gap-4 border-t hairline py-5 first:border-t-0 first:pt-0"
            >
              <div className="font-mono text-xs text-muted-foreground">
                {m.when}
              </div>
              <div>
                <div className="font-display text-base text-foreground">
                  {m.title}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {m.note}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}

function Big({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border hairline bg-surface p-5">
      <div className="font-display text-4xl leading-none">
        {value.toLocaleString()}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
