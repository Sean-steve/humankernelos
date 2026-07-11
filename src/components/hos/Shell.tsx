import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CircleGauge,
  Compass,
  Flame,
  Layers,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  X,
  ClipboardCheck,
  Workflow,
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { icon: Sun, label: "Today", to: "/" },
  { icon: ClipboardCheck, label: "Check-in", to: "/check-in" },
  { icon: CircleGauge, label: "Human State", to: "/human-state" },
  { icon: Compass, label: "Standards", to: "/standards" },
  { icon: Workflow, label: "Protocols", to: "/protocols" },
  { icon: Flame, label: "Achievements", to: "/achievements" },
  { icon: Layers, label: "Engines", to: "/engines" },
  { icon: Activity, label: "Signals", to: "/signals" },
  { icon: Moon, label: "Reflection", to: "/reflection" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full">
      <CommandPalette />
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b hairline bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
          <span className="font-display text-sm">Human OS</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md border hairline text-muted-foreground hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between border-r hairline bg-background px-5 py-6">
            <div>
              <div className="flex items-center justify-between">
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5"
                >
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
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-8 flex flex-col gap-0.5">
                {navItems.map(({ icon: Icon, label, to }) => {
                  const active = pathname === to;
                  return (
                    <Link
                      key={label}
                      to={to}
                      onClick={() => setMobileOpen(false)}
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
                          (active ? "text-primary" : "text-muted-foreground")
                        }
                        strokeWidth={1.5}
                      />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col justify-between border-r hairline px-5 py-8 md:flex">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
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
            </Link>

            <nav className="mt-10 flex flex-col gap-0.5">
              {navItems.map(({ icon: Icon, label, to }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={label}
                    to={to}
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
                        (active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground")
                      }
                      strokeWidth={1.5}
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
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
            <AccountBadge />
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-lg border hairline bg-surface/60 px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
              Settings
            </Link>
          </div>
        </aside>


        <main className="flex-1 px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}

function AccountBadge() {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) {
    return (
      <Link
        to="/auth"
        className="rounded-lg border hairline bg-surface/60 px-4 py-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <div className="uppercase tracking-[0.14em]">Not signed in</div>
        <div className="mt-1 text-foreground/90">Sign in to persist state →</div>
      </Link>
    );
  }
  const email = session.user.email ?? "signed in";
  return (
    <div className="rounded-lg border hairline bg-surface/60 p-4 text-xs">
      <div className="uppercase tracking-[0.14em] text-muted-foreground">Operator</div>
      <div className="mt-1 truncate text-foreground/90">{email}</div>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

