import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw, Check, X } from "lucide-react";
import {
  generateRecommendation,
  decideRecommendation,
} from "@/lib/pdie.functions";

type Sustainability = {
  cost_axes?: string[];
  trades_off?: boolean;
  note?: string;
};

type Recommendation = {
  id: string;
  title: string;
  body: string;
  evidence: string[];
  assumptions: string[];
  alternatives: string[];
  risks: string[];
  confidence: number | null;
  status: string;
  sustainability: Sustainability | null;
};


export function Advisor() {
  const call = useServerFn(generateRecommendation);
  const decide = useServerFn(decideRecommendation);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await call({ data: { type: "daily" } });
      setRec(res.recommendation as unknown as Recommendation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advisor unavailable");
    } finally {
      setLoading(false);
    }
  }

  async function act(status: "accepted" | "dismissed") {
    if (!rec) return;
    try {
      await decide({ data: { id: rec.id, status } });
      setRec({ ...rec, status });
    } catch {
      /* ignore */
    }
  }

  const confidencePct = rec?.confidence ? Math.round(rec.confidence * 100) : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border hairline bg-surface p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Personal Decision Intelligence
            </div>
            <div className="font-display text-lg">
              What matters most, right now
            </div>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border hairline bg-surface-elevated px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : rec ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
          {rec ? "Reconsider" : "Ask the advisor"}
        </button>
      </div>

      <div className="relative mt-6 min-h-[110px]">
        {!rec && !error && !loading && (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            The advisor reads your Human State Vector and active policies, then
            emits a single explainable recommendation — with evidence, assumptions, alternatives, and risks.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the vector…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        {rec && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-xl">{rec.title}</div>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/90">
                  {rec.body}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Confidence
                </div>
                <div className="mt-1 font-mono text-lg">
                  {confidencePct !== null ? `${confidencePct}%` : "—"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Chips label="Evidence" items={rec.evidence} tone="primary" />
              <Chips label="Assumptions" items={rec.assumptions} />
              <Chips label="Alternatives" items={rec.alternatives} />
              <Chips label="Risks" items={rec.risks} tone="warn" />
            </div>

            <div className="flex items-center gap-2 border-t hairline pt-4">
              {rec.status === "pending" ? (
                <>
                  <button
                    onClick={() => act("accepted")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => act("dismissed")}
                    className="inline-flex items-center gap-1.5 rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </>
              ) : (
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {rec.status}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Chips({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "primary" | "warn";
}) {
  const color =
    tone === "primary"
      ? "border-primary/40 text-primary/95"
      : tone === "warn"
        ? "border-warning/40 text-warning"
        : "text-foreground/85";
  return (
    <div className="rounded-xl border hairline bg-surface-elevated p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 && (
          <li className="text-[11px] text-muted-foreground">—</li>
        )}
        {items.map((s, i) => (
          <li
            key={i}
            className={`rounded-md border hairline px-2 py-1 text-[11px] leading-snug ${color}`}
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
