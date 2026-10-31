import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import {
  REGISTERED_ENGINES,
  type EngineDescriptor,
} from "@/lib/engines/contract";
import { listEngines, registerEngine } from "@/lib/kernel.functions";
import {
  transitionEngine,
  validateEngineInstall,
} from "@/lib/platform-manager.functions";

export const Route = createFileRoute("/engine-registry")({
  head: () => ({
    meta: [
      { title: "Engine Registry — Platform Studio" },
      {
        name: "description",
        content:
          "The Platform Foundation registry. Every installed Operating System declares its contract, lifecycle, permissions, and health.",
      },
    ],
  }),
  component: EngineRegistryPage,
});

type LifecycleState =
  | "DISCOVERED"
  | "INSTALLED"
  | "REGISTERED"
  | "VALIDATED"
  | "ENABLED"
  | "RUNNING"
  | "SUSPENDED"
  | "DISABLED"
  | "UNINSTALLED";

type InstalledEngine = {
  engine_id: string;
  name: string;
  version: string;
  status: "active" | "inactive" | "deprecated";
  lifecycle_state: LifecycleState;
  health: string;
  installed_at: string;
};

function isOperational(state: LifecycleState) {
  return state === "ENABLED" || state === "RUNNING";
}

function EngineRegistryPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const list = useServerFn(listEngines);
  const register = useServerFn(registerEngine);
  const validate = useServerFn(validateEngineInstall);
  const transition = useServerFn(transitionEngine);

  const { data, isLoading } = useQuery({
    queryKey: ["engines"],
    enabled: !!session,
    queryFn: () => list(),
  });

  const builtInEngines = REGISTERED_ENGINES.filter(
    (engine) => engine.owner !== "External Operating Engine",
  );

  const installAll = useMutation({
    mutationFn: async () => {
      // External engines are never auto-installed or auto-enabled. They use
      // their dedicated discovery + consent workflow.
      for (const e of builtInEngines) {
        await register({
          data: {
            engine_id: e.id,
            name: e.name,
            version: e.version,
            purpose: e.purpose,
            owner: e.owner,
            status: e.status,
            capabilities: e.capabilities,
            data_owned: e.dataOwned,
            events_published: e.eventsPublished,
            events_consumed: e.eventsConsumed,
            required_signals: e.requiredSignals,
            published_signals: e.publishedSignals,
            dependencies: e.dependencies,
            permissions: e.permissions,
          },
        });
      }

      for (const e of builtInEngines) {
        const result = await validate({ data: { engine_id: e.id } });
        if (!result.ok) {
          throw new Error(
            `Validation failed for ${e.id}: ${result.reasons.join(", ")}`,
          );
        }
      }

      for (const e of builtInEngines) {
        await transition({
          data: {
            engine_id: e.id,
            to: "ENABLED",
            note: "built-in catalogue registration completed",
          },
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engines"] }),
  });

  const toggle = useMutation({
    mutationFn: async (engine: InstalledEngine) => {
      if (isOperational(engine.lifecycle_state)) {
        return transition({
          data: {
            engine_id: engine.engine_id,
            to: "DISABLED",
            note: "operator disabled engine",
          },
        });
      }

      const validation = await validate({
        data: { engine_id: engine.engine_id },
      });
      if (!validation.ok) {
        throw new Error(validation.reasons.join(", "));
      }

      return transition({
        data: {
          engine_id: engine.engine_id,
          to: "ENABLED",
          note: "operator enabled validated engine",
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engines"] }),
  });

  const installed = (data?.engines ?? []) as InstalledEngine[];
  const installedMap = new Map(installed.map((e) => [e.engine_id, e]));

  return (
    <Shell>
      <PageHeader
        eyebrow="Engine registry"
        title="The Platform Foundation."
        intro="The Kernel is not the domain. Installed engines are governed by persisted manifests, validation, lifecycle, permissions, and health."
      />

      <section className="mt-8 flex items-center justify-between rounded-2xl border hairline bg-surface p-5">
        <div>
          <div className="font-display">Built-in engine catalogue</div>
          <div className="text-sm text-muted-foreground">
            {installed.length} installed · {builtInEngines.length} built-in ·{" "}
            {REGISTERED_ENGINES.length - builtInEngines.length} external
          </div>
        </div>
        <button
          onClick={() => installAll.mutate()}
          disabled={installAll.isPending}
          className="rounded-md border hairline px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
        >
          {installAll.isPending ? "Registering & validating…" : "Register / sync built-ins"}
        </button>
      </section>

      {installAll.error && (
        <div className="mt-4 rounded-lg border hairline bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {installAll.error.message}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {REGISTERED_ENGINES.map((e) => (
          <EngineCard
            key={e.id}
            descriptor={e}
            installed={installedMap.get(e.id)}
            loading={isLoading}
            busy={toggle.isPending}
            onToggle={(engine) => toggle.mutate(engine)}
          />
        ))}
      </section>
    </Shell>
  );
}

function EngineCard({
  descriptor: e,
  installed,
  loading,
  busy,
  onToggle,
}: {
  descriptor: EngineDescriptor;
  installed?: InstalledEngine;
  loading: boolean;
  busy: boolean;
  onToggle: (engine: InstalledEngine) => void;
}) {
  const operational = installed ? isOperational(installed.lifecycle_state) : false;

  const dotColor = operational
    ? "var(--color-success)"
    : installed?.lifecycle_state === "UNINSTALLED"
      ? "var(--color-destructive)"
      : installed
        ? "var(--color-warning)"
        : "var(--color-muted-foreground)";

  const label = !installed
    ? loading
      ? "…"
      : "Not installed"
    : installed.lifecycle_state;

  return (
    <article className="rounded-2xl border hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-lg">{e.name}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {e.id} · v{e.version} · {e.owner}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground/90">
        {e.purpose}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <Meta label="Data owned" values={e.dataOwned} />
        <Meta label="Emits" values={e.eventsPublished} />
        <Meta label="Signals" values={e.publishedSignals} />
        <Meta label="Consumes" values={e.requiredSignals} />
      </dl>

      {installed && installed.lifecycle_state !== "UNINSTALLED" && (
        <div className="mt-5 flex items-center justify-between border-t hairline pt-4 text-[11px] text-muted-foreground">
          <span>
            Health: {installed.health} · Installed{" "}
            {new Date(installed.installed_at).toLocaleDateString()}
          </span>
          <button
            onClick={() => onToggle(installed)}
            disabled={busy}
            className="text-foreground/80 hover:text-foreground disabled:opacity-50"
          >
            {operational ? "Disable" : "Validate & enable"} →
          </button>
        </div>
      )}
    </article>
  );
}

function Meta({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-foreground/85">
        {values.length ? values.join(", ") : "—"}
      </dd>
    </div>
  );
}
