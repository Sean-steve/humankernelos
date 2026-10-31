import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import {
  connectExecutionOs,
  getExecutionOsIntegrationStatus,
  getExecutionOsOverview,
  syncExecutionOsContext,
} from "@/lib/external-engines/execution-os.functions";

export const Route = createFileRoute("/execution-os")({
  head: () => ({
    meta: [
      { title: "Execution OS — HumanKernelOS" },
      {
        name: "description",
        content:
          "The HOS-facing workspace for the external Execution OS: connection, consent, schedule authority, and execution evidence.",
      },
    ],
  }),
  component: ExecutionOsPage,
});


function ExecutionOsPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const statusFn = useServerFn(getExecutionOsIntegrationStatus);
  const connectFn = useServerFn(connectExecutionOs);
  const syncFn = useServerFn(syncExecutionOsContext);
  const overviewFn = useServerFn(getExecutionOsOverview);

  const [baseUrl, setBaseUrl] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );

  const status = useQuery({
    queryKey: ["execution-os-status"],
    enabled: !!session,
    queryFn: () => statusFn(),
    refetchInterval: 30_000,
  });

  const connect = useMutation({
    mutationFn: () =>
      connectFn({
        data: {
          ...(baseUrl.trim() ? { base_url: baseUrl.trim() } : {}),
          ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["execution-os-status"] });
      qc.invalidateQueries({ queryKey: ["engines-human"] });
      qc.invalidateQueries({ queryKey: ["engines"] });
    },
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["execution-os-overview"] });
      qc.invalidateQueries({ queryKey: ["execution-os-status"] });
    },
  });

  const integrationReady = status.data?.integration_ready === true;
  const overview = useQuery({
    queryKey: ["execution-os-overview"],
    enabled: !!session && integrationReady,
    queryFn: () => overviewFn(),
  });

  const engine = status.data?.engine;
  const remote = status.data?.remote;
  const missing = status.data?.missing_scopes ?? [];
  const schedule = asObject(overview.data?.schedule);
  const discipline = asObject(overview.data?.discipline);
  const authority = asObject(schedule?.authority);
  const plan = asObject(schedule?.plan);
  const allocations = Array.isArray(schedule?.allocations)
    ? schedule.allocations
    : [];
  const proposals = Array.isArray(schedule?.proposals)
    ? schedule.proposals
    : [];

  return (
    <Shell>
      <PageHeader
        eyebrow="External engine"
        title="Execution OS"
        intro="Execution OS owns execution. HumanKernelOS remains the authority for identity, Human State, Personal Policies, and the final Daily Operating Plan."
      />

      {!session ? (
        <Callout>
          Sign in before connecting an external Operating Engine to your Personal HOS.
        </Callout>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <StatusCard
              label="HOS lifecycle"
              value={engine?.lifecycle_state ?? "Not installed"}
              good={
                engine?.lifecycle_state === "ENABLED" ||
                engine?.lifecycle_state === "RUNNING"
              }
            />
            <StatusCard
              label="Remote readiness"
              value={
                remote?.ready
                  ? "Ready"
                  : status.data?.remote_error
                    ? "Unreachable"
                    : remote
                      ? "Not ready"
                      : "Unknown"
              }
              good={remote?.ready === true}
            />
            <StatusCard
              label="Consent"
              value={missing.length === 0 ? "Complete" : `${missing.length} scopes pending`}
              good={missing.length === 0}
            />
            <StatusCard
              label="Integration"
              value={integrationReady ? "Operational" : "Not ready"}
              good={integrationReady}
            />
          </section>

          {!status.data?.installed && (
            <section className="rounded-2xl border hairline bg-surface p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ExternalLink className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl">Discover Execution OS</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    HOS first reads the public engine manifest and readiness endpoint. Discovery registers the contract but does not grant consent or activate execution.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_.5fr_auto]">
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="Execution OS base URL (or use server configuration)"
                  className="rounded-xl border hairline bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Timezone"
                  className="rounded-xl border hairline bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {connect.isPending ? "Discovering…" : "Connect"}
                </button>
              </div>
              {connect.error && (
                <div className="mt-3 text-sm text-destructive">
                  {connect.error.message}
                </div>
              )}
            </section>
          )}

          {status.data?.installed && !integrationReady && (
            <section className="rounded-2xl border hairline bg-surface p-6">
              <h2 className="font-display text-xl">Finish the trust handshake</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Step
                  done={status.data.base_url_configured}
                  title="Engine discovered"
                  detail="Manifest and connection location are registered in HOS."
                />
                <Step
                  done={missing.length === 0}
                  title="Consent granted"
                  detail="Review every requested permission and consent scope explicitly."
                />
                <Step
                  done={
                    engine?.lifecycle_state === "ENABLED" ||
                    engine?.lifecycle_state === "RUNNING"
                  }
                  title="Engine enabled"
                  detail="Platform Manager activates the remote HOS lifecycle only after validation."
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {missing.length > 0 && (
                  <Link
                    to="/governance"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Review consent
                  </Link>
                )}
                <Link
                  to="/engine-registry"
                  className="rounded-xl border hairline px-4 py-2 text-sm"
                >
                  Open Engine Registry
                </Link>
                <button
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                  className="rounded-xl border hairline px-4 py-2 text-sm"
                >
                  Recheck manifest
                </button>
              </div>

              {status.data.remote_error && (
                <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {status.data.remote_error}
                </div>
              )}
            </section>
          )}

          {integrationReady && (
            <>
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border hairline bg-primary/5 p-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-primary">
                    Connected external engine
                  </div>
                  <div className="mt-1 font-display text-xl">
                    HOS is the authority. Execution OS is the executor.
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Context is shared through signed contracts; specialist execution state remains inside Execution OS.
                  </p>
                </div>
                <button
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border hairline bg-surface px-4 py-2 text-sm disabled:opacity-60"
                >
                  {sync.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync current HOS context
                </button>
              </section>

              <section className="grid gap-4 md:grid-cols-[.7fr_1.3fr]">
                <div className="rounded-2xl border hairline bg-surface p-5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Execution discipline
                  </div>
                  {overview.isLoading ? (
                    <Loading />
                  ) : (
                    <>
                      <div className="mt-2 font-display text-4xl">
                        {typeof discipline?.score === "number"
                          ? discipline.score
                          : "—"}
                        {typeof discipline?.score === "number" && (
                          <span className="ml-1 text-sm text-muted-foreground">/100</span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {String(discipline?.status ?? "No measured evidence")}
                      </div>
                      <Evidence evidence={asObject(discipline?.evidence)} />
                    </>
                  )}
                </div>

                <div className="rounded-2xl border hairline bg-surface p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Schedule authority
                      </div>
                      <div className="mt-1 font-display text-xl">
                        {String(authority?.mode ?? "HOS")}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {plan?.localDate ? String(plan.localDate) : "No delegated plan yet"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Delegated allocations" value={String(allocations.length)} />
                    <MiniStat label="Pending engine proposals" value={String(proposals.filter((item) => asObject(item)?.status === "PROPOSED").length)} />
                    <MiniStat
                      label="Plan version"
                      value={plan?.planVersion ? String(plan.planVersion).slice(0, 18) : "—"}
                    />
                  </div>

                  <Link
                    to="/plan"
                    className="mt-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Review the authoritative HOS Plan →
                  </Link>
                </div>
              </section>
            </>
          )}

          <section className="rounded-2xl border hairline bg-surface p-5">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" strokeWidth={1.5} />
              <div>
                <div className="font-display text-lg">Boundary contract</div>
                <div className="text-xs text-muted-foreground">
                  Contract v{String(remote?.manifest?.contractVersion ?? "1.1.0")}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <Boundary
                title="HumanKernelOS owns"
                items={[
                  "Identity and consent",
                  "Human State",
                  "Personal Policies",
                  "Final Daily Operating Plan",
                  "Decision Intelligence",
                ]}
              />
              <Boundary
                title="Execution OS owns"
                items={[
                  "Execution sessions",
                  "Fallbacks and drift recovery",
                  "Execution evidence",
                  "Performance sessions",
                  "Execution-domain adaptation",
                ]}
              />
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function StatusCard({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border hairline bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        {good ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <CircleDashed className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function Step({
  done,
  title,
  detail,
}: {
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border hairline bg-background/25 p-4">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <TriangleAlert className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="font-medium">{title}</div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function Boundary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border hairline bg-background/25 p-4">
      <div className="font-medium">{title}</div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function Evidence({ evidence }: { evidence: Record<string, unknown> | null }) {
  if (!evidence) return null;
  const rows = Object.entries(evidence).slice(0, 5);
  if (!rows.length) return null;
  return (
    <dl className="mt-4 space-y-2 text-xs">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{key.replaceAll("_", " ")}</dt>
          <dd className="font-mono">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-xl border hairline bg-primary/5 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
