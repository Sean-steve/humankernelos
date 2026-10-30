import type { Db } from "./permissions.server";

export type TimeWindow = {
  start_at: string | null;
  end_at: string | null;
  protected?: boolean;
  id?: string;
};

export function intervalsOverlap(a: TimeWindow, b: TimeWindow) {
  if (!a.start_at || !a.end_at || !b.start_at || !b.end_at) return false;
  const aStart = new Date(a.start_at).getTime();
  const aEnd = new Date(a.end_at).getTime();
  const bStart = new Date(b.start_at).getTime();
  const bEnd = new Date(b.end_at).getTime();
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function validateWindow(startAt?: string | null, endAt?: string | null) {
  if (!startAt && !endAt) return;
  if (!startAt || !endAt) {
    throw new Error("A timed plan item must include both start_at and end_at.");
  }
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Plan item end_at must be later than start_at.");
  }
}

export function protectedConflict(
  candidate: TimeWindow,
  existing: TimeWindow[],
  ignoreId?: string,
) {
  return existing.find(
    (item) =>
      item.protected &&
      item.id !== ignoreId &&
      intervalsOverlap(candidate, item),
  );
}

/**
 * Refresh the Kernel-owned context behind a Daily Operating Plan without
 * inventing schedule items. Actual timeline entries remain explicit human
 * choices or accepted engine proposals.
 */
export async function materializeDailyPlanContext(
  db: Db,
  userId: string,
  planDate: string,
) {
  const [
    { data: current },
    { data: hsv, error: hsvError },
    { data: goals, error: goalsError },
    { data: policies, error: policiesError },
    { data: decisions, error: decisionsError },
  ] = await Promise.all([
    db
      .from("daily_plans")
      .select("id, status")
      .eq("user_id", userId)
      .eq("plan_date", planDate)
      .maybeSingle(),
    db
      .from("human_states")
      .select(
        "as_of, composite, coverage, confidence, source_count, physical, cognitive, emotional, behavioral, lifestyle, operational",
      )
      .eq("user_id", userId)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("goals")
      .select("id, title, horizon, priority, progress, target_date")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(20),
    db
      .from("policies")
      .select("id, name, priority, when_condition, then_action")
      .eq("user_id", userId)
      .eq("active", true)
      .order("priority", { ascending: true }),
    db
      .from("decision_memory")
      .select("id, recommendation_id, chosen_action, decision_status, expected_outcome, decided_at")
      .eq("user_id", userId)
      .in("decision_status", ["accepted", "modified", "completed"])
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);

  if (hsvError) throw new Error(hsvError.message);
  if (goalsError) throw new Error(goalsError.message);
  if (policiesError) throw new Error(policiesError.message);
  if (decisionsError) throw new Error(decisionsError.message);

  const snapshot = {
    human_state: hsv ?? null,
    goals: goals ?? [],
    policies: policies ?? [],
    recent_decisions: decisions ?? [],
    refreshed_at: new Date().toISOString(),
  };

  if (current) {
    const { data: plan, error } = await db
      .from("daily_plans")
      .update({
        context_snapshot: snapshot as never,
        generated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return plan;
  }

  const { data: plan, error } = await db
    .from("daily_plans")
    .insert({
      user_id: userId,
      plan_date: planDate,
      status: "draft",
      context_snapshot: snapshot as never,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return plan;
}
