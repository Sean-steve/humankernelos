import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Brain,
  CalendarDays,
  CircleGauge,
  Layers,
  Search,
  Settings2,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";

const commands = [
  { icon: Sun, label: "Today", to: "/", hint: "What matters now" },
  { icon: CalendarDays, label: "Plan", to: "/plan", hint: "Authoritative day" },
  { icon: CircleGauge, label: "My State", to: "/human-state", hint: "How you are" },
  { icon: Brain, label: "Intelligence", to: "/intelligence", hint: "Advice + learning" },
  { icon: Layers, label: "Engines", to: "/engines", hint: "Specialist systems" },
  { icon: UserRound, label: "Me", to: "/me", hint: "Identity + goals" },
  { icon: Settings2, label: "Platform Studio", to: "/platform-studio", hint: "Advanced system tools" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "Escape") {
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
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.hint.toLowerCase().includes(needle),
    );
  }, [q]);

  useEffect(() => {
    setCursor(0);
  }, [q, open]);

  if (!open) return null;

  const go = (to: (typeof commands)[number]["to"]) => {
    setOpen(false);
    setQ("");
    navigate({ to });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start pt-[12vh]">
      <button
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-label="Close command palette"
      />
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border hairline bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b hairline px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                const item = filtered[cursor];
                if (item) go(item.to);
              }
            }}
            placeholder="Where do you want to go?"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No matching workspace.
            </li>
          )}
          {filtered.map((command, index) => {
            const Icon = command.icon;
            const active = index === cursor;
            return (
              <li key={command.to}>
                <button
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(command.to)}
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
                  <span className="flex-1">{command.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {command.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t hairline px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" strokeWidth={1.5} />
            Personal HOS
          </div>
          <div className="font-mono">⌘K</div>
        </div>
      </div>
    </div>
  );
}
