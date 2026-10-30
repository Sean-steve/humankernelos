import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Clock3, Loader2, LockKeyhole, Plus, X } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import {
  activateDailyPlan,
  decideDailyPlanProposal,
  getDailyPlan,
  setDailyPlanStatus,
  upsertDailyPlanItem,
} from "@/lib/daily-plan.functions";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — HumanKernelOS" },
      {
        name: "description",
        content:
          "Your authoritative Daily Operating Plan. One timeline for commitments, accepted engine proposals, and protected time.",
      },
    ],
  }),
  component: PlanPage,
});

type PlanItem = {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  source_type: string;
  source_engine: string | null;
  priority: number;
  protected: boolean;
  flexibility: string;
  status: string;
};

type Proposal = {
  id: string;
  title: string;
  description: string | null;
  source_engine: string;
  requested_start: string | null;
  requested_end: string | null;
  flexibility: string;
  priority: number;
  protected: boolean;
  status: string;
};

function PlanPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const getPlan = useServerFn(getDailyPlan);
  const saveItem = useServerFn(upsertDailyPlanItem);
  const setStatus = useServerFn(setDailyPlanStatus);
  const decideProposal = useServerFn(decideDailyPlanProposal);
  const activate = useServerFn(activateDailyPlan);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [protectedBlock, setProtectedBlock] = useState(false);

  const query = useQuery({
    queryKey: ["daily-plan"],
    enabled: !!session,
    queryFn: () => getPlan({ data: {} }),
  });

  const items = (query.data?.items ?? []) as PlanItem[];
  const proposals = ((query.data?.proposals ?? []) as Proposal[]).filter(
    (proposal) => proposal.status === "pending" || proposal.status === "deferred",
  );

  const activeItem = useMemo(() => {
    const current = items.find((item) => item.status === "current");
    if (current) return current;
    const now = Date.now();
    return items.find((item) => {
      if (!item.start_at || !item.end_at || item.status !== "planned") return false;
      return new Date(item.start_at).getTime() <= now && now < new Date(item.end_at).getTime();
    });
  }, [items]);

  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give this block a name.");
      await saveItem({
        data: {
          title: title.trim(),
          start_at: startLocal ? new Date(startLocal).toISOString() : null,
          end_at: endLocal ? new Date(endLocal).toISOString() : null,
          protected: protectedBlock,
          flexibility: protectedBlock ? "fixed" : "flexible",
          status: "planned",
          source_type: "kernel",
          priority: 100,
          metadata: {},
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setStartLocal("");
      setEndLocal("");
      setProtectedBlock(false);
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });

  const status = useMutation({
    mutationFn: (input: { id: string; status: "current" | "completed" | "missed" | "deferred" }) =>
      setStatus({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-plan"] }),
  });

  const decision = useMutation({
    mutationFn: (input: {
      id: string;
      decision: "accepted" | "rejected" | "deferred";
    }) => decideProposal({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-plan"] }),
  });

  const activatePlan = useMutation({
    mutationFn: () => activate({ data: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-plan"] }),
  });

  return (
    <Shell>
      <PageHeader
        eyebrow="Plan"
        title="Your day, in one place."
        intro="This is the authoritative human timeline. Engines can suggest time; only accepted proposals become part of your day."
      />

      {!session && (
        <Callout>Sign in to create and run your Daily Operating Plan.</Callout>
      )}

      {session && (
        <div className="mt-8 space-y-6">
          <section className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
            <div className="rounded-2xl border hairline bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Today's operating plan
                  </div>
                  <div className="mt-1 font-display text-xl">
                    {query.data?.plan?.status === "active" ? "Active" : "Ready when you are"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {query.data?.plan?.status !== "active" && (
                    <button
                      onClick={() => activatePlan.mutate()}
                      disabled={activatePlan.isPending}
                      className="rounded-lg border hairline px-3 py-2 text-xs hover:bg-surface-elevated"
                    >
                      Activate day
                    </button>
                  )}
                  <button
                    onClick={() => setShowAdd((value) => !value)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add block
                  </button>
                </div>
              </div>

              {showAdd && (
                <div className="mt-5 grid gap-3 rounded-xl border hairline bg-background/35 p-4">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What needs protected time?"
                    className="rounded-lg border hairline bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Start">
                      <input
                        type="datetime-local"
                        value={startLocal}
                        onChange={(event) => setStartLocal(event.target.value)}
                        className="w-full rounded-lg border hairline bg-background px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="End">
                      <input
                        type="datetime-local"
                        value={endLocal}
                        onChange={(event) => setEndLocal(event.target.value)}
                        className="w-full rounded-lg border hairline bg-background px-3 py-2 text-sm"
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={protectedBlock}
                      onChange={(event) => setProtectedBlock(event.target.checked)}
                    />
                    Protect this commitment from overlapping accepted work
                  </label>
                  {add.error && (
                    <div className="text-xs text-destructive">{add.error.message}</div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => add.mutate()}
                      disabled={add.isPending}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {add.isPending ? "Adding…" : "Add to day"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-2">
                {query.isLoading && (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your day…
                  </div>
                )}
                {!query.isLoading && items.length === 0 && (
                  <Empty>
                    Your plan is empty. Add a commitment, or review engine proposals when they arrive.
                  </Empty>
                )}
                {items.map((item) => (
                  <PlanRow
                    key={item.id}
                    item={item}
                    active={activeItem?.id === item.id}
                    onStart={() => status.mutate({ id: item.id, status: "current" })}
                    onComplete={() => status.mutate({ id: item.id, status: "completed" })}
                    onDefer={() => status.mutate({ id: item.id, status: "deferred" })}
                  />
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border hairline bg-surface p-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Now
              </div>
              {activeItem ? (
                <div className="mt-3">
                  <div className="font-display text-xl">{activeItem.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {timeRange(activeItem.start_at, activeItem.end_at)}
                  </div>
                  {activeItem.protected && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      <LockKeyhole className="h-3 w-3" /> Protected
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Nothing is currently active. Your next planned block will appear here.
                </p>
              )}
            </aside>
          </section>

          <section className="rounded-2xl border hairline bg-surface p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Suggestions from your engines
                </div>
                <h2 className="mt-1 font-display text-xl">Proposal inbox</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {proposals.length} awaiting you
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {proposals.length === 0 && (
                <Empty>
                  No engine is asking for time right now. Engine proposals will never enter your day silently.
                </Empty>
              )}
              {proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-xl border hairline bg-background/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {proposal.source_engine}
                      </div>
                      <div className="mt-1 font-display text-lg">{proposal.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {timeRange(proposal.requested_start, proposal.requested_end)} · {proposal.flexibility}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => decision.mutate({ id: proposal.id, decision: "accepted" })}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button
                        onClick={() => decision.mutate({ id: proposal.id, decision: "deferred" })}
                        className="rounded-lg border hairline px-2.5 py-1.5 text-xs"
                      >
                        Later
                      </button>
                      <button
                        onClick={() => decision.mutate({ id: proposal.id, decision: "rejected" })}
                        className="grid h-8 w-8 place-items-center rounded-lg border hairline text-muted-foreground hover:text-destructive"
                        aria-label="Reject proposal"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function PlanRow({
  item,
  active,
  onStart,
  onComplete,
  onDefer,
}: {
  item: PlanItem;
  active: boolean;
  onStart: () => void;
  onComplete: () => void;
  onDefer: () => void;
}) {
  return (
    <article
      className={
        "rounded-xl border p-4 transition-colors " +
        (active ? "border-primary/40 bg-primary/5" : "hairline bg-background/25")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {item.protected && <LockKeyhole className="h-3.5 w-3.5 text-primary" />}
            <div className="font-medium">{item.title}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" /> {timeRange(item.start_at, item.end_at)}
            </span>
            <span>·</span>
            <span>{item.status}</span>
            {item.source_engine && (
              <>
                <span>·</span>
                <span>from {item.source_engine}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {item.status === "planned" && (
            <button onClick={onStart} className="rounded-md border hairline px-2.5 py-1.5 text-xs">
              Start
            </button>
          )}
          {(item.status === "planned" || item.status === "current") && (
            <>
              <button
                onClick={onComplete}
                className="rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
              >
                Done
              </button>
              <button onClick={onDefer} className="rounded-md border hairline px-2.5 py-1.5 text-xs">
                Defer
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function timeRange(start: string | null, end: string | null) {
  if (!start || !end) return "Unscheduled";
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Date(start).toLocaleTimeString([], options)} – ${new Date(end).toLocaleTimeString([], options)}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed hairline bg-background/20 p-4 text-sm leading-relaxed text-muted-foreground">
      {children}
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
