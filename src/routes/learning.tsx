import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Brain } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { FollowUpMeasure } from "@/components/hos/FollowUpMeasure";
import { getLearningSummary, synthesizePatterns } from "@/lib/learning.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning Loop — Human OS" },
      {
        name: "description",
        content:
          "Measure whether directives were executed, what they moved, and which personal patterns the Kernel has learned.",
      },
      { property: "og:title", content: "Learning Loop — Human OS" },
      {
        property: "og:description",
        content:
          "Adherence, measured effect per state axis, recurring friction, and learned personal patterns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearningPage,
});

type Pattern = {
  id: string;
  label: string;
  description: string;
  axis: string | null;
  evidence_count: number;
  confidence: number | null;
};

function LearningPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const summary = useServerFn(getLearningSummary);
  const synth = useServerFn(synthesizePatterns);

  const { data, isLoading } = useQuery({
    queryKey: ["learning-summary"],
    queryFn: () => summary(),
    enabled: !!session,
  });

  const relearn = useMutation({
    mutationFn: () => synth(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-summary"] }),
  });

  const axisImpact = (data?.axisImpact ?? {}) as Record<string, number | null>;
  const patterns = (data?.patterns ?? []) as unknown as Pattern[];

  return (
    <Shell>
      <PageHeader
        eyebrow="Article XII"
        title="Learning Loop"
        intro="Observe, recommend, execute, measure, reflect, learn. Nothing here is assumed — every number comes from a directive you actually measured."
      />


      {!session && (
        <div className="rounded-2xl border hairline bg-surface p-6 text-sm text-muted-foreground">
          Sign in to measure directives and build your personal pattern library.
        </div>
      )}

      {session && (
        <div className="space-y-8">
          <FollowUpMeasure />

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading outcomes…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Adherence"
                  value={data?.adherence !== null && data?.adherence !== undefined ? `${data.adherence}%` : "—"}
                />
                <Stat label="Measured" value={String(data?.totals.measured ?? 0)} />
                <Stat label="Awaiting measurement" value={String(data?.totals.pending ?? 0)} />
              </div>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <h2 className="font-display text-lg">Measured effect per axis</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(axisImpact).map(([axis, value]) => (
                    <div
                      key={axis}
                      className="flex items-center justify-between rounded-xl border hairline bg-surface-elevated px-3 py-2"
                    >
                      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {axis}
                      </span>
                      <span
                        className={`font-mono text-sm ${
                          value === null
                            ? "text-muted-foreground"
                            : value > 0
                              ? "text-primary"
                              : value < 0
                                ? "text-warning"
                                : ""
                        }`}
                      >
                        {value === null ? "—" : value > 0 ? `+${value}` : value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <h2 className="font-display text-lg">By directive type</h2>
                <div className="mt-4 space-y-2">
                  {(data?.byType ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No measured directives yet.
                    </p>
                  )}
                  {(data?.byType ?? []).map((t) => (
                    <div
                      key={t.type}
                      className="flex items-center justify-between rounded-xl border hairline bg-surface-elevated px-3 py-2 text-sm"
                    >
                      <span className="capitalize">{t.type}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.adherence}% executed · effect{" "}
                        {t.avgEffect === null ? "—" : t.avgEffect > 0 ? `+${t.avgEffect}` : t.avgEffect} ·{" "}
                        {t.measured} measured
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <h2 className="font-display text-lg">Recurring friction</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(data?.frictions ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing repeated yet.</p>
                  )}
                  {(data?.frictions ?? []).map((f) => (
                    <span
                      key={f.friction}
                      className="rounded-md border border-warning/40 px-2 py-1 text-[11px] text-warning"
                    >
                      {f.friction} ×{f.count}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border hairline bg-surface p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                      <Brain className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <h2 className="font-display text-lg">Learned patterns</h2>
                  </div>
                  <button
                    onClick={() => relearn.mutate()}
                    disabled={relearn.isPending}
                    className="inline-flex items-center gap-2 rounded-md border hairline bg-surface-elevated px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                  >
                    {relearn.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Re-learn
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {patterns.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No patterns yet. Measure at least three directives, then re-learn.
                    </p>
                  )}
                  {patterns.map((p) => (
                    <div key={p.id} className="rounded-xl border hairline bg-surface-elevated p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm">{p.label}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {p.confidence !== null ? `${Math.round(p.confidence * 100)}%` : "—"} ·{" "}
                          {p.evidence_count} obs
                        </div>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {p.description}
                      </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border hairline bg-surface p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
    </div>
  );
}
