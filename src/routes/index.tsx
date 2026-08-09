import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Circle, Loader2 } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { StateRing } from "@/components/hos/StateRing";
import { Advisor } from "@/components/hos/Advisor";
import { getMyProfile, getLatestCheckIn } from "@/lib/history.functions";
import { getLatestSignals } from "@/lib/kernel.functions";
import { useSession } from "@/hooks/use-session";
import {
  achievements,
  humanState as seedHumanState,
  identity as seedIdentity,
  signals,
  standards,
  stateCards,
  todaysPlan,
} from "@/lib/hos-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Human OS — The Personal Kernel" },
      {
        name: "description",
        content:
          "The Kernel of your personal operating system. One calm view of your human state, standards, and next best action.",
      },
      { property: "og:title", content: "Human OS — The Personal Kernel" },
      {
        property: "og:description",
        content:
          "The Kernel of your personal operating system. One calm view of your human state, standards, and next best action.",
      },
    ],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export type HumanState = {
  energy: number;
  focus: number;
  recovery: number;
  stress: number;
  mood: number;
  momentum: number;
  confidence: number;
  sleepHours: number;
};

type Profile = {
  name: string;
  becoming: string;
  primary_standard: string;
};

function Home() {
  const [today, setToday] = useState<string>("");
  const [hello, setHello] = useState<string>("Welcome");
  const [profile, setProfile] = useState<Profile>({
    name: seedIdentity.name,
    becoming: seedIdentity.becoming,
    primary_standard: seedIdentity.primaryStandard,
  });
  const [liveState, setLiveState] = useState<HumanState | null>(null);
  const [liveSignals, setLiveSignals] = useState<{ key: string; value: number | null; text: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const { session, loading: sessionLoading } = useSession();
  const getProfile = useServerFn(getMyProfile);
  const getCheckIn = useServerFn(getLatestCheckIn);
  const getSignals = useServerFn(getLatestSignals);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
    setHello(greeting());
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    Promise.all([getProfile(), getCheckIn(), getSignals()])
      .then(([profileRes, checkInRes, signalsRes]) => {
        if (profileRes.profile) {
          setProfile({
            name: profileRes.profile.name,
            becoming: profileRes.profile.becoming,
            primary_standard: profileRes.profile.primary_standard,
          });
        }
        if (checkInRes.checkIn) {
          const c = checkInRes.checkIn;
          setLiveState({
            energy: c.energy,
            focus: c.focus,
            recovery: c.recovery,
            stress: c.stress,
            mood: c.mood,
            momentum: seedHumanState.momentum,
            confidence: seedHumanState.confidence,
            sleepHours: Number(c.sleep_hours),
          });
        }
        setLiveSignals(
          signalsRes.signals.map((s) => ({
            key: s.signal_key,
            value: s.value_num,
            text: s.value_text,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, sessionLoading, getProfile, getCheckIn, getSignals]);

  const humanState = liveState ?? seedHumanState;

  return (
    <Shell>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {today}
          </div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">
            {hello},{" "}
            <span className="text-primary">{profile.name}</span>.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            You are becoming {profile.becoming.toLowerCase()}. Today's operating
            plan is calibrated to your current state.
          </p>
        </div>

        <div className="flex items-center gap-6 rounded-xl border hairline bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <StateRing value={overall(humanState)} size={64} stroke={5} />
              <div className="absolute inset-0 grid place-items-center">
                <div className="font-display text-lg leading-none">
                  {overall(humanState)}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operating condition
              </div>
              <div className="font-display text-base">Ready · steady</div>
            </div>
          </div>
        </div>
      </header>

      {!sessionLoading && !session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            Sign in to load your profile and see live check-ins on the Home page.
          </span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      )}

      {session && !sessionLoading && !loading && !liveState && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            No check-in yet today. Tell the Kernel how you are.
          </span>
          <Link
            to="/check-in"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Check in
          </Link>
        </div>
      )}

      {loading && session && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your operating state…
        </div>
      )}

      {/* Advisor */}
      <div className="mt-10">
        <Advisor />
      </div>

      {/* Learning loop — measure open directives */}
      <div className="mt-6">
        <FollowUpMeasure />
      </div>


      {/* Human State grid */}
      <section className="mt-10">
        <SectionHeader
          eyebrow="Human state"
          title="How the system reads you"
        />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {stateCards.map(({ key, label, hint }) => {
            const value = humanState[key];
            const inverse = key === "stress";
            return (
              <div
                key={key}
                className="rounded-xl border hairline bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </div>
                  <StateRing value={value} inverse={inverse} size={28} stroke={3} />
                </div>
                <div className="mt-3 font-display text-2xl leading-none">
                  {value}
                  <span className="ml-1 text-xs text-muted-foreground">/100</span>
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {hint}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two-column: Plan + Signals/Standards */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Daily plan */}
        <div className="rounded-2xl border hairline bg-surface p-6">
          <SectionHeader
            eyebrow="Today's operating plan"
            title="Calibrated to your capacity"
            trailing={
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Adjust <ArrowUpRight className="h-3 w-3" />
              </button>
            }
          />
          <ol className="mt-5 space-y-0">
            {todaysPlan.map((row) => (
              <li
                key={row.time}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-4 border-t hairline py-3.5 first:border-t-0 first:pt-0"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {row.time}
                </span>
                <span className="text-sm text-foreground/95">{row.block}</span>
                <span className="rounded-full border hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {row.tag}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Standards */}
          <div className="rounded-2xl border hairline bg-surface p-6">
            <SectionHeader
              eyebrow="Personal standards"
              title="Who I am, measured"
            />
            <ul className="mt-4 space-y-3">
              {standards.map((s) => (
                <li key={s.text} className="flex items-center gap-3">
                  <Circle
                    className="h-2 w-2 shrink-0"
                    fill="currentColor"
                    strokeWidth={0}
                    style={{
                      color:
                        s.adherence >= 85
                          ? "var(--color-success)"
                          : s.adherence >= 70
                            ? "var(--color-primary)"
                            : "var(--color-warning)",
                    }}
                  />
                  <div className="flex-1 text-sm">{s.text}</div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-foreground/90">
                      {s.adherence}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.streak}d streak
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Signals */}
          <div className="rounded-2xl border hairline bg-surface p-6">
            <SectionHeader
              eyebrow="Signals from connected systems"
              title="The ecosystem, summarized"
            />
            <ul className="mt-4 space-y-2.5">
              {liveSignals.length > 0 &&
                liveSignals.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center justify-between rounded-md bg-background/40 px-3 py-2"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {s.key.split(".")[0]}
                      </div>
                      <div className="text-sm">{s.key.split(".").slice(1).join(".")}</div>
                    </div>
                    <div className="font-mono text-xs text-foreground/90">
                      {s.value ?? s.text ?? "—"}
                    </div>
                  </li>
                ))}
              {liveSignals.length === 0 && signals.map((sig) => (
                <li
                  key={sig.label}
                  className="flex items-center justify-between rounded-md bg-background/40 px-3 py-2"
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {sig.source}
                    </div>
                    <div className="text-sm">{sig.label}</div>
                  </div>
                  <div
                    className={
                      "font-mono text-xs " +
                      (sig.tone === "good"
                        ? "text-success"
                        : sig.tone === "warn"
                          ? "text-warning"
                          : "text-muted-foreground")
                    }
                    style={{
                      color:
                        sig.tone === "good"
                          ? "var(--color-success)"
                          : sig.tone === "warn"
                            ? "var(--color-warning)"
                            : undefined,
                    }}
                  >
                    {sig.value}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Achievements ledger */}
      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <SectionHeader
          eyebrow="Lifetime ledger"
          title="Compounding proof of who you are"
        />
        <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-5">
          <Metric label="Books read" value={achievements.booksRead} />
          <Metric label="Workouts" value={achievements.workouts} />
          <Metric label="Meditations" value={achievements.meditationSessions} />
          <Metric label="Consecutive days" value={achievements.consecutiveDays} />
          <Metric
            label="Standards held"
            value={achievements.standardsMaintained}
          />
        </div>
      </section>

      <footer className="mt-14 border-t hairline pt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Human OS · Kernel · orchestrates the ecosystem, never the domain
      </footer>
    </Shell>
  );
}

function overall(s: HumanState) {
  const positive = (s.energy + s.focus + s.recovery + s.mood + s.momentum + s.confidence) / 6;
  const stressPenalty = s.stress * 0.15;
  return Math.round(Math.max(0, Math.min(100, positive - stressPenalty)));
}

function SectionHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-xl">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none">
        {value.toLocaleString()}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
