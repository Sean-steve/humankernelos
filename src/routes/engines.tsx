import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import {
  REGISTERED_ENGINES,
  type EngineDescriptor,
} from "@/lib/engines/contract";
import {
  listEngines,
  registerEngine,
  setEngineStatus,
} from "@/lib/kernel.functions";

export const Route = createFileRoute("/engines")({
  head: () => ({
    meta: [
      { title: "Engine Registry — Human OS" },
      {
        name: "description",
        content:
          "The Platform Foundation registry. Every installed Operating System declares its contract: version, data owned, signals published, events emitted, permissions.",
      },
    ],
  }),
  component: EnginesPage,
});

type InstalledEngine = {
  engine_id: string;
  name: string;
  version: string;
  status: "active" | "inactive" | "deprecated";
  installed_at: string;
};

function EnginesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listEngines);
  const register = useServerFn(registerEngine);
  const setStatus = useServerFn(setEngineStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["engines"],
    queryFn: () => list(),
  });

  const installAll = useMutation({
    mutationFn: async () => {
      for (const e of REGISTERED_ENGINES) {
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engines"] }),
  });

  const toggle = useMutation({
    mutationFn: (v: { engine_id: string; status: InstalledEngine["status"] }) =>
      setStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engines"] }),
  });

  const installed = (data?.engines ?? []) as InstalledEngine[];
  const installedMap = new Map(installed.map((e) => [e.engine_id, e]));

  return (
    <Shell>
      <PageHeader
        eyebrow="Engine registry"
        title="The Platform Foundation."
        intro="The Kernel is not the domain. Each engine declares its contract — data owned, signals published, events emitted — and the Platform enforces the boundary."
      />

      <section className="mt-8 flex items-center justify-between rounded-2xl border hairline bg-surface p-5">
        <div>
          <div className="font-display">Core engines</div>
          <div className="text-sm text-muted-foreground">
            {installed.length} of {REGISTERED_ENGINES.length} installed
          </div>
        </div>
        <button
          onClick={() => installAll.mutate()}
          disabled={installAll.isPending}
          className="rounded-md border hairline px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
        >
          {installAll.isPending ? "Registering…" : "Register / sync all"}
        </button>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {REGISTERED_ENGINES.map((e) => (
          <EngineCard
            key={e.id}
            descriptor={e}
            installed={installedMap.get(e.id)}
            loading={isLoading}
            onToggle={(status) =>
              toggle.mutate({ engine_id: e.id, status })
            }
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
  onToggle,
}: {
  descriptor: EngineDescriptor;
  installed?: InstalledEngine;
  loading: boolean;
  onToggle: (status: "active" | "inactive") => void;
}) {
  const status: "not_installed" | "active" | "inactive" | "deprecated" =
    !installed ? "not_installed" : installed.status;

  const dotColor =
    status === "active"
      ? "var(--color-success)"
      : status === "inactive"
        ? "var(--color-warning)"
        : status === "deprecated"
          ? "var(--color-destructive)"
          : "var(--color-muted-foreground)";

  const label =
    status === "not_installed"
      ? loading
        ? "…"
        : "Not registered"
      : status[0].toUpperCase() + status.slice(1);

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

      {installed && (
        <div className="mt-5 flex items-center justify-between border-t hairline pt-4 text-[11px] text-muted-foreground">
          <span>
            Installed · {new Date(installed.installed_at).toLocaleDateString()}
          </span>
          <button
            onClick={() =>
              onToggle(installed.status === "active" ? "inactive" : "active")
            }
            className="text-foreground/80 hover:text-foreground"
          >
            {installed.status === "active" ? "Deactivate" : "Activate"} →
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
