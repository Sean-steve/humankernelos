import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CircleGauge,
  ClipboardCheck,
  Compass,
  Flame,
  Layers,
  Moon,
  Search,
  Sparkles,
  Sun,
  Workflow,
} from "lucide-react";

const commands = [
  { icon: Sun, label: "Today", to: "/", hint: "Kernel home" },
  { icon: ClipboardCheck, label: "Check-in", to: "/check-in", hint: "Log human state" },
  { icon: CircleGauge, label: "Human State", to: "/human-state", hint: "Live readings" },
  { icon: Workflow, label: "Orchestrator", to: "/orchestrator", hint: "Fused state + priorities" },
  { icon: Compass, label: "Standards", to: "/standards", hint: "Who I am, measured" },
  { icon: Workflow, label: "Protocols", to: "/protocols", hint: "Playbooks" },
  { icon: Flame, label: "Achievements", to: "/achievements", hint: "Lifetime ledger" },
  { icon: Layers, label: "Engines", to: "/engines", hint: "Connected systems" },
  { icon: Activity, label: "Signals", to: "/signals", hint: "Ecosystem stream" },
  { icon: Moon, label: "Reflection", to: "/reflection", hint: "Journal + prompts" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.hint.toLowerCase().includes(needle),
    );
  }, [q]);

  useEffect(() => {
    setCursor(0);
  }, [q, open]);

  if (!open) return null;

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    navigate({ to });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start pt-[12vh]">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl border hairline bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b hairline px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                const item = filtered[cursor];
                if (item) go(item.to);
              }
            }}
            placeholder="Jump to a surface…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No matching surface.
            </li>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            const active = i === cursor;
            return (
              <li key={c.to}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(c.to)}
                  className={
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors " +
                    (active
                      ? "bg-surface-elevated text-foreground"
                      : "text-foreground/85 hover:bg-surface-elevated")
                  }
                >
                  <Icon
                    className={
                      "h-4 w-4 " +
                      (active ? "text-primary" : "text-muted-foreground")
                    }
                    strokeWidth={1.5}
                  />
                  <span className="flex-1">{c.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t hairline px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" strokeWidth={1.5} />
            Kernel command
          </div>
          <div className="font-mono">⌘K</div>
        </div>
      </div>
    </div>
  );
}
