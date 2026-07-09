import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { signalStream } from "@/lib/hos-extras";

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "Signals — Human OS" },
      {
        name: "description",
        content:
          "The living stream of signals the Kernel receives from every connected engine. Calm, filtered, ranked by relevance to the human.",
      },
    ],
  }),
  component: SignalsPage,
});

const toneColor = {
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-destructive)",
  neutral: "var(--color-muted-foreground)",
} as const;

function SignalsPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Signals"
        title="The ecosystem, speaking quietly."
        intro="Every connected engine emits signals. The Kernel filters, ranks, and only surfaces what changes your next decision."
      />

      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <ol className="space-y-0">
          {signalStream.map((s) => (
            <li
              key={s.time + s.message}
              className="grid grid-cols-[60px_120px_1fr_auto] items-center gap-4 border-t hairline py-4 first:border-t-0 first:pt-0"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {s.time}
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {s.source}
              </span>
              <span className="text-sm text-foreground/95">{s.message}</span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: toneColor[s.tone] }}
              />
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}
