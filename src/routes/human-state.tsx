import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { StateRing } from "@/components/hos/StateRing";
import {
  computeHumanStateVector,
  getLatestHSV,
  type HumanStateVector,
  type StateFamily,
} from "@/lib/hsie.functions";

export const Route = createFileRoute("/human-state")({
  head: () => ({
    meta: [
      { title: "My State — HumanKernelOS" },
      {
        name: "description",
        content:
          "The Human State Vector — physical, cognitive, emotional, behavioral, lifestyle, operational — with confidence and trend on every dimension.",
      },
    ],
  }),
  component: HumanStatePage,
});

const FAMILIES: Array<{ key: keyof HumanStateVector; label: string; hint: string }> = [
  { key: "physical", label: "Physical", hint: "Recovery + training load." },
  { key: "cognitive", label: "Cognitive", hint: "Focus discounted by stress." },
  { key: "emotional", label: "Emotional", hint: "Mood + inverse stress." },
  { key: "behavioral", label: "Behavioral", hint: "Routine adherence + streak." },
  { key: "lifestyle", label: "Lifestyle", hint: "Nutrition + hydration." },
  { key: "operational", label: "Operational", hint: "Energy discounted by stress." },
];

function HumanStatePage() {
  const { session } = useSession();
  const qc = useQueryClient();
  const get = useServerFn(getLatestHSV);
  const compute = useServerFn(computeHumanStateVector);

  const { data, isLoading } = useQuery({
    queryKey: ["hsv"],
    enabled: !!session,
    queryFn: () => get(),
  });

  const recompute = useMutation({
    mutationFn: () => compute(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hsv"] }),
  });

  const hsv = data?.hsv;

  return (
    <Shell>
      <PageHeader
        eyebrow="My State"
        title="How you are, not just what you did."
        intro="HOS combines your own check-ins with trusted engine evidence. Unknown stays unknown, and every score carries confidence."
      />

      <section className="mt-8 grid gap-4 rounded-2xl border hairline bg-surface p-5 sm:grid-cols-[1.2fr_.8fr_.8fr_.8fr]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Overall condition
          </div>
          <div className="mt-1 font-display text-4xl">
            {hsv?.composite ?? "—"}
            {hsv?.composite !== null && hsv?.composite !== undefined && (
              <span className="ml-1 text-sm text-muted-foreground">/100</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {hsv?.as_of ? `As of ${hsv.as_of}` : "Not enough evidence yet."}
          </div>
        </div>
        <StateMeta label="Coverage" value={hsv ? `${Math.round(hsv.coverage * 100)}%` : "—"} />
        <StateMeta
          label="Confidence"
          value={
            hsv?.confidence !== null && hsv?.confidence !== undefined
              ? `${Math.round(hsv.confidence * 100)}%`
              : "—"
          }
        />
        <StateMeta label="Evidence sources" value={hsv ? String(hsv.source_count) : "—"} />
        <div className="sm:col-span-4 flex justify-end">
        <button
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="inline-flex items-center gap-2 rounded-md border hairline bg-surface-elevated px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          {recompute.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Recompute HSV
        </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading state…
          </div>
        )}
        {hsv &&
          FAMILIES.map((f) => {
            const fam = hsv[f.key] as StateFamily;
            return <FamilyCard key={f.key} label={f.label} hint={f.hint} family={fam} />;
          })}
      </section>
    </Shell>
  );
}

function FamilyCard({
  label,
  hint,
  family,
}: {
  label: string;
  hint: string;
  family: StateFamily;
}) {
  const value = family.value;
  const confidencePct = Math.round((family.confidence ?? 0) * 100);
  return (
    <article className="rounded-2xl border hairline bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-display text-4xl leading-none">
            {value ?? "—"}
            {value !== null && (
              <span className="ml-1 text-sm text-muted-foreground">/100</span>
            )}
          </div>
        </div>
        {value !== null && <StateRing value={value} size={56} stroke={4} />}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {family.note ?? hint}
      </p>

      <div className="mt-4 space-y-2">
        <MiniBar label="Confidence" pct={confidencePct} />
        <MiniBar
          label="Reliability"
          pct={Math.round((family.reliability ?? 0) * 100)}
        />
      </div>

      {family.inputs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {family.inputs.map((i) => (
            <span
              key={i}
              className="rounded-full border hairline px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {i}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function StateMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function MiniBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/60">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%`, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}
