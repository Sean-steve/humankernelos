import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Apple, ChevronRight, Dumbbell, Layers, Settings2 } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import { listEngines } from "@/lib/kernel.functions";
import { REGISTERED_ENGINES } from "@/lib/engines/contract";

export const Route = createFileRoute("/engines")({
  head: () => ({
    meta: [
      { title: "Engines — HumanKernelOS" },
      {
        name: "description",
        content:
          "The specialist Operating Engines connected to your HumanKernelOS, shown as apps rather than infrastructure.",
      },
    ],
  }),
  component: EnginesPage,
});

type InstalledEngine = {
  engine_id: string;
  name: string;
  lifecycle_state: string;
  health: string;
  version: string;
};

const engineRoutes = {
  nutrition: "/nutrition",
  body: "/body",
  "execution-os": "/execution-os",
} as const;

function EnginesPage() {
  const { session } = useSession();
  const list = useServerFn(listEngines);

  const query = useQuery({
    queryKey: ["engines-human"],
    enabled: !!session,
    queryFn: () => list(),
  });

  const installed = (query.data?.engines ?? []) as InstalledEngine[];
  const byId = new Map(installed.map((engine) => [engine.engine_id, engine]));
  const domainEngines = REGISTERED_ENGINES.filter(
    (engine) => !engine.owner.includes("HOS Kernel"),
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Engines"
        title="Specialist systems that help run parts of your life."
        intro="Each engine owns its own domain. HumanKernelOS only consumes the context it is allowed to use."
      />

      {!session ? (
        <div className="mt-8 rounded-xl border hairline bg-primary/5 p-4 text-sm text-muted-foreground">
          Sign in to see which Operating Engines are installed for you.
        </div>
      ) : (
        <div className="mt-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {domainEngines.map((descriptor) => {
              const runtime = byId.get(descriptor.id);
              const operational =
                runtime?.lifecycle_state === "ENABLED" ||
                runtime?.lifecycle_state === "RUNNING";
              const route = engineRoutes[descriptor.id as keyof typeof engineRoutes];

              return (
                <article
                  key={descriptor.id}
                  className="group rounded-2xl border hairline bg-surface p-5 transition-colors hover:bg-surface-elevated/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <EngineIcon id={descriptor.id} />
                    <div
                      className={
                        "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] " +
                        (operational
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {operational
                        ? "Available"
                        : runtime
                          ? runtime.lifecycle_state.toLowerCase()
                          : "Not installed"}
                    </div>
                  </div>

                  <h2 className="mt-4 font-display text-xl">{descriptor.name}</h2>
                  <p className="mt-2 min-h-[52px] text-sm leading-relaxed text-muted-foreground">
                    {descriptor.id === "routine"
                      ? "A legacy compatibility tracker. The full Routine Execution OS will replace this role later."
                      : descriptor.purpose}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t hairline pt-4">
                    <div className="text-xs text-muted-foreground">
                      {runtime ? `v${runtime.version} · ${runtime.health}` : "No runtime installed"}
                    </div>
                    {route && (operational || descriptor.id === "execution-os") ? (
                      <Link
                        to={route}
                        className="inline-flex items-center gap-1 text-xs text-foreground hover:text-primary"
                      >
                        {operational ? "Open" : "Set up"} <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">No workspace yet</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              to="/platform-studio"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage lifecycle, permissions and diagnostics in Platform Studio
            </Link>
          </div>
        </div>
      )}
    </Shell>
  );
}

function EngineIcon({ id }: { id: string }) {
  const Icon = id === "nutrition" ? Apple : id === "body" ? Dumbbell : id === "routine" ? Activity : Layers;
  return (
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" strokeWidth={1.5} />
    </div>
  );
}
