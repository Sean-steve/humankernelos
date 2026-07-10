import { createFileRoute } from "@tanstack/react-router";
import { Check, Ban } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { protocols } from "@/lib/hos-protocols";

export const Route = createFileRoute("/protocols")({
  head: () => ({
    meta: [
      { title: "Operating Protocols — Human OS" },
      {
        name: "description",
        content:
          "The repeatable playbooks the Kernel runs on the human. Boot, deep work, shutdown, review, recovery.",
      },
    ],
  }),
  component: ProtocolsPage,
});

function ProtocolsPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Operating protocols"
        title="The playbooks the system runs on itself."
        intro="A protocol is a decision made once, executed forever. The Kernel triggers them, tracks adherence, and quietly removes the need to decide again."
      />

      <section className="mt-10 flex flex-col gap-5">
        {protocols.map((p) => (
          <article
            key={p.slug}
            className="rounded-2xl border hairline bg-surface p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {p.cadence}
                </div>
                <h2 className="mt-1 font-display text-2xl">{p.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/90">
                  {p.purpose}
                </p>
              </div>
              <div className="rounded-md border hairline bg-background/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <div className="uppercase tracking-[0.14em]">Trigger</div>
                <div className="mt-1 max-w-[240px] text-foreground/85">
                  {p.trigger}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Sequence
                </div>
                <ol className="mt-3 space-y-2">
                  {p.steps.map((s, i) => (
                    <li
                      key={s}
                      className="flex items-start gap-3 rounded-md border hairline bg-background/40 px-3 py-2"
                    >
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-[10px] text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground/95">{s}</span>
                      <Check
                        className="ml-auto h-3.5 w-3.5 text-muted-foreground/50"
                        strokeWidth={1.5}
                      />
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Guardrails
                </div>
                <ul className="mt-3 space-y-2">
                  {p.guardrails.map((g) => (
                    <li
                      key={g}
                      className="flex items-start gap-2.5 text-sm text-foreground/85"
                    >
                      <Ban
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                        style={{ color: "var(--color-warning)" }}
                        strokeWidth={1.5}
                      />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>
    </Shell>
  );
}
