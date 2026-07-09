import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Moon } from "lucide-react";
import { Shell } from "@/components/hos/Shell";
import { PageHeader } from "@/components/hos/PageHeader";
import { reflectionPrompts } from "@/lib/hos-extras";

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

  return (
    <Shell>
      <PageHeader
        eyebrow="Reflection"
        title="Close the day, calibrate the next."
        intro="The evening loop. One prompt. One honest answer. One thing you will change tomorrow — no more."
      />

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Composer */}
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
            <span>{entry.trim().length} characters · local draft</span>
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Save entry
            </button>
          </div>
        </div>

        {/* Prompts */}
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
