import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Gauge } from "lucide-react";
import {
  listPendingMeasurements,
  recordOutcome,
} from "@/lib/learning.functions";
import { useSession } from "@/hooks/use-session";

const AXES = [
  "physical",
  "cognitive",
  "emotional",
  "behavioral",
  "lifestyle",
  "operational",
] as const;

type Pending = {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
};

/** Learning Loop: Measure step. Asks whether an accepted directive was executed. */
export function FollowUpMeasure() {
  const { session } = useSession();
  const qc = useQueryClient();
  const list = useServerFn(listPendingMeasurements);
  const record = useServerFn(recordOutcome);

  const [axis, setAxis] = useState<(typeof AXES)[number]>("physical");
  const [delta, setDelta] = useState(0);
  const [friction, setFriction] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pending-measurements"],
    queryFn: () => list(),
    enabled: !!session,
  });

  const submit = useMutation({
    mutationFn: async (args: { id: string; executed: "yes" | "partial" | "no" }) =>
      record({
        data: {
          recommendation_id: args.id,
          executed: args.executed,
          effect: delta !== 0 ? { [axis]: delta } : {},
          friction: friction.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setDelta(0);
      setFriction("");
      qc.invalidateQueries({ queryKey: ["pending-measurements"] });
      qc.invalidateQueries({ queryKey: ["learning-summary"] });
    },
  });

  if (!session) return null;
  if (isLoading)
    return (
      <div className="flex items-center gap-2 rounded-2xl border hairline bg-surface p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking open directives…
      </div>
    );

  const pending = ((data?.pending ?? []) as Pending[]).slice(0, 1);
  if (pending.length === 0) return null;
  const rec = pending[0]!;

  return (
    <section className="rounded-2xl border hairline bg-surface p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-warning/15 text-warning">
          <Gauge className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Learning loop — measure
          </div>
          <div className="font-display text-lg">Did you do it, and what changed?</div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border hairline bg-surface-elevated p-4">
        <div className="font-display">{rec.title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{rec.body}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Axis affected
          </span>
          <select
            value={axis}
            onChange={(e) => setAxis(e.target.value as (typeof AXES)[number])}
            className="mt-2 w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
          >
            {AXES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Effect ({delta > 0 ? `+${delta}` : delta})
          </span>
          <input
            type="range"
            min={-20}
            max={20}
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            className="mt-3 w-full accent-primary"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Friction (optional)
        </span>
        <input
          value={friction}
          onChange={(e) => setFriction(e.target.value)}
          placeholder="What got in the way?"
          className="mt-2 w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t hairline pt-4">
        {(["yes", "partial", "no"] as const).map((executed) => (
          <button
            key={executed}
            disabled={submit.isPending}
            onClick={() => submit.mutate({ id: rec.id, executed })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
              executed === "yes"
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border hairline text-muted-foreground hover:text-foreground"
            }`}
          >
            {executed === "yes"
              ? "Executed"
              : executed === "partial"
                ? "Partially"
                : "Did not"}
          </button>
        ))}
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {submit.isError && (
          <span className="text-xs text-destructive">
            {submit.error instanceof Error ? submit.error.message : "Could not record"}
          </span>
        )}
      </div>
    </section>
  );
}
