import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { standards, identity } from "@/lib/hos-data";
import { identityStatements } from "@/lib/hos-extras";

export const Route = createFileRoute("/standards")({
  head: () => ({
    meta: [
      { title: "Personal Standards — Human OS" },
      {
        name: "description",
        content:
          "Standards are who you are, measured. The Kernel tracks adherence, streaks, and the primary standard you never break twice.",
      },
    ],
  }),
  component: StandardsPage,
});

function StandardsPage() {
  const avg = Math.round(
    standards.reduce((s, x) => s + x.adherence, 0) / standards.length,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Personal standards"
        title="Who I am, measured."
        intro="A standard is not a goal. It is a line you have drawn about who you are. The Kernel measures the distance between that line and your actual behavior — quietly, every day."
      />

      {/* Primary standard */}
      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Primary standard
        </div>
        <p className="mt-3 font-display text-3xl leading-tight text-foreground">
          "{identity.primaryStandard}"
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Everything else negotiates around this one.
        </p>
      </section>

      {/* Adherence */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Adherence
              </div>
              <h2 className="mt-1 font-display text-xl">
                Standards, past 30 days
              </h2>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl leading-none">{avg}%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Composite
              </div>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {standards.map((s) => {
              const color =
                s.adherence >= 85
                  ? "var(--color-success)"
                  : s.adherence >= 70
                    ? "var(--color-primary)"
                    : "var(--color-warning)";
              return (
                <li key={s.text}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/95">{s.text}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.streak}d · {s.adherence}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.adherence}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Identity */}
        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Identity statements
          </div>
          <h2 className="mt-1 font-display text-xl">The person under it all</h2>
          <ul className="mt-5 space-y-3">
            {identityStatements.map((s) => (
              <li
                key={s}
                className="flex items-start gap-3 rounded-md bg-background/40 px-3 py-2.5 text-sm"
              >
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={2}
                />
                <span className="text-foreground/95">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Shell>
  );
}
