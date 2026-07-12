import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { useSession } from "@/hooks/use-session";
import { listTodayMeals, logMeal } from "@/lib/nutrition.functions";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "Nutrition Engine — Human OS" },
      {
        name: "description",
        content:
          "Log meals, hydration, and protein. The Nutrition Engine feeds signals to the Kernel.",
      },
    ],
  }),
  component: NutritionPage,
});

type Meal = {
  id: string;
  meal: string;
  kcal: number;
  protein_g: number;
  water_ml: number;
  note: string | null;
  occurred_at: string;
};

function NutritionPage() {
  const { session, loading: sessionLoading } = useSession();
  const list = useServerFn(listTodayMeals);
  const log = useServerFn(logMeal);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [meal, setMeal] = useState("");
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [water, setWater] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionLoading || !session) return;
    list().then((r) => setMeals(r.meals as Meal[])).catch(() => {});
  }, [session, sessionLoading, list]);

  const totals = meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein_g,
      water: a.water + m.water_ml,
    }),
    { kcal: 0, protein: 0, water: 0 },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!meal.trim() || busy) return;
    setBusy(true);
    try {
      await log({
        data: { meal: meal.trim(), kcal, protein_g: protein, water_ml: water, note: note || undefined },
      });
      const r = await list();
      setMeals(r.meals as Meal[]);
      setMeal("");
      setKcal(0);
      setProtein(0);
      setWater(0);
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Nutrition engine"
        title="Fuel, tracked calmly."
        intro="Log what you ate and drank. The Kernel receives protein, hydration, and calorie signals — nothing more."
      />

      {!sessionLoading && !session && (
        <div className="mt-8 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">Sign in to log meals.</span>{" "}
          <Link to="/auth" className="text-primary underline-offset-2 hover:underline">
            Sign in →
          </Link>
        </div>
      )}

      {session && (
        <>
          <section className="mt-10 grid gap-3 md:grid-cols-3">
            <TotalCard label="Calories today" value={`${totals.kcal}`} unit="kcal" />
            <TotalCard label="Protein today" value={`${totals.protein}`} unit="g" />
            <TotalCard label="Hydration today" value={`${totals.water}`} unit="ml" />
          </section>

          <form
            onSubmit={submit}
            className="mt-8 grid gap-4 rounded-2xl border hairline bg-surface p-6 md:grid-cols-2"
          >
            <Field label="Meal">
              <input
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                placeholder="Oats + eggs"
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Calories (kcal)">
              <input
                type="number"
                value={kcal}
                onChange={(e) => setKcal(Number(e.target.value))}
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Protein (g)">
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Water (ml)">
              <input
                type="number"
                value={water}
                onChange={(e) => setWater(Number(e.target.value))}
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Note" className="md:col-span-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional context"
                className="w-full rounded-md border hairline bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Logging…" : "Log meal"}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <h2 className="font-display text-xl">Today</h2>
            {meals.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ul className="mt-4 space-y-0 rounded-2xl border hairline bg-surface">
                {meals.map((m) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-t hairline px-5 py-3 first:border-t-0"
                  >
                    <div>
                      <div className="text-sm text-foreground/95">{m.meal}</div>
                      {m.note && (
                        <div className="text-xs text-muted-foreground">{m.note}</div>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {m.kcal} kcal · {m.protein_g}g P · {m.water_ml}ml
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function TotalCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border hairline bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl leading-none">
        {value}
        <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={"flex flex-col gap-1.5 " + (className ?? "")}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
