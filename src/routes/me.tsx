import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2, Plus, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import { getMyProfile } from "@/lib/history.functions";
import { listGoals, upsertGoal, updateGoalProgress } from "@/lib/goals.functions";
import { listPolicies } from "@/lib/policy.functions";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Me — HumanKernelOS" },
      {
        name: "description",
        content:
          "Your identity, goals, standards, and personal policies—the human context HumanKernelOS is here to protect.",
      },
    ],
  }),
  component: MePage,
});

type Goal = {
  id: string;
  title: string;
  description: string | null;
  horizon: string;
  priority: number;
  progress: number;
  status: string;
  target_date: string | null;
};

function MePage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const goalsFn = useServerFn(listGoals);
  const policiesFn = useServerFn(listPolicies);
  const saveGoal = useServerFn(upsertGoal);
  const setProgress = useServerFn(updateGoalProgress);

  const [showGoal, setShowGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");

  const profile = useQuery({
    queryKey: ["me-profile"],
    enabled: !!session,
    queryFn: () => profileFn(),
  });
  const goals = useQuery({
    queryKey: ["me-goals"],
    enabled: !!session,
    queryFn: () => goalsFn(),
  });
  const policies = useQuery({
    queryKey: ["me-policies"],
    enabled: !!session,
    queryFn: () => policiesFn(),
  });

  const createGoal = useMutation({
    mutationFn: () =>
      saveGoal({
        data: {
          title: goalTitle.trim(),
          horizon: "quarterly",
          priority: 100,
          status: "active",
          progress: 0,
          metadata: {},
        },
      }),
    onSuccess: () => {
      setGoalTitle("");
      setShowGoal(false);
      qc.invalidateQueries({ queryKey: ["me-goals"] });
    },
  });

  const progress = useMutation({
    mutationFn: (input: { id: string; progress: number }) =>
      setProgress({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-goals"] }),
  });

  const activeGoals = ((goals.data?.goals ?? []) as Goal[]).filter(
    (goal) => goal.status === "active",
  );
  const activePolicies = (policies.data?.policies ?? []).filter(
    (policy) => policy.active,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Me"
        title="The person HOS is operating for."
        intro="Identity, direction, and non-negotiables belong to you. Engines can inform them, but they cannot own them."
      />

      {!session ? (
        <div className="mt-8 rounded-xl border hairline bg-primary/5 p-4 text-sm text-muted-foreground">
          Sign in to load your identity, goals, and personal policies.
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl border hairline bg-surface p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Identity
                  </div>
                  <div className="font-display text-xl">
                    {profile.data?.profile?.name ?? "Your profile"}
                  </div>
                </div>
              </div>

              {profile.isLoading ? (
                <Loading />
              ) : (
                <div className="mt-5 space-y-4">
                  <Context label="Becoming">
                    {profile.data?.profile?.becoming ?? "Not configured yet."}
                  </Context>
                  <Context label="Primary standard">
                    {profile.data?.profile?.primary_standard ?? "Not configured yet."}
                  </Context>
                </div>
              )}

              <div className="mt-6">
                <Link
                  to="/settings"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit identity and statements →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border hairline bg-surface p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Personal policies
                  </div>
                  <div className="font-display text-xl">
                    {activePolicies.length} active
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {activePolicies.length === 0 ? (
                  <Empty>No active personal policies yet.</Empty>
                ) : (
                  activePolicies.slice(0, 4).map((policy) => (
                    <div
                      key={policy.id}
                      className="rounded-xl border hairline bg-background/25 p-3"
                    >
                      <div className="text-sm">{policy.name}</div>
                      {policy.description && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {policy.description}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5">
                <Link
                  to="/policies"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Manage personal policies →
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border hairline bg-surface p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Direction
                </div>
                <h2 className="mt-1 font-display text-xl">Active goals</h2>
              </div>
              <button
                onClick={() => setShowGoal((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg border hairline px-3 py-2 text-xs hover:bg-surface-elevated"
              >
                <Plus className="h-3.5 w-3.5" /> Add goal
              </button>
            </div>

            {showGoal && (
              <div className="mt-4 flex gap-2 rounded-xl border hairline bg-background/25 p-3">
                <input
                  value={goalTitle}
                  onChange={(event) => setGoalTitle(event.target.value)}
                  placeholder="What are you trying to move toward?"
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                />
                <button
                  onClick={() => createGoal.mutate()}
                  disabled={!goalTitle.trim() || createGoal.isPending}
                  className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {goals.isLoading && <Loading />}
              {!goals.isLoading && activeGoals.length === 0 && (
                <div className="md:col-span-2">
                  <Empty>
                    No active goals yet. HOS can reason about today without inventing a destination.
                  </Empty>
                </div>
              )}
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-xl border hairline bg-background/25 p-4">
                  <div className="flex items-start gap-3">
                    <Flag className="mt-0.5 h-4 w-4 text-primary" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{goal.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {goal.horizon} · priority {goal.priority}
                        {goal.target_date ? " · target " + goal.target_date : ""}
                      </div>
                    </div>
                    <div className="font-mono text-xs">{goal.progress}%</div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: goal.progress + "%" }}
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    {[25, 50, 75, 100].map((value) => (
                      <button
                        key={value}
                        onClick={() => progress.mutate({ id: goal.id, progress: value })}
                        className="rounded-md border hairline px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <QuickLink
              icon={Sparkles}
              title="Standards"
              description="The standards you use to measure who you are becoming."
              to="/standards"
            />
            <QuickLink
              icon={Flag}
              title="Reflection"
              description="Capture context and meaning that metrics cannot."
              to="/reflection"
            />
            <QuickLink
              icon={ShieldCheck}
              title="Settings"
              description="Identity, account, and personal operating preferences."
              to="/settings"
            />
          </section>
        </div>
      )}
    </Shell>
  );
}

function QuickLink({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  to: "/standards" | "/reflection" | "/settings";
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border hairline bg-surface p-5 transition-colors hover:bg-surface-elevated/60"
    >
      <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
      <div className="mt-4 font-display text-lg">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </Link>
  );
}

function Context({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
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
