import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power, Trash2, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import {
  listPolicies,
  upsertPolicy,
  togglePolicy,
  deletePolicy,
} from "@/lib/policy.functions";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies — Human OS" },
      {
        name: "description",
        content:
          "Personal operating rules. When state matches a condition, the Kernel proposes the action.",
      },
    ],
  }),
  component: PoliciesPage,
});

type Policy = {
  id: string;
  name: string;
  description: string | null;
  when_condition: Record<string, unknown>;
  then_action: Record<string, unknown>;
  priority: number;
  active: boolean;
};

function PoliciesPage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const list = useServerFn(listPolicies);
  const upsert = useServerFn(upsertPolicy);
  const toggle = useServerFn(togglePolicy);
  const del = useServerFn(deletePolicy);

  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    enabled: !!session,
    queryFn: () => list(),
  });

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    whenText: '{"energy":{"lt":40}}',
    thenText: '{"recommend":"postpone_deep_work"}',
    priority: 100,
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setError(null);
      let when: Record<string, unknown> = {};
      let then: Record<string, unknown> = {};
      try {
        when = JSON.parse(draft.whenText);
        then = JSON.parse(draft.thenText);
      } catch {
        throw new Error("When/Then must be valid JSON.");
      }
      await upsert({
        data: {
          name: draft.name,
          description: draft.description || undefined,
          when_condition: when,
          then_action: then,
          priority: draft.priority,
          active: true,
        },
      });
    },
    onSuccess: () => {
      setDraft({
        name: "",
        description: "",
        whenText: '{"energy":{"lt":40}}',
        thenText: '{"recommend":"postpone_deep_work"}',
        priority: 100,
      });
      qc.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const flip = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policies"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policies"] }),
  });

  const policies = (data?.policies ?? []) as Policy[];

  return (
    <Shell>
      <PageHeader
        eyebrow="Personal policies"
        title="Your operating rules."
        intro="If the Kernel sees this pattern in your state, propose that response. You write the constitution; the system enforces it calmly."
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="font-display text-lg">Active policies</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {policies.length} rule{policies.length === 1 ? "" : "s"}
          </div>

          <ul className="mt-5 space-y-3">
            {isLoading && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </li>
            )}
            {!isLoading && policies.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No policies yet. Draft your first rule on the right.
              </li>
            )}
            {policies.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border hairline bg-surface-elevated p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display">{p.name}</div>
                    {p.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => flip.mutate({ id: p.id, active: !p.active })}
                      className={
                        "grid h-7 w-7 place-items-center rounded-md border hairline " +
                        (p.active ? "text-success" : "text-muted-foreground")
                      }
                      title={p.active ? "Deactivate" : "Activate"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove.mutate(p.id)}
                      className="grid h-7 w-7 place-items-center rounded-md border hairline text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-muted-foreground">
                      When
                    </dt>
                    <dd className="mt-1 font-mono text-foreground/85 break-all">
                      {JSON.stringify(p.when_condition)}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-muted-foreground">
                      Then
                    </dt>
                    <dd className="mt-1 font-mono text-foreground/85 break-all">
                      {JSON.stringify(p.then_action)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Priority {p.priority}</span>
                  <span>{p.active ? "Active" : "Inactive"}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="font-display text-lg">Draft a policy</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Conditions and actions are JSON. The advisor reads active policies before every recommendation.
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Protect deep work when depleted"
                className="w-full rounded-md border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Description (optional)">
              <input
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="When energy is low, don't stack cognitive load."
                className="w-full rounded-md border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="When (JSON)">
              <textarea
                value={draft.whenText}
                onChange={(e) => setDraft({ ...draft, whenText: e.target.value })}
                rows={3}
                className="w-full rounded-md border hairline bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Then (JSON)">
              <textarea
                value={draft.thenText}
                onChange={(e) => setDraft({ ...draft, thenText: e.target.value })}
                rows={3}
                className="w-full rounded-md border hairline bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Priority (lower runs first)">
              <input
                type="number"
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: Number(e.target.value) })
                }
                className="w-full rounded-md border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {error}
              </div>
            )}

            <button
              onClick={() => create.mutate()}
              disabled={!draft.name || create.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Save policy
            </button>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
