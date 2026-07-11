import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { getAdvisorDirective } from "@/lib/advisor.functions";
import { humanState as seedHumanState } from "@/lib/hos-data";
import type { HumanState } from "@/routes/index";

function parseDirective(raw: string) {
  const get = (key: string) => {
    const m = raw.match(new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`, "i"));
    return m?.[1]?.trim() ?? "";
  };
  return {
    directive: get("DIRECTIVE"),
    why: get("WHY"),
    avoid: get("AVOID"),
  };
}

export function Advisor({ state }: { state?: HumanState }) {
  const call = useServerFn(getAdvisorDirective);
  const [localState, setLocalState] = useState<{
    loading: boolean;
    error?: string;
    data?: ReturnType<typeof parseDirective>;
  }>({ loading: false });

  const humanState = state ?? seedHumanState;

  async function run() {
    setLocalState({ loading: true });
    try {
      const res = await call({ data: { humanState } });
      const parsed = parseDirective(res.text);
      setLocalState({ loading: false, data: parsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Advisor unavailable";
      setLocalState({ loading: false, error: msg });
    }
  }

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
              Operating Advisor
            </div>
            <div className="font-display text-lg">
              What matters most, right now
            </div>
          </div>
        </div>

        <button
          onClick={run}
          disabled={localState.loading}
          className="inline-flex items-center gap-2 rounded-md border hairline bg-surface-elevated px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {localState.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : localState.data ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
          {localState.data ? "Reconsider" : "Ask the advisor"}
        </button>
      </div>

      <div className="relative mt-6 min-h-[110px]">
        {!localState.data && !localState.error && !localState.loading && (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            The advisor reads your current human state — energy, recovery, stress,
            sleep — and returns one calm directive for the next window of the day.
          </p>
        )}

        {localState.loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the state…
          </div>
        )}

        {localState.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {localState.error}
          </div>
        )}

        {localState.data && (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
            <Card label="Directive" body={localState.data.directive} accent />
            <Card label="Why" body={localState.data.why} />
            <Card label="Avoid today" body={localState.data.avoid} muted />
          </div>
        )}
      </div>
    </section>
  );
}

function Card({
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
        "rounded-xl border hairline p-4 " +
        (accent ? "bg-primary/10" : muted ? "bg-background/40" : "bg-surface-elevated")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-2 text-sm leading-relaxed " +
          (accent ? "font-display text-[17px] text-foreground" : "text-foreground/90")
        }
      >
        {body || "—"}
      </div>
    </div>
  );
}
