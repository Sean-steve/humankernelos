import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CircleGauge, Flag, Loader2, LockKeyhole } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { StateRing } from "@/components/hos/StateRing";
import { Advisor } from "@/components/hos/Advisor";
import { FollowUpMeasure } from "@/components/hos/FollowUpMeasure";
import { useSession } from "@/hooks/use-session";
import { getMyProfile } from "@/lib/history.functions";
import { getLatestHSV } from "@/lib/hsie.functions";
import { getDailyPlan } from "@/lib/daily-plan.functions";
import { listGoals } from "@/lib/goals.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — HumanKernelOS" },
      {
        name: "description",
        content:
          "One calm view of how you are, what matters today, what to do now, and what needs attention.",
      },
    ],
  }),
  component: TodayPage,
});

type PlanItem = {
  id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  status: string;
  protected: boolean;
  source_engine: string | null;
};

type Goal = {
  id: string;
  title: string;
  priority: number;
  progress: number;
  status: string;
};

function TodayPage() {
  const { session, loading: sessionLoading } = useSession();
  const profileFn = useServerFn(getMyProfile);
  const hsvFn = useServerFn(getLatestHSV);
  const planFn = useServerFn(getDailyPlan);
  const goalsFn = useServerFn(listGoals);

  const profile = useQuery({
    queryKey: ["today-profile"],
    enabled: !!session,
    queryFn: () => profileFn(),
  });
  const state = useQuery({
    queryKey: ["hsv"],
    enabled: !!session,
    queryFn: () => hsvFn(),
  });
  const plan = useQuery({
    queryKey: ["daily-plan"],
    enabled: !!session,
    queryFn: () => planFn({ data: {} }),
  });
  const goals = useQuery({
    queryKey: ["today-goals"],
    enabled: !!session,
    queryFn: () => goalsFn(),
  });

  const items = (plan.data?.items ?? []) as PlanItem[];
  const activeGoals = ((goals.data?.goals ?? []) as Goal[])
    .filter((goal) => goal.status === "active")
    .sort((a, b) => a.priority - b.priority);

  const nowMs = Date.now();
  const current =
    items.find((item) => item.status === "current") ??
    items.find((item) => {
      if (!item.start_at || !item.end_at || item.status !== "planned") return false;
      return new Date(item.start_at).getTime() <= nowMs && nowMs < new Date(item.end_at).getTime();
    });
  const next = items.find((item) => {
    if (!item.start_at || item.status !== "planned" || item.id === current?.id) return false;
    return new Date(item.start_at).getTime() > nowMs;
  });

  const hsv = state.data?.hsv;
  const name = profile.data?.profile?.name ?? "there";
  const isLoading =
    session &&
    (profile.isLoading || state.isLoading || plan.isLoading || goals.isLoading);

  return (
    <Shell>
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">
          {greeting()}, <span className="text-primary">{name}</span>.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {session
            ? "HOS is here to reduce the amount of life you have to hold in your head."
            : "Sign in to load your real Human State, plan, goals, and recommendations."}
        </p>
      </header>

      {!sessionLoading && !session && (
        <div className="mt-8 rounded-xl border hairline bg-primary/5 p-4 text-sm">
          <Link to="/auth" className="text-foreground hover:underline">
            Sign in to your Personal HOS →
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading your current context…
        </div>
      )}

      {session && !isLoading && (
        <div className="mt-8 space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <div className="relative overflow-hidden rounded-3xl border hairline bg-surface p-6 md:p-7">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary">
                  Now
                </div>
                {current ? (
                  <>
                    <h2 className="mt-2 font-display text-3xl">{current.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{timeRange(current.start_at, current.end_at)}</span>
                      {current.protected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">
                          <LockKeyhole className="h-3 w-3" /> Protected
                        </span>
                      )}
                      {current.source_engine && <span>· from {current.source_engine}</span>}
                    </div>
                    <Link
                      to="/plan"
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Open today’s plan <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <h2 className="mt-2 font-display text-3xl">Nothing is demanding you right now.</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {next
                        ? "Your next planned block is already waiting below."
                        : "Your Daily Operating Plan has no active block. HOS will not invent one."}
                    </p>
                    <Link
                      to="/plan"
                      className="mt-6 inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm"
                    >
                      Review plan <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-3xl border hairline bg-surface p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    My State
                  </div>
                  <div className="mt-1 font-display text-xl">
                    {hsv?.composite !== null && hsv?.composite !== undefined
                      ? "Current operating condition"
                      : "Not enough data yet"}
                  </div>
                </div>
                {hsv?.composite !== null && hsv?.composite !== undefined && (
                  <div className="relative">
                    <StateRing value={hsv.composite} size={64} stroke={5} />
                    <div className="absolute inset-0 grid place-items-center font-display text-lg">
                      {hsv.composite}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Metric
                  label="Coverage"
                  value={hsv ? Math.round(hsv.coverage * 100) + "%" : "—"}
                />
                <Metric
                  label="Confidence"
                  value={
                    hsv?.confidence !== null && hsv?.confidence !== undefined
                      ? Math.round(hsv.confidence * 100) + "%"
                      : "—"
                  }
                />
              </div>
              <Link
                to="/human-state"
                className="mt-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Understand my state <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <SummaryCard
              icon={CalendarDays}
              eyebrow="Next"
              title={next?.title ?? "No next block scheduled"}
              detail={next ? timeRange(next.start_at, next.end_at) : "Your plan is clear after the current moment."}
              to="/plan"
            />
            <SummaryCard
              icon={Flag}
              eyebrow="Direction"
              title={activeGoals[0]?.title ?? "No active goal configured"}
              detail={
                activeGoals[0]
                  ? activeGoals[0].progress + "% progress"
                  : "HOS can still help today, but it will not invent a destination."
              }
              to="/me"
            />
          </section>

          <Advisor />
          <FollowUpMeasure />
        </div>
      )}
    </Shell>
  );
}

function SummaryCard({
  icon: Icon,
  eyebrow,
  title,
  detail,
  to,
}: {
  icon: typeof Flag;
  eyebrow: string;
  title: string;
  detail: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border hairline bg-surface p-5 transition-colors hover:bg-surface-elevated/60"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
      </div>
      <div className="mt-4 font-display text-xl">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeRange(start: string | null, end: string | null) {
  if (!start || !end) return "Unscheduled";
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return (
    new Date(start).toLocaleTimeString([], options) +
    " – " +
    new Date(end).toLocaleTimeString([], options)
  );
}
