import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, History, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { Advisor } from "@/components/hos/Advisor";
import { FollowUpMeasure } from "@/components/hos/FollowUpMeasure";
import { useSession } from "@/hooks/use-session";
import { getLearningSummary } from "@/lib/learning.functions";
import { listPersonalMemory, listDecisionMemory } from "@/lib/memory.functions";
import { listRecommendations } from "@/lib/pdie.functions";
import { refreshPersonalKernel } from "@/lib/kernel-cycle.functions";

export const Route = createFileRoute("/intelligence")({
  head: () => ({
    meta: [
      { title: "Intelligence — HumanKernelOS" },
      {
        name: "description",
        content:
          "Recommendations, measured outcomes, learned patterns, and durable personal memory in one human-readable workspace.",
      },
    ],
  }),
  component: IntelligencePage,
});

type Recommendation = {
  id: string;
  title: string;
  body: string;
  status: string;
  confidence: number | null;
  created_at: string;
};

type Memory = {
  id: string;
  memory_type: string;
  summary: string;
  confidence: number | null;
  evidence: unknown;
  last_observed_at: string;
};

type Decision = {
  id: string;
  chosen_action: string;
  decision_status: string;
  actual_outcome: string | null;
  lesson: string | null;
  confidence: number | null;
  decided_at: string;
};

function IntelligencePage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const getLearning = useServerFn(getLearningSummary);
  const getMemory = useServerFn(listPersonalMemory);
  const getDecisions = useServerFn(listDecisionMemory);
  const getRecommendations = useServerFn(listRecommendations);
  const refreshKernel = useServerFn(refreshPersonalKernel);

  const learning = useQuery({
    queryKey: ["intelligence-learning"],
    enabled: !!session,
    queryFn: () => getLearning(),
  });
  const memory = useQuery({
    queryKey: ["intelligence-memory"],
    enabled: !!session,
    queryFn: () => getMemory(),
  });
  const decisions = useQuery({
    queryKey: ["intelligence-decisions"],
    enabled: !!session,
    queryFn: () => getDecisions(),
  });
  const recommendations = useQuery({
    queryKey: ["intelligence-recommendations"],
    enabled: !!session,
    queryFn: () => getRecommendations(),
  });

  const refresh = useMutation({
    mutationFn: () => refreshKernel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intelligence-learning"] });
      qc.invalidateQueries({ queryKey: ["intelligence-memory"] });
      qc.invalidateQueries({ queryKey: ["intelligence-decisions"] });
      qc.invalidateQueries({ queryKey: ["intelligence-recommendations"] });
      qc.invalidateQueries({ queryKey: ["hsv"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });

  const patterns = (learning.data?.patterns ?? []) as Array<{
    id: string;
    label: string;
    description: string;
    evidence_count: number;
    confidence: number | null;
  }>;
  const memories = (memory.data?.memories ?? []) as Memory[];
  const recentDecisions = ((decisions.data?.decisions ?? []) as Decision[]).slice(0, 6);
  const recentRecommendations = ((recommendations.data?.recommendations ?? []) as Recommendation[]).slice(0, 6);

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Intelligence"
          title="What HOS is learning about how you operate."
          intro="Recommendations stay explainable, your decisions stay authoritative, and patterns only become memory after evidence accumulates."
        />
        {session && (
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex items-center gap-2 rounded-xl border hairline bg-surface px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {refresh.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh Kernel
          </button>
        )}
      </div>

      {!session ? (
        <div className="mt-8 rounded-xl border hairline bg-primary/5 p-4 text-sm text-muted-foreground">
          Sign in to access personal recommendations, learning, and memory.
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <Advisor />
          <FollowUpMeasure />

          <section className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Recommendation adherence"
              value={
                learning.data?.adherence !== null && learning.data?.adherence !== undefined
                  ? `${learning.data.adherence}%`
                  : "—"
              }
            />
            <Stat label="Measured outcomes" value={String(learning.data?.totals.measured ?? 0)} />
            <Stat label="Learned patterns" value={String(patterns.length)} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border hairline bg-surface p-5">
              <SectionTitle
                icon={Sparkles}
                eyebrow="Patterns"
                title="What keeps repeating"
              />
              <div className="mt-4 space-y-3">
                {learning.isLoading && <Loading />}
                {!learning.isLoading && patterns.length === 0 && (
                  <Empty>
                    Nothing has repeated enough to call it a pattern yet. Measure outcomes rather than guessing.
                  </Empty>
                )}
                {patterns.map((pattern) => (
                  <div key={pattern.id} className="rounded-xl border hairline bg-background/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{pattern.label}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {pattern.confidence !== null
                          ? `${Math.round(pattern.confidence * 100)}%`
                          : "—"}{" "}
                        · {pattern.evidence_count} obs
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {pattern.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border hairline bg-surface p-5">
              <SectionTitle
                icon={Brain}
                eyebrow="Memory"
                title="Durable things HOS has learned"
              />
              <div className="mt-4 space-y-3">
                {memory.isLoading && <Loading />}
                {!memory.isLoading && memories.length === 0 && (
                  <Empty>
                    Personal memory is empty. HOS will not manufacture history; evidence-backed lessons appear here over time.
                  </Empty>
                )}
                {memories.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border hairline bg-background/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {item.memory_type}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : "—"}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border hairline bg-surface p-5">
              <SectionTitle
                icon={History}
                eyebrow="Decision memory"
                title="What you chose, and what happened"
              />
              <div className="mt-4 space-y-3">
                {decisions.isLoading && <Loading />}
                {!decisions.isLoading && recentDecisions.length === 0 && (
                  <Empty>Your accepted, modified, and dismissed decisions will build a traceable history here.</Empty>
                )}
                {recentDecisions.map((decision) => (
                  <div key={decision.id} className="rounded-xl border hairline bg-background/25 p-4">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {decision.decision_status}
                    </div>
                    <div className="mt-1 text-sm">{decision.chosen_action}</div>
                    {decision.actual_outcome && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Outcome: {decision.actual_outcome}
                      </div>
                    )}
                    {decision.lesson && (
                      <div className="mt-1 text-xs text-primary">
                        Lesson: {decision.lesson}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border hairline bg-surface p-5">
              <SectionTitle
                icon={Sparkles}
                eyebrow="Recent advice"
                title="Recommendations"
              />
              <div className="mt-4 space-y-3">
                {recommendations.isLoading && <Loading />}
                {!recommendations.isLoading && recentRecommendations.length === 0 && (
                  <Empty>Ask the advisor when you want HOS to turn your current context into a recommendation.</Empty>
                )}
                {recentRecommendations.map((rec) => (
                  <div key={rec.id} className="rounded-xl border hairline bg-background/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{rec.title}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {rec.status}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {rec.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Link to="/learning" className="text-xs text-muted-foreground hover:text-foreground">
              Open detailed learning analysis →
            </Link>
          </div>
        </div>
      )}
    </Shell>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof Brain;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="font-display text-lg">{title}</h2>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border hairline bg-surface p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed hairline bg-background/20 p-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
