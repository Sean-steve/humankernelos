import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalHosIdentityPayload,
  signHosIdentityAssertion,
  verifyHmacBody,
} from "../external-engines/remote-engine.server";
import {
  EXECUTION_OS_DESCRIPTOR,
  EXECUTION_OS_ENGINE_ID,
  executionOsInboundSubscriptionSeeds,
} from "../external-engines/execution-os.server";
import {
  resolveRuntimeCapability,
  resolveRuntimeLifecycleAdapter,
} from "../runtime/registry.server";
import { fuseSignals, type RawSignal } from "../orchestrator.server";

describe("Phase 5 external engine proof — Execution OS contract", () => {
  it("publishes exactly the six canonical Execution OS capabilities", () => {
    expect(EXECUTION_OS_DESCRIPTOR.capabilities).toEqual([
      "schedule.get",
      "session.start",
      "session.advance",
      "session.close",
      "fallback.trigger",
      "discipline.score.get",
    ]);

    for (const capability of EXECUTION_OS_DESCRIPTOR.capabilities) {
      expect(
        resolveRuntimeCapability(EXECUTION_OS_ENGINE_ID, capability, "1.1.0"),
      ).toBeDefined();
    }
  });

  it("registers a generic lifecycle adapter instead of a Platform Manager branch", () => {
    expect(resolveRuntimeLifecycleAdapter(EXECUTION_OS_ENGINE_ID)).toBeDefined();
  });

  it("sorts HOS identity scopes before HMAC signing", () => {
    const assertion = {
      subjectId: "00000000-0000-4000-8000-000000000001",
      tenantId: "personal-hos",
      permissions: ["execution.session.write", "execution.schedule.read"],
      consentScopes: ["execution.performance", "execution.schedule"],
      issuedAt: "2026-10-31T10:00:00.000Z",
    };
    expect(canonicalHosIdentityPayload(assertion)).toBe(
      [
        assertion.subjectId,
        "personal-hos",
        "execution.schedule.read,execution.session.write",
        "execution.performance,execution.schedule",
        assertion.issuedAt,
      ].join("|"),
    );

    const secret = "phase-5-shared-secret-at-least-32-characters";
    expect(signHosIdentityAssertion(assertion, secret)).toHaveLength(64);
  });

  it("verifies Execution OS signed event bodies and rejects tampering", () => {
    const secret = "phase-5-shared-secret-at-least-32-characters";
    const body = JSON.stringify({ id: "event-1", type: "execution.activity.completed" });
    const signature = signBody(body, secret);

    expect(verifyHmacBody(body, signature, secret)).toBe(true);
    expect(verifyHmacBody(body + " ", signature, secret)).toBe(false);
  });

  it("routes inbound Execution OS facts only to generic Kernel consumers", () => {
    expect(executionOsInboundSubscriptionSeeds()).toEqual([
      {
        engine_id: "orchestrator",
        event_type: "execution.behavior.signal",
        handler: "ingest_execution_behavior",
      },
      {
        engine_id: "daily-plan",
        event_type: "execution.schedule.proposal.created",
        handler: "ingest_execution_schedule_proposal",
      },
    ]);
  });

  it("lets unknown external signal names contribute through generic axis metadata", () => {
    const signals: RawSignal[] = [
      {
        engine: "future-external-engine",
        signal_key: "future.unknown.signal",
        value_num: 72,
        confidence: 0.9,
        reliability: 0.8,
        trend: "stable",
        metadata: {
          hos_axis: "behavioral",
          normalized_value: 72,
          base_reliability: 0.8,
        },
        occurred_at: "2026-10-31T10:00:00.000Z",
      },
    ];

    const result = fuseSignals(
      signals,
      null,
      new Date("2026-10-31T10:00:00.000Z").getTime(),
    );
    const behavioral = result.fused.find((axis) => axis.axis === "behavioral");

    expect(behavioral?.value).toBe(72);
    expect(behavioral?.contributions[0]?.source).toBe("future.unknown.signal");
  });

  it("keeps Execution OS identifiers out of Personal Kernel and platform core", () => {
    const coreFiles = [
      "src/lib/platform-manager.server.ts",
      "src/lib/capabilities.server.ts",
      "src/lib/mesh.server.ts",
      "src/lib/hsie.server.ts",
      "src/lib/hsie.functions.ts",
      "src/lib/daily-plan.server.ts",
      "src/lib/daily-plan.functions.ts",
      "src/lib/pdie.server.ts",
      "src/lib/pdie.functions.ts",
      "src/lib/orchestrator.server.ts",
      "src/lib/permissions.server.ts",
      "src/server.ts",
    ];

    for (const file of coreFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source.toLowerCase(), file).not.toContain('"execution-os"');
      expect(source.toLowerCase(), file).not.toContain("'execution-os'");
    }
  });
});

function signBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
