import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { engines, type EngineStatus } from "@/lib/hos-extras";

export const Route = createFileRoute("/engines")({
  head: () => ({
    meta: [
      { title: "Connected Engines — Human OS" },
      {
        name: "description",
        content:
          "The Kernel orchestrates, it does not own the domain. Each engine is a specialized operating system feeding the human context.",
      },
    ],
  }),
  component: EnginesPage,
});

const statusColor: Record<EngineStatus, string> = {
  online: "var(--color-success)",
  syncing: "var(--color-primary)",
  offline: "var(--color-muted-foreground)",
};

const statusLabel: Record<EngineStatus, string> = {
  online: "Online",
  syncing: "Syncing",
  offline: "Offline",
};

function EnginesPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Connected engines"
        title="The ecosystem, in one glance."
        intro="The Kernel is not the domain. Each engine specializes — Body, Trading, Finance, Nutrition — and feeds context back so every system becomes more intelligent about the human."
      />

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {engines.map((e) => (
          <article
            key={e.name}
            className="rounded-2xl border hairline bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-lg">{e.name}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {e.scope}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColor[e.status] }}
                />
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {statusLabel[e.status]}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-foreground/90">
              {e.notes}
            </p>

            <div className="mt-5 flex items-center justify-between border-t hairline pt-4 text-[11px] text-muted-foreground">
              <span>Last sync · {e.lastSync}</span>
              <button className="text-foreground/80 hover:text-foreground">
                Manage →
              </button>
            </div>
          </article>
        ))}
      </section>
    </Shell>
  );
}
