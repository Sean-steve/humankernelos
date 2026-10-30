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
