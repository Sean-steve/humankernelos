import type { Db } from "./permissions.server";
import {
  derivePatterns,
  type OutcomeRow,
  type RecRow,
} from "./learning.server";

function memoryKey(label: string, axis: string | null) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `learned-pattern:${axis ?? "general"}:${slug}`;
}

export async function refreshLearningMemory(db: Db, userId: string) {
  const [{ data: recs, error: recError }, { data: outcomes, error: outcomeError }] =
    await Promise.all([
      db
        .from("recommendations")
        .select("id, type, title, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("recommendation_outcomes")
        .select("recommendation_id, executed, effect, friction, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(200),
    ]);

  if (recError) throw new Error(recError.message);
  if (outcomeError) throw new Error(outcomeError.message);

  const derived = derivePatterns(
    (recs ?? []) as unknown as RecRow[],
    (outcomes ?? []) as unknown as OutcomeRow[],
  );

  const { error: clearPatternError } = await db
    .from("learned_patterns")
    .delete()
    .eq("user_id", userId);
  if (clearPatternError) throw new Error(clearPatternError.message);

  if (derived.length > 0) {
    const { error: insertError } = await db.from("learned_patterns").insert(
      derived.map((pattern) => ({
        user_id: userId,
        label: pattern.label,
        description: pattern.description,
        axis: pattern.axis,
        evidence_count: pattern.evidence_count,
        confidence: pattern.confidence,
        active: true,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  // Learned pattern memory is a projection of measured evidence. Mark the old
  // projection inactive first so disappeared patterns are not remembered as current.
  const { error: deactivateError } = await db
    .from("personal_memory")
    .update({ active: false })
    .eq("user_id", userId)
    .eq("memory_type", "pattern");
  if (deactivateError) throw new Error(deactivateError.message);

  const now = new Date().toISOString();
  const memories = derived
    .filter((pattern) => pattern.evidence_count >= 3)
    .map((pattern) => ({
      user_id: userId,
      memory_type: "pattern",
      memory_key: memoryKey(pattern.label, pattern.axis),
      summary: pattern.description,
      evidence: [
        `pattern=${pattern.label}`,
        `axis=${pattern.axis ?? "general"}`,
        `evidence_count=${pattern.evidence_count}`,
      ] as never,
      confidence: pattern.confidence,
      active: true,
      last_observed_at: now,
    }));

  if (memories.length > 0) {
    const { error: memoryError } = await db
      .from("personal_memory")
      .upsert(memories, { onConflict: "user_id,memory_key" });
    if (memoryError) throw new Error(memoryError.message);
  }

  return {
    patterns: derived,
    pattern_count: derived.length,
    memory_count: memories.length,
  };
}
