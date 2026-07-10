import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Moon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { reflectionPrompts } from "@/lib/hos-extras";
import { submitReflection } from "@/lib/reflection.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/reflection")({
  head: () => ({
    meta: [
      { title: "Reflection — Human OS" },
      {
        name: "description",
        content:
          "The evening loop. A calm, structured close to the operating day — one prompt, one honest answer, one adjustment for tomorrow.",
      },
    ],
  }),
  component: ReflectionPage,
});

function ReflectionPage() {
  const [prompt, setPrompt] = useState(reflectionPrompts[0]);
  const [entry, setEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const call = useServerFn(submitReflection);
  const { session, loading } = useSession();

  async function save() {
    if (!entry.trim()) return;
    setSaving(true);
    try {
      await call({ data: { prompt, entry: entry.trim() } });
      toast.success("Entry saved to your Kernel.");
      setEntry("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Reflection"
        title="Close the day, calibrate the next."
        intro="The evening loop. One prompt. One honest answer. One thing you will change tomorrow — no more."
      />

      {!loading && !session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border hairline bg-primary/5 px-4 py-3 text-sm">
          <span className="text-foreground/90">
            Sign in to keep your journal private and persistent.
          </span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border hairline bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
              <Moon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Tonight's prompt
              </div>
              <div className="font-display text-lg">{prompt}</div>
            </div>
          </div>

          <textarea
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Write plainly. No one is grading this."
            rows={12}
            className="mt-6 w-full resize-none rounded-xl border hairline bg-background/40 p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />

          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{entry.trim().length} characters</span>
            <button
              onClick={save}
              disabled={saving || !entry.trim() || !session}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {session ? "Save entry" : "Sign in to save"}
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border hairline bg-surface p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Other prompts
          </div>
          <ul className="mt-4 space-y-1.5">
            {reflectionPrompts.map((p) => {
              const active = p === prompt;
              return (
                <li key={p}>
                  <button
                    onClick={() => setPrompt(p)}
                    className={
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors " +
                      (active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground")
                    }
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </section>
    </Shell>
  );
}
