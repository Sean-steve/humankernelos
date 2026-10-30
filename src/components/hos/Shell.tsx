import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Brain,
  CalendarDays,
  CircleGauge,
  Layers,
  Menu,
  Settings2,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

const personalNav = [
  { icon: Sun, label: "Today", to: "/" },
  { icon: CalendarDays, label: "Plan", to: "/plan" },
  { icon: CircleGauge, label: "My State", to: "/human-state" },
  { icon: Brain, label: "Intelligence", to: "/intelligence" },
  { icon: Layers, label: "Engines", to: "/engines" },
  { icon: UserRound, label: "Me", to: "/me" },
] as const;

const mobileNav = [
  { icon: Sun, label: "Today", to: "/" },
  { icon: CalendarDays, label: "Plan", to: "/plan" },
  { icon: Brain, label: "HOS", to: "/intelligence" },
  { icon: Layers, label: "Engines", to: "/engines" },
  { icon: UserRound, label: "Me", to: "/me" },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full pb-20 md:pb-0">
      <CommandPalette />

      <div className="sticky top-0 z-30 flex items-center justify-between border-b hairline bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-display text-sm">HumanKernelOS</div>
            <div className="text-[10px] text-muted-foreground">Personal HOS</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border hairline text-muted-foreground hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background px-5 py-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg">Personal HOS</div>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-8 flex flex-col gap-1">
              {personalNav.map(({ icon: Icon, label, to }) => {
                const active = isActive(pathname, to);
                return (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                      (active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground")
                    }
                  >
                    <Icon className={active ? "h-4 w-4 text-primary" : "h-4 w-4"} strokeWidth={1.5} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3">
              <Link
                to="/platform-studio"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-xl border hairline px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
                Platform Studio
              </Link>
              <AccountBadge />
            </div>
          </aside>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r hairline px-5 py-8 md:flex">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[16px]">HumanKernelOS</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Personal HOS
              </div>
            </div>
          </Link>

          <nav className="mt-10 flex flex-col gap-1">
            {personalNav.map(({ icon: Icon, label, to }) => {
              const active = isActive(pathname, to);
              return (
                <Link
                  key={label}
                  to={to}
                  className={
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground")
                  }
                >
                  <Icon
                    className={
                      "h-4 w-4 " +
                      (active ? "text-primary" : "group-hover:text-foreground")
                    }
                    strokeWidth={1.5}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <Link
              to="/platform-studio"
              className="flex items-center gap-2 rounded-xl border hairline bg-surface/40 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.5} />
              Platform Studio
            </Link>
            <AccountBadge />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-7 md:px-10 md:py-10 lg:px-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t hairline bg-background/95 px-2 py-1.5 backdrop-blur md:hidden">
        {mobileNav.map(({ icon: Icon, label, to }) => {
          const active = isActive(pathname, to);
          return (
            <Link
              key={label}
              to={to}
              className={
                "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] " +
                (active ? "text-primary" : "text-muted-foreground")
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {label}
            </Link>
          );
        })}
      </nav>
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
        className="block rounded-xl border hairline bg-surface/40 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Sign in to your Kernel →
      </Link>
    );
  }

  const email = session.user.email ?? "signed in";
  return (
    <div className="rounded-xl border hairline bg-surface/40 p-3 text-xs">
      <div className="truncate text-foreground/90">{email}</div>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
