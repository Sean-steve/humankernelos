import { describe, expect, it } from "vitest";
import {
  intervalsOverlap,
  protectedConflict,
  validateWindow,
} from "../daily-plan.server";
import {
  emptyHumanState,
  projectHumanState,
} from "../hsie.server";
import {
  clampRecommendationConfidence,
  decisionConfidenceCeiling,
} from "../pdie.server";
import type { FusedAxis } from "../orchestrator.server";

function axis(
  name: FusedAxis["axis"],
  value: number | null,
  confidence: number | null,
): FusedAxis {
  return {
    axis: name,
    value,
    confidence,
    contested: false,
    spread: value === null ? null : 0,
    contributions:
      value === null
        ? []
        : [
            {
              source: `test.${name}`,
              engine: "test-engine",
              raw: value,
              normalized: value,
              weight: 0.7,
              confidence: confidence ?? 0.5,
              reliability: 0.8,
              recency: 1,
              trend: "stable",
              occurred_at: "2026-10-30T08:00:00.000Z",
            },
          ],
  };
}

describe("Personal Kernel Human State truth", () => {
  it("represents missing state as unknown rather than a synthetic score", () => {
    const hsv = emptyHumanState("2026-10-30");
    expect(hsv.composite).toBeNull();
    expect(hsv.coverage).toBe(0);
    expect(hsv.confidence).toBeNull();
    expect(hsv.source_count).toBe(0);
  });

  it("reports partial coverage when only some axes have evidence", () => {
    const fused: FusedAxis[] = [
      axis("physical", 80, 0.8),
      axis("cognitive", 60, 0.6),
      axis("emotional", null, null),
      axis("behavioral", null, null),
      axis("lifestyle", null, null),
      axis("operational", null, null),
    ];

    const hsv = projectHumanState(fused, "2026-10-30");
    expect(hsv.coverage).toBe(0.33);
    expect(hsv.source_count).toBe(2);
    expect(hsv.confidence).toBe(0.7);
    expect(hsv.composite).toBe(71);
  });
});

describe("Daily Operating Plan authority rules", () => {
  const protectedBlock = {
    id: "sleep",
    start_at: "2026-10-30T21:00:00.000Z",
    end_at: "2026-10-31T05:00:00.000Z",
    protected: true,
  };

  it("detects real interval overlap", () => {
    expect(
      intervalsOverlap(protectedBlock, {
        start_at: "2026-10-30T22:00:00.000Z",
        end_at: "2026-10-30T23:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("protects commitments from overlapping accepted work", () => {
    expect(
      protectedConflict(
        {
          start_at: "2026-10-30T22:00:00.000Z",
          end_at: "2026-10-30T23:00:00.000Z",
        },
        [protectedBlock],
      )?.id,
    ).toBe("sleep");
  });

  it("rejects invalid time windows", () => {
    expect(() =>
      validateWindow(
        "2026-10-30T10:00:00.000Z",
        "2026-10-30T09:00:00.000Z",
      ),
    ).toThrow();
  });
});

describe("Decision confidence", () => {
  it("caps advice sharply when Human State evidence is sparse", () => {
    const ceiling = decisionConfidenceCeiling({
      coverage: 0.17,
      confidence: 0.5,
      stateDate: "2026-10-30",
      today: "2026-10-30",
    });
    expect(ceiling).toBeLessThan(0.5);
    expect(clampRecommendationConfidence(0.95, ceiling)).toBe(ceiling);
  });

  it("discounts stale Human State", () => {
    const fresh = decisionConfidenceCeiling({
      coverage: 1,
      confidence: 0.9,
      stateDate: "2026-10-30",
      today: "2026-10-30",
    });
    const stale = decisionConfidenceCeiling({
      coverage: 1,
      confidence: 0.9,
      stateDate: "2026-10-29",
      today: "2026-10-30",
    });
    expect(stale).toBeLessThan(fresh);
  });
});
