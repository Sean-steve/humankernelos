import { describe, expect, it } from "vitest";
import {
  productionConfigReady,
  validateOperationalProof,
  validateProductionEnvironment,
} from "../production.server";
import {
  applySecurityHeaders,
  securityHeaderNames,
} from "../http-security.server";
import {
  DEFAULT_EXTERNAL_INGRESS_MAX_BYTES,
  readBoundedRequestBody,
  sha256Hex,
} from "../external-engines/ingress-security.server";

describe("Phase 6 production certification", () => {
  it("fails closed when critical production configuration is missing", () => {
    const checks = validateProductionEnvironment({
      NODE_ENV: "production",
    });
    expect(productionConfigReady(checks)).toBe(false);
    expect(
      checks.filter((check) => check.critical && !check.ok).length,
    ).toBeGreaterThan(0);
  });

  it("accepts modern secret-key production configuration and required Execution OS", () => {
    const checks = validateProductionEnvironment({
      NODE_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_abcdefghijklmnopqrstuvwxyz",
      HOS_REQUIRE_EXECUTION_OS: "true",
      EXECUTION_OS_BASE_URL: "https://execution.example.com",
      HOS_EXECUTION_SHARED_SECRET:
        "phase-6-shared-secret-at-least-32-characters",
    });
    expect(productionConfigReady(checks)).toBe(true);
  });

  it("requires recent backup and restore-drill evidence", () => {
    const now = new Date("2026-10-31T12:00:00.000Z").getTime();
    const stale = validateOperationalProof(
      {
        HOS_BACKUP_VERIFIED_AT: "2026-08-01T00:00:00.000Z",
        HOS_RESTORE_DRILL_VERIFIED_AT: "2026-01-01T00:00:00.000Z",
      },
      now,
    );
    expect(stale.every((proof) => !proof.ok)).toBe(true);

    const fresh = validateOperationalProof(
      {
        HOS_BACKUP_VERIFIED_AT: "2026-10-25T00:00:00.000Z",
        HOS_RESTORE_DRILL_VERIFIED_AT: "2026-10-01T00:00:00.000Z",
      },
      now,
    );
    expect(fresh.every((proof) => proof.ok)).toBe(true);
  });

  it("applies baseline browser security headers to server responses", () => {
    const request = new Request("https://hos.example.com/");
    const response = applySecurityHeaders(
      request,
      new Response("ok", { status: 200 }),
    );

    for (const header of securityHeaderNames()) {
      expect(response.headers.get(header)).toBeTruthy();
    }
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("rejects oversized external-engine request bodies before processing", async () => {
    const request = new Request(
      "https://hos.example.com/api/v1/external-engines/execution-os/events",
      {
        method: "POST",
        headers: {
          "content-length": String(DEFAULT_EXTERNAL_INGRESS_MAX_BYTES + 1),
        },
        body: "{}",
      },
    );

    await expect(readBoundedRequestBody(request)).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
  });

  it("uses deterministic body hashes for durable replay detection", () => {
    expect(sha256Hex('{"a":1}')).toBe(sha256Hex('{"a":1}'));
    expect(sha256Hex('{"a":1}')).not.toBe(sha256Hex('{"a":2}'));
  });
});
