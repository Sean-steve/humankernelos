import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import { listRecentSessions, logSession } from "@/lib/body.functions";

export const Route = createFileRoute("/body")({
  head: () => ({
    meta: [
      { title: "Body Engine — Human OS" },
      {
        name: "description",
        content: "Log training sessions. The Body Engine feeds load signals to the Kernel.",
      },
    ],
  }),
  component: BodyPage,
});

type Session = {
  id: string;
  kind: string;
  duration_min: number;
  intensity: number;
  note: string | null;
  occurred_at: string;
};

function BodyPage() {
  const { session, loading: sessionLoading } = useSession();
  const list = useServerFn(listRecentSessions);
  const log = useServerFn(logSession);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [kind, setKind] = useState("");
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState(6);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionLoading || !session) return;
    list().then((r) => setSessions(r.sessions as Session[])).catch(() => {});
  }, [session, sessionLoading, list]);

  const weekLoad = sessions
    .filter((s) => Date.now() - new Date(s.occurred_at).getTime() < 7 * 24 * 3600 * 1000)
    .reduce((a, s) => a + s.duration_min * s.intensity, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind.trim() || busy) return;
    setBusy(true);
    try {
      await log({
        data: {
          kind: kind.trim(),
          duration_min: duration,
          intensity,
          note: note || undefined,
        },
      });
      const r = await list();
      setSessions(r.sessions as Session[]);
      setKind("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Body engine"
        title="Move. Recover. Repeat."
        intro="Log training sessions. The Kernel receives a 7-day load signal — not your workouts."
      />

      {!sessionLoading && !session && (
        <div className="mt-8 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">Sign in to log sessions.</span>{" "}
          <Link to="/auth" className="text-primary underline-offset-2 hover:underline">
            Sign in →
          </Link>
        </div>
      )}

      {session && (
        <>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border hairline bg-surface p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                7-day load
              </div>
              <div className="mt-2 font-display text-3xl leading-none">
                {weekLoad}
                <span className="ml-1 text-xs text-muted-foreground">min · int</span>
              </div>
            </div>
            <div className="rounded-xl border hairline bg-surface p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Sessions this fortnight
              </div>
              <div className="mt-2 font-display text-3xl leading-none">
                {sessions.length}
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="mt-8 grid gap-4 rounded-2xl border hairline bg-surface p-6 md:grid-cols-2"
          >
            <Field label="Kind">
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                placeholder="Zone 2 run · Strength · Yoga"
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Duration (min)">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label={`Intensity: ${intensity}/10`}>
              <input
                type="range"
                min={1}
                max={10}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </Field>
            <Field label="Note">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Logging…" : "Log session"}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <h2 className="font-display text-xl">Recent sessions</h2>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No sessions logged yet.</p>
            ) : (
              <ul className="mt-4 rounded-2xl border hairline bg-surface">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-t hairline px-5 py-3 first:border-t-0"
                  >
                    <div>
                      <div className="text-sm text-foreground/95">{s.kind}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.occurred_at).toLocaleDateString()}{" "}
                        {s.note ? "· " + s.note : ""}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.duration_min}m · int {s.intensity}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
