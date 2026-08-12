import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, Workflow } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import {
  getLatestOrchestratorRun,
  runOrchestrator,
  type Conflict,
  type FusedAxis,
  type Priority,
} from "@/lib/orchestrator.functions";

export const Route = createFileRoute("/orchestrator")({
  head: () => ({
    meta: [
      { title: "Intelligence Orchestrator — Human OS" },
      {
        name: "description",
        content:
          "See how the Kernel fuses every engine signal, resolves contradictions between engines, and ranks what matters most right now.",
      },
      { property: "og:title", content: "Intelligence Orchestrator — Human OS" },
      {
        property: "og:description",
        content:
          "Fused state axes, resolved signal conflicts, and today's ranked priority list — the Kernel's reasoning, made inspectable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrchestratorPage,
});

function OrchestratorPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const latest = useServerFn(getLatestOrchestratorRun);
  const run = useServerFn(runOrchestrator);

  const { data, isLoading } = useQuery({
    queryKey: ["orchestrator-run"],
    queryFn: () => latest(),
    enabled: !!session,
  });

  const refuse = useMutation({
    mutationFn: () => run(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orchestrator-run"] }),
  });

  const current = data?.run ?? null;
  const fused = (current?.fused ?? []) as FusedAxis[];
  const conflicts = (current?.conflicts ?? []) as Conflict[];
  const priorities = (current?.priorities ?? []) as Priority[];

  return (
    <Shell>
      <PageHeader
        eyebrow="Article IX"
        title="Intelligence Orchestrator"
        intro="Engines report. The Orchestrator weighs each report by confidence, reliability and recency, resolves the ones that contradict each other, and ranks what actually deserves your attention now."
      />

      {!session && (
        <div className="rounded-2xl border hairline bg-surface p-6 text-sm text-muted-foreground">
          Sign in to fuse your signals and see the ranked priority list.
        </div>
      )}

      {session && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border hairline bg-surface p-5">
            <div className="text-sm text-muted-foreground">
              {current ? (
                <>
                  Last fusion{" "}
                  <span className="text-foreground">
                    {new Date(current.generated_at).toLocaleString()}
                  </span>{" "}
                  · {current.signal_count} signals read
                </>
              ) : (
                "No fusion run yet."
              )}
            </div>
            <button
              onClick={() => refuse.mutate()}
              disabled={refuse.isPending}
              className="inline-flex items-center gap-2 rounded-md border hairline bg-surface-elevated px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
            >
              {refuse.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Run fusion
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading last run…
            </div>
          )}

          {!isLoading && !current && (
            <div className="rounded-2xl border hairline bg-surface p-6 text-sm text-muted-foreground">
              Run fusion to produce your first fused state, conflict set and priority ranking.
            </div>
          )}

          {current && (
            <>
              <section className="rounded-2xl border hairline bg-surface p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                    <Workflow className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-lg">Ranked priorities</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {priorities.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Not enough data to rank anything. Log a check-in first.
                    </p>
                  )}
                  {priorities.map((p, i) => (
                    <div
                      key={p.key}
                      className="rounded-xl border hairline bg-surface-elevated p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 font-mono text-xs text-primary">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <div className="text-sm">{p.label}</div>
                            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                              {p.whyNow}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                          <div>score {p.score}</div>
                          <div>{Math.round(p.confidence * 100)}% conf</div>
                        </div>
                      </div>
                      {p.evidence.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.evidence.map((e) => (
                            <span
                              key={e}
                              className="rounded border hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <h2 className="font-display text-lg">Fused state</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  One weighted value per axis, with every source that produced it.
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {fused.map((f) => (
                    <div
                      key={f.axis}
                      className="rounded-xl border hairline bg-surface-elevated p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {f.axis}
                          {f.contested && (
                            <span className="ml-2 rounded border border-warning/40 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-warning">
                              contested
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-sm">
                          {f.value === null ? "—" : f.value}
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {f.confidence === null
                              ? ""
                              : `${Math.round(f.confidence * 100)}% conf`}
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${
                            f.contested ? "bg-warning" : "bg-primary"
                          }`}
                          style={{ width: `${f.value ?? 0}%` }}
                        />
                      </div>

                      <div className="mt-3 space-y-1">
                        {f.contributions.length === 0 && (
                          <p className="text-[12px] text-muted-foreground">
                            {f.note ?? "No sources."}
                          </p>
                        )}
                        {f.contributions.map((c) => (
                          <div
                            key={c.source}
                            className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"
                          >
                            <span>{c.source}</span>
                            <span>
                              {c.normalized}/100 · w {c.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-warning/15 text-warning">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-lg">Resolved conflicts</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {conflicts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No engine is contradicting another right now.
                    </p>
                  )}
                  {conflicts.map((c) => (
                    <div
                      key={c.axis + c.resolution}
                      className="rounded-xl border hairline bg-surface-elevated p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {c.axis}
                        </span>
                        <span className="font-mono text-[11px] text-warning">
                          severity {c.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{c.resolution}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {c.reason}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.competing.map((k) => (
                          <span
                            key={k.source}
                            className="rounded border hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {k.engine}·{k.source} → {k.normalized} (w {k.weight})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
