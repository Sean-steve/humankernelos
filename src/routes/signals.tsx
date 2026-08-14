import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import {
  getLatestSignals,
  listRecentEvents,
  listEventDeliveries,
  retryDeadLetters,
} from "@/lib/kernel.functions";

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "Signals & Event Mesh — Human OS" },
      {
        name: "description",
        content:
          "The live signal stream and Event Mesh delivery ledger: which engines published, which subscribers ran, and what dead-lettered.",
      },
      { property: "og:title", content: "Signals & Event Mesh — Human OS" },
      {
        property: "og:description",
        content:
          "Live engine signals plus every event delivery attempt, retry, and dead letter inside the Kernel.",
      },
    ],
  }),
  component: SignalsPage,
});

const statusTone: Record<string, string> = {
  delivered: "var(--color-success)",
  failed: "var(--color-warning)",
  dead_letter: "var(--color-destructive)",
  skipped_disabled: "var(--color-muted-foreground)",
  denied_consent: "var(--color-warning)",
  pending: "var(--color-muted-foreground)",
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SignalsPage() {
  const { session, loading } = useSession();
  const qc = useQueryClient();
  const signalsFn = useServerFn(getLatestSignals);
  const eventsFn = useServerFn(listRecentEvents);
  const deliveriesFn = useServerFn(listEventDeliveries);
  const retryFn = useServerFn(retryDeadLetters);

  const signals = useQuery({
    queryKey: ["signals", "latest"],
    enabled: !!session,
    queryFn: () => signalsFn(),
  });
  const events = useQuery({
    queryKey: ["signals", "events"],
    enabled: !!session,
    queryFn: () => eventsFn(),
  });
  const mesh = useQuery({
    queryKey: ["signals", "deliveries"],
    enabled: !!session,
    queryFn: () => deliveriesFn(),
  });

  const retry = useMutation({
    mutationFn: () => retryFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });

  const deadLetters = (mesh.data?.deliveries ?? []).filter((d) => d.dead_letter).length;

  return (
    <Shell>
      <PageHeader
        eyebrow="Signals & Event Mesh"
        title="The ecosystem, speaking quietly."
        intro="Every engine publishes signals and events. The mesh delivers each event to its subscribers, retries failures, and dead-letters what never lands."
      />

      {!loading && !session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            Sign in to see your live signal stream and mesh deliveries.
          </span>
          <Link to="/auth" className="rounded-md border hairline px-3 py-1.5">
            Sign in
          </Link>
        </div>
      )}

      {session && (
        <>
          <section className="mt-10 rounded-2xl border hairline bg-surface p-6">
            <div className="font-display">Latest signal per key</div>
            {signals.isLoading && (
              <div className="mt-4 text-sm text-muted-foreground">Reading signals…</div>
            )}
            {!signals.isLoading && (signals.data?.signals ?? []).length === 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                No signals yet. Log a check-in, meal, workout, or routine and they appear here.
              </div>
            )}
            <ol className="mt-4 space-y-0">
              {(signals.data?.signals ?? []).map((s) => (
                <li
                  key={s.id}
                  className="grid grid-cols-[70px_110px_1fr_auto] items-center gap-4 border-t hairline py-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {time(s.occurred_at)}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.engine}
                  </span>
                  <span className="text-sm text-foreground/95">
                    {s.signal_key}
                    {s.value_text ? ` — ${s.value_text}` : ""}
                  </span>
                  <span className="font-mono text-sm">
                    {s.value_num === null ? "—" : Math.round(Number(s.value_num) * 100) / 100}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-6 rounded-2xl border hairline bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display">Mesh deliveries</div>
                <div className="text-sm text-muted-foreground">
                  {(mesh.data?.subscriptions ?? []).length} active subscriptions ·{" "}
                  {deadLetters} dead-lettered
                </div>
              </div>
              <button
                onClick={() => retry.mutate()}
                disabled={retry.isPending || deadLetters === 0}
                className="inline-flex items-center gap-2 rounded-md border hairline px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {retry.isPending ? "Replaying…" : "Replay dead letters"}
              </button>
            </div>

            {(mesh.data?.deliveries ?? []).length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                No deliveries yet. The mesh records one row per event per subscriber.
              </div>
            ) : (
              <ol className="mt-4 space-y-0">
                {(mesh.data?.deliveries ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="grid grid-cols-[70px_1fr_auto_auto] items-center gap-4 border-t hairline py-3 first:border-t-0 first:pt-0"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {time(d.created_at)}
                    </span>
                    <span className="text-sm text-foreground/95">
                      {d.engine_id}.{d.handler}
                      {d.last_error ? (
                        <span className="block text-xs text-muted-foreground">{d.last_error}</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.attempts}×
                    </span>
                    <span
                      className="text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: statusTone[d.status] ?? "var(--color-muted-foreground)" }}
                    >
                      {d.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-6 rounded-2xl border hairline bg-surface p-6">
            <div className="font-display">Recent events</div>
            <ol className="mt-4 space-y-0">
              {(events.data?.events ?? []).map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[70px_110px_1fr] items-center gap-4 border-t hairline py-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {time(e.occurred_at)}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {e.source_engine}
                  </span>
                  <span className="text-sm text-foreground/95">{e.type}</span>
                </li>
              ))}
            </ol>
            {(events.data?.events ?? []).length === 0 && (
              <div className="mt-4 text-sm text-muted-foreground">No events published yet.</div>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
