// Timeline Service — CSPS Ch. 7.
// Unifies events, check-ins, reflections, and recommendations into one feed.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TimelineItem = {
  id: string;
  at: string;
  kind: "event" | "check_in" | "reflection" | "recommendation" | "signal";
  title: string;
  detail?: string;
  meta?: Record<string, unknown>;
};

export const getTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [events, checkIns, reflections, recs, signals] = await Promise.all([
      supabase
        .from("hos_events")
        .select("id, type, source_engine, occurred_at, payload")
        .order("occurred_at", { ascending: false })
        .limit(40),
      supabase
        .from("check_ins")
        .select("id, created_at, energy, focus, recovery, stress, mood, note")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reflections")
        .select("id, created_at, prompt, entry")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("recommendations")
        .select("id, created_at, title, body, status, confidence")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("engine_signals")
        .select("id, occurred_at, engine, signal_key, value_num, value_text, trend")
        .order("occurred_at", { ascending: false })
        .limit(40),
    ]);

    const items: TimelineItem[] = [];

    for (const r of events.data ?? []) {
      items.push({
        id: `e:${r.id}`,
        at: r.occurred_at,
        kind: "event",
        title: r.type,
        detail: r.source_engine,
        meta: { payload: r.payload },
      });
    }
    for (const r of checkIns.data ?? []) {
      items.push({
        id: `c:${r.id}`,
        at: r.created_at,
        kind: "check_in",
        title: `Check-in · energy ${r.energy}, focus ${r.focus}`,
        detail: r.note ?? `recovery ${r.recovery} · stress ${r.stress} · mood ${r.mood}`,
      });
    }
    for (const r of reflections.data ?? []) {
      items.push({
        id: `r:${r.id}`,
        at: r.created_at,
        kind: "reflection",
        title: r.prompt,
        detail: r.entry.slice(0, 200) + (r.entry.length > 200 ? "…" : ""),
      });
    }
    for (const r of recs.data ?? []) {
      items.push({
        id: `p:${r.id}`,
        at: r.created_at,
        kind: "recommendation",
        title: r.title,
        detail: r.body,
        meta: { status: r.status, confidence: r.confidence },
      });
    }
    for (const r of signals.data ?? []) {
      items.push({
        id: `s:${r.id}`,
        at: r.occurred_at,
        kind: "signal",
        title: `${r.signal_key} = ${r.value_num ?? r.value_text ?? "—"}`,
        detail: `${r.engine}${r.trend ? " · " + r.trend : ""}`,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { items: items.slice(0, 100) };
  });
