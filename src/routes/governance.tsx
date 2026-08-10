import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { StateRing } from "@/components/hos/StateRing";
import {
  exportMyData,
  getGovernance,
  setEnginePermission,
} from "@/lib/governance.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Governance — Human OS" },
      {
        name: "description",
        content:
          "Grant or revoke what each engine may read, review the Kernel audit trail, and export every byte the system holds about you.",
      },
      { property: "og:title", content: "Governance — Human OS" },
      {
        property: "og:description",
        content:
          "Permission Manager, audit trail, and full data export for your personal Kernel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GovernancePage,
});

function GovernancePage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const load = useServerFn(getGovernance);
  const setPerm = useServerFn(setEnginePermission);
  const doExport = useServerFn(exportMyData);

  const { data, isLoading } = useQuery({
    queryKey: ["governance"],
    queryFn: () => load(),
    enabled: !!session,
  });

  const toggle = useMutation({
    mutationFn: (v: { engine_id: string; scope: string; granted: boolean }) =>
      setPerm({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const exporter = useMutation({
    mutationFn: () => doExport(),
    onSuccess: (res) => {
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `human-os-export-${res.exported_at.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const permissions = data?.permissions ?? [];
  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    (acc[p.engine_name] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Shell>
      <PageHeader
        eyebrow="Constitution · Art. VI & XIV"
        title="Governance"
        intro="Nothing is read without your consent. Every governance decision is written to an append-only audit trail."
      />

      {!session && (
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in to manage engine permissions and export your data.
        </p>
      )}

      {session && isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading governance state…
        </div>
      )}

      {session && data && (
        <>
          <section className="mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border hairline bg-surface p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <StateRing value={data.coverage} size={64} stroke={5} />
                <div className="absolute inset-0 grid place-items-center font-display text-lg leading-none">
                  {data.coverage}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Consent coverage
                </div>
                <div className="font-display text-base">
                  {permissions.filter((p) => p.decided).length} of {permissions.length} data
                  scopes decided
                </div>
              </div>
            </div>
            <button
              onClick={() => exporter.mutate()}
              disabled={exporter.isPending}
              className="inline-flex items-center gap-2 rounded-md border hairline px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {exporter.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export all my data
            </button>
          </section>

          <section className="mt-8 space-y-4">
            {Object.entries(grouped).map(([engineName, scopes]) => (
              <div key={engineName} className="rounded-2xl border hairline bg-surface p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <h2 className="font-display text-lg">{engineName}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{scopes[0]?.purpose}</p>

                <ul className="mt-4 space-y-0">
                  {scopes.map((p) => (
                    <li
                      key={p.scope}
                      className="flex flex-wrap items-center justify-between gap-3 border-t hairline py-3 first:border-t-0 first:pt-0"
                    >
                      <div>
                        <div className="font-mono text-xs text-foreground/90">{p.scope}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {p.decided
                            ? p.granted
                              ? "Granted"
                              : "Revoked"
                            : "Awaiting your decision"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            toggle.mutate({
                              engine_id: p.engine_id,
                              scope: p.scope,
                              granted: true,
                            })
                          }
                          className={
                            "rounded-md px-3 py-1.5 text-xs " +
                            (p.granted
                              ? "bg-primary text-primary-foreground"
                              : "border hairline text-muted-foreground hover:text-foreground")
                          }
                        >
                          Grant
                        </button>
                        <button
                          onClick={() =>
                            toggle.mutate({
                              engine_id: p.engine_id,
                              scope: p.scope,
                              granted: false,
                            })
                          }
                          className={
                            "rounded-md px-3 py-1.5 text-xs " +
                            (p.decided && !p.granted
                              ? "bg-foreground/10 text-foreground"
                              : "border hairline text-muted-foreground hover:text-foreground")
                          }
                        >
                          Revoke
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {scopes[0]?.prohibited.length ? (
                  <div className="mt-4 text-[11px] text-muted-foreground">
                    Prohibited by contract: {scopes[0].prohibited.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border hairline bg-surface p-6">
            <h2 className="font-display text-lg">Audit trail</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Append-only. Entries can never be edited or deleted.
            </p>
            {data.audit.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No governance actions yet.</p>
            ) : (
              <ul className="mt-4 space-y-0">
                {data.audit.map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t hairline py-3 first:border-t-0 first:pt-0"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                    <span className="text-sm">{a.action}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {a.resource}
                    </span>
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
