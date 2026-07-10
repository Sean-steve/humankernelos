import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { StateRing } from "@/components/hos/StateRing";
import { submitCheckIn } from "@/lib/check-in.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/check-in")({
  head: () => ({
    meta: [
      { title: "Daily Check-in — Human OS" },
      {
        name: "description",
        content:
          "Tell the Kernel how you are, right now. Sixty seconds. One honest read of the human, and one directive back.",
      },
    ],
  }),
  component: CheckInPage,
});

type Reading = {
  energy: number;
  focus: number;
  recovery: number;
  stress: number;
  mood: number;
  sleepHours: number;
  note: string;
};

const initial: Reading = {
  energy: 70,
  focus: 65,
  recovery: 75,
  stress: 30,
  mood: 70,
  sleepHours: 7.5,
  note: "",
};

const sliders: Array<{
  key: keyof Omit<Reading, "note" | "sleepHours">;
  label: string;
  hint: string;
  inverse?: boolean;
}> = [
  { key: "energy", label: "Energy", hint: "How much charge do you have?" },
  { key: "focus", label: "Focus", hint: "Can you hold a thought?" },
  { key: "recovery", label: "Recovery", hint: "Does the body feel restored?" },
  { key: "stress", label: "Stress", hint: "Lower is calmer.", inverse: true },
  { key: "mood", label: "Mood", hint: "Baseline emotional tone." },
];

function CheckInPage() {
  const [r, setR] = useState<Reading>(initial);
  const [advice, setAdvice] = useState<{
    directive: string;
    why: string;
    avoid: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useServerFn(submitCheckIn);
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const set =
    <K extends keyof Reading>(key: K) =>
    (v: Reading[K]) =>
      setR((prev) => ({ ...prev, [key]: v }));

  async function submit() {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await call({
        data: {
          energy: r.energy,
          focus: r.focus,
          recovery: r.recovery,
          stress: r.stress,
          mood: r.mood,
          sleepHours: r.sleepHours,
          note: r.note || undefined,
        },
      });
      const text = res.directive ?? "";
      const get = (k: string) => {
        const m = text.match(new RegExp(`${k}:\\s*(.+?)(?:\\n|$)`, "i"));
        return m?.[1]?.trim() ?? "";
      };
      setAdvice({
        directive: get("DIRECTIVE"),
        why: get("WHY"),
        avoid: get("AVOID"),
      });
      toast.success("Check-in saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advisor unavailable");
    } finally {
      setLoading(false);
    }
  }


  return (
    <Shell>
      <PageHeader
        eyebrow="Daily check-in"
        title="How are you, right now?"
        intro="Sixty seconds. The Kernel reads what you enter, cross-checks it against connected engines, and returns one calm directive for the next window of your day."
      />

      {!sessionLoading && !session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            Sign in to persist your check-ins and build your Human State timeline.
          </span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Form */}
        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="space-y-6">
            {sliders.map(({ key, label, hint, inverse }) => (
              <SliderField
                key={key}
                label={label}
                hint={hint}
                value={r[key]}
                onChange={set(key)}
                inverse={inverse}
              />
            ))}

            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-sm text-foreground/95">
                  Sleep last night
                </label>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.sleepHours.toFixed(1)}h
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.25}
                value={r.sleepHours}
                onChange={(e) => set("sleepHours")(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="text-sm text-foreground/95">
                Anything the system should know?
              </label>
              <textarea
                value={r.note}
                onChange={(e) => set("note")(e.target.value)}
                rows={3}
                placeholder="Big meeting at 15:00. Slept poorly. Body feels tight."
                className="mt-2 w-full resize-none rounded-lg border hairline bg-background/40 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center justify-between border-t hairline pt-5">
              <button
                onClick={() => navigate({ to: "/" })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                {loading ? "Reading…" : "Read my state"}
              </button>
            </div>
          </div>
        </div>

        {/* Advisor output */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border hairline bg-surface p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Operating condition
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative">
                <StateRing value={condition(r)} size={72} stroke={5} />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="font-display text-xl leading-none">
                    {condition(r)}
                  </div>
                </div>
              </div>
              <div>
                <div className="font-display text-lg">{label(condition(r))}</div>
                <div className="text-[11px] text-muted-foreground">
                  Composite of five signals
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border hairline bg-surface p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Advisor
            </div>

            {!advice && !error && !loading && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Complete the check-in on the left and the advisor will return a
                single directive for your next window.
              </p>
            )}
            {loading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading your state…
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
                {error}
              </div>
            )}
            {advice && (
              <div className="mt-4 space-y-3">
                <Block label="Directive" body={advice.directive} accent />
                <Block label="Why" body={advice.why} />
                <Block label="Avoid today" body={advice.avoid} muted />
              </div>
            )}
          </div>
        </aside>
      </section>
    </Shell>
  );
}

function SliderField({
  label,
  hint,
  value,
  onChange,
  inverse,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  inverse?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm text-foreground/95">{label}</div>
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        </div>
        <div className="flex items-center gap-3">
          <StateRing value={value} inverse={inverse} size={26} stroke={3} />
          <span className="font-mono text-xs text-muted-foreground">
            {value}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--color-primary)]"
      />
    </div>
  );
}

function Block({
  label,
  body,
  accent,
  muted,
}: {
  label: string;
  body: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border hairline p-3 " +
        (accent
          ? "bg-primary/10"
          : muted
            ? "bg-background/40"
            : "bg-surface-elevated")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1.5 text-sm leading-relaxed " +
          (accent ? "font-display text-[15px]" : "text-foreground/90")
        }
      >
        {body || "—"}
      </div>
    </div>
  );
}

function condition(r: Reading) {
  const positive = (r.energy + r.focus + r.recovery + r.mood) / 4;
  return Math.round(Math.max(0, Math.min(100, positive - r.stress * 0.15)));
}

function label(v: number) {
  if (v >= 80) return "Peak · press advantage";
  if (v >= 65) return "Ready · steady";
  if (v >= 50) return "Functional · conserve";
  if (v >= 35) return "Depleted · recover";
  return "Overdrawn · protect";
}
