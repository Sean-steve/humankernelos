export function decisionConfidenceCeiling(input: {
  coverage: number | null | undefined;
  confidence: number | null | undefined;
  stateDate?: string | null;
  today?: string;
}) {
  const coverage = Math.max(0, Math.min(1, Number(input.coverage ?? 0)));
  const confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));
  let ceiling = 0.2 + coverage * 0.5 + confidence * 0.3;

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (!input.stateDate || input.stateDate < today) {
    ceiling *= 0.7;
  }

  return Math.round(Math.max(0.1, Math.min(1, ceiling)) * 100) / 100;
}

export function clampRecommendationConfidence(
  proposed: number,
  ceiling: number,
) {
  return Math.round(Math.min(Math.max(proposed, 0), ceiling) * 100) / 100;
}
