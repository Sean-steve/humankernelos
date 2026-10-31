import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  GitBranch,
  Layers,
  ScrollText,
  ShieldCheck,
  Workflow,
  Wrench,
  CheckCircle2,
  CircleDashed,
  TriangleAlert,
} from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import { getProductionCertification } from "@/lib/production-certification.functions";

export const Route = createFileRoute("/platform-studio")({
  head: () => ({
    meta: [
      { title: "Platform Studio — HumanKernelOS" },
      {
        name: "description",
        content:
          "Technical and administrative surfaces for engine lifecycle, events, permissions, orchestration, signals, and platform history.",
      },
    ],
  }),
  component: PlatformStudioPage,
});

const tools = [
  {
    icon: Layers,
    title: "Engine Registry",
    description: "Install, validate, enable, disable, and inspect engine runtime state.",
    to: "/engine-registry",
  },
  {
    icon: Workflow,
    title: "Orchestrator",
    description: "Inspect signal fusion, ranked priorities, and conflict resolution.",
    to: "/orchestrator",
  },
  {
    icon: ShieldCheck,
    title: "Governance",
    description: "Review permissions, consent, and platform authority boundaries.",
    to: "/governance",
  },
  {
    icon: Activity,
    title: "Signals",
    description: "Inspect current signals and engine telemetry feeding the Kernel.",
    to: "/signals",
  },
  {
    icon: GitBranch,
    title: "Timeline",
    description: "Inspect the unified event and system-history feed.",
    to: "/timeline",
  },
  {
    icon: ScrollText,
    title: "Policies",
    description: "Inspect personal policy rules and their structured conditions/actions.",
    to: "/policies",
  },
] as const;

function PlatformStudioPage() {
  const { session } = useSession();
  const certificationFn = useServerFn(getProductionCertification);
  const certification = useQuery({
    queryKey: ["production-certification"],
    enabled: !!session,
    queryFn: () => certificationFn(),
    refetchInterval: 60_000,
  });

  const status = certification.data?.status ?? "observing";
  const statusLabel =
    status === "certified"
      ? "Certified"
      : status === "blocked"
        ? "Blocked"
        : "Observing";
  const criticalGates =
    certification.data?.gates.filter((gate) => gate.critical) ?? [];

  return (
    <Shell>
      <PageHeader
        eyebrow="Platform Studio"
        title="Run the system, not your day."
        intro="These are technical and administrative surfaces. They stay separate from Personal HOS so everyday use remains focused on the human."
      />

      <section className="mt-8 rounded-2xl border hairline bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Production certification
            </div>
            <div className="mt-1 flex items-center gap-2 font-display text-xl">
              {status === "certified" ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : status === "blocked" ? (
                <TriangleAlert className="h-5 w-5 text-destructive" />
              ) : (
                <CircleDashed className="h-5 w-5 text-muted-foreground" />
              )}
              {certification.isLoading ? "Checking…" : statusLabel}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Production activation requires current configuration, backup and restore evidence,
              healthy operational engines, reliable capability execution, and a clean Event Mesh.
            </p>
          </div>
          {certification.data && (
            <div className="text-right text-xs text-muted-foreground">
              24h window · {certification.data.metrics.capability_invocations} capability calls ·{" "}
              {certification.data.metrics.dead_letters} dead letters
            </div>
          )}
        </div>

        {certification.error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            Production certification could not be calculated: {certification.error.message}
          </div>
        )}

        {criticalGates.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {criticalGates.map((gate) => (
              <div key={gate.id} className="rounded-xl border hairline bg-background/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {gate.status === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : gate.status === "fail" ? (
                    <TriangleAlert className="h-4 w-4 text-destructive" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                  )}
                  {gate.label}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {gate.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 rounded-2xl border hairline bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-display text-lg">Advanced workspace</div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use Platform Studio when you need to inspect lifecycle, permissions, events, signals, or platform diagnostics. Normal human operation should happen in Today, Plan, My State, Intelligence, Engines, and Me.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map(({ icon: Icon, title, description, to }) => (
          <Link
            key={title}
            to={to}
            className="rounded-2xl border hairline bg-surface p-5 transition-colors hover:bg-surface-elevated/70"
          >
            <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <div className="mt-4 font-display text-lg">{title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </Link>
        ))}
      </section>
    </Shell>
  );
}
