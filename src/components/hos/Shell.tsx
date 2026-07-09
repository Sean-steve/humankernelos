import type { ReactNode } from "react";
import {
  Activity,
  CircleGauge,
  Compass,
  Flame,
  Layers,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";

const navItems = [
  { icon: Sun, label: "Today", active: true },
  { icon: CircleGauge, label: "Human State" },
  { icon: Compass, label: "Standards" },
  { icon: Flame, label: "Achievements" },
  { icon: Layers, label: "Engines" },
  { icon: Activity, label: "Signals" },
  { icon: Moon, label: "Reflection" },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col justify-between border-r hairline px-5 py-8 md:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="leading-tight">
                <div className="font-display text-[15px] tracking-tight">
                  Human OS
                </div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Kernel · v0.1
                </div>
              </div>
            </div>

            <nav className="mt-10 flex flex-col gap-0.5">
              {navItems.map(({ icon: Icon, label, active }) => (
                <button
                  key={label}
                  className={
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors " +
                    (active
                      ? "bg-surface-elevated text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground")
                  }
                >
                  <Icon
                    className={
                      "h-4 w-4 " +
                      (active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")
                    }
                    strokeWidth={1.5}
                  />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="rounded-lg border hairline bg-surface/60 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Connected systems
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {["Body OS", "Trading OS", "Finance OS", "Nutrition"].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
