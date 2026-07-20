import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardCheck, Moon, Sparkles, Zap, Loader2 } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { getTimeline, type TimelineItem } from "@/lib/timeline.functions";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Human OS" },
      {
        name: "description",
        content:
          "One coherent narrative of your operating life: events, check-ins, reflections, recommendations, signals.",
      },
    ],
  }),
  component: TimelinePage,
});

const iconFor = (kind: TimelineItem["kind"]) => {
  switch (kind) {
    case "event":
      return Zap;
    case "check_in":
      return ClipboardCheck;
    case "reflection":
      return Moon;
    case "recommendation":
      return Sparkles;
    case "signal":
      return Activity;
  }
};

function TimelinePage() {
  const fetchTimeline = useServerFn(getTimeline);
  const { data, isLoading } = useQuery({
    queryKey: ["timeline"],
    queryFn: () => fetchTimeline(),
  });

  const items = (data?.items ?? []) as TimelineItem[];

  return (
    <Shell>
      <PageHeader
        eyebrow="Timeline"
        title="A coherent narrative of your day."
        intro="Every engine emits into one feed. Nothing lives in isolation — this is what the Kernel actually sees."
      />

      <section className="mt-8 rounded-2xl border hairline bg-surface p-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Assembling timeline…
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Nothing to show yet. Check in, log a meal, or ask the advisor.
          </div>
        )}

        <ol className="space-y-0">
          {items.map((it) => {
            const Icon = iconFor(it.kind);
            return (
              <li
                key={it.id}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-4 border-t hairline py-4 first:border-t-0 first:pt-0"
              >
                <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-md border hairline bg-surface-elevated text-primary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {it.kind.replace("_", " ")}
                  </div>
                  <div className="mt-0.5 text-sm text-foreground/95">
                    {it.title}
                  </div>
                  {it.detail && (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-3">
                      {it.detail}
                    </div>
                  )}
                </div>
                <div className="text-right font-mono text-[11px] text-muted-foreground">
                  {new Date(it.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <div className="text-[10px] opacity-70">
                    {new Date(it.at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </Shell>
  );
}
