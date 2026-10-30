import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  GitBranch,
  Layers,
  ScrollText,
  ShieldCheck,
  Workflow,
  Wrench,
} from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";

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
  return (
    <Shell>
      <PageHeader
        eyebrow="Platform Studio"
        title="Run the system, not your day."
        intro="These are technical and administrative surfaces. They stay separate from Personal HOS so everyday use remains focused on the human."
      />

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
