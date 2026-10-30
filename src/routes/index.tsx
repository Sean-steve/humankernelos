import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { StateRing } from "@/components/hos/StateRing";
import { Advisor } from "@/components/hos/Advisor";
import { FollowUpMeasure } from "@/components/hos/FollowUpMeasure";

import { getMyProfile, getLatestCheckIn } from "@/lib/history.functions";
import { getLatestSignals } from "@/lib/kernel.functions";
import { useSession } from "@/hooks/use-session";
import { identity as defaultIdentity, stateCards } from "@/lib/hos-data";

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
  sleepHours: number;
};

type Profile = {
  name: string;
  becoming: string;
  primary_standard: string;
};

function Home() {
  const [today, setToday] = useState("");
  const [hello, setHello] = useState("Welcome");
  const [profile, setProfile] = useState<Profile>({
    name: defaultIdentity.name,
    becoming: defaultIdentity.becoming,
    primary_standard: defaultIdentity.primaryStandard,
  });
  const [liveState, setLiveState] = useState<HumanState | null>(null);
  const [liveSignals, setLiveSignals] = useState<
    { key: string; value: number | null; text: string | null }[]
  >([]);
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
      setLiveState(null);
      setLiveSignals([]);
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
            sleepHours: Number(c.sleep_hours),
          });
        } else {
          setLiveState(null);
        }

        setLiveSignals(
          signalsRes.signals.map((s) => ({
            key: s.signal_key,
            value: s.value_num,
            text: s.value_text,
          })),
        );
      })
      .catch(() => {
        setLiveState(null);
        setLiveSignals([]);
      })
      .finally(() => setLoading(false));
  }, [session, sessionLoading, getProfile, getCheckIn, getSignals]);

  return (
    <Shell>
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
            {session
              ? `You are becoming ${profile.becoming.toLowerCase()}. HOS will only show operating guidance backed by your live data.`
              : "Sign in to load your real operating state. HOS does not substitute demo data for your state."}
          </p>
        </div>

        <div className="flex items-center gap-6 rounded-xl border hairline bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            {liveState ? (
              <div className="relative">
                <StateRing value={overall(liveState)} size={64} stroke={5} />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="font-display text-lg leading-none">
                    {overall(liveState)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border hairline text-sm text-muted-foreground">
                —
              </div>
            )}
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operating condition
              </div>
              <div className="font-display text-base">
                {liveState ? "Based on latest check-in" : "Awaiting live state"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {!sessionLoading && !session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            Sign in to load your profile and real Human State.
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
            No check-in is available yet. Tell the Kernel how you are before it estimates your operating condition.
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

      <div className="mt-10">
        <Advisor />
      </div>

      <div className="mt-6">
        <FollowUpMeasure />
      </div>

      <section className="mt-10">
        <SectionHeader eyebrow="Human state" title="How the system reads you" />
        {liveState ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {stateCards.map(({ key, label, hint }) => {
              const value = liveState[key];
              const inverse = key === "stress";
              return (
                <div key={key} className="rounded-xl border hairline bg-surface p-4">
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
        ) : (
          <EmptyState>
            Human State will appear after a real check-in or trusted engine signal is available.
          </EmptyState>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border hairline bg-surface p-6">
          <SectionHeader eyebrow="Today's operating plan" title="Your authoritative day" />
          <EmptyState>
            No authoritative Daily Operating Plan has been generated yet. HOS will not display a sample schedule as your plan.
          </EmptyState>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border hairline bg-surface p-6">
            <SectionHeader eyebrow="Personal standards" title="Who I am, measured" />
            <EmptyState>
              Open Standards to review or configure the standards HOS should measure.
              <div className="mt-3">
                <Link to="/standards" className="text-xs text-primary hover:underline">
                  View standards →
                </Link>
              </div>
            </EmptyState>
          </div>

          <div className="rounded-2xl border hairline bg-surface p-6">
            <SectionHeader
              eyebrow="Signals from operating engines"
              title="The ecosystem, summarized"
            />
            {liveSignals.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {liveSignals.map((s) => (
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
              </ul>
            ) : (
              <EmptyState>
                No live engine signals are available. HOS will not invent connected-system telemetry.
              </EmptyState>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
        <SectionHeader eyebrow="Lifetime ledger" title="Compounding proof of who you are" />
        <EmptyState>
          The Today surface is not yet connected to the authoritative achievement ledger.
          <div className="mt-3">
            <Link to="/achievements" className="text-xs text-primary hover:underline">
              View achievements →
            </Link>
          </div>
        </EmptyState>
      </section>

      <footer className="mt-14 border-t hairline pt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Human OS · Kernel · orchestrates the human, never the specialist domain
      </footer>
    </Shell>
  );
}

function overall(s: HumanState) {
  const positive = (s.energy + s.focus + s.recovery + s.mood) / 4;
  const stressPenalty = s.stress * 0.15;
  return Math.round(Math.max(0, Math.min(100, positive - stressPenalty)));
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-1 font-display text-xl">{title}</h2>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed hairline bg-background/30 p-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
