import { describe, expect, it } from "vitest";
import { engineIsActive, scopeAllowed, type Db } from "../permissions.server";

/** Minimal chainable stub of the supabase query builder paths we use. */
function stubDb(rows: Record<string, unknown> | null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: rows, error: null }),
    insert: async () => ({ error: null }),
  };
  return { from: () => builder } as unknown as Db;
}

describe("consent resolution", () => {
  it("honours an explicit grant", async () => {
    expect(await scopeAllowed(stubDb({ granted: true }), "u", "nutrition", "check_ins")).toBe(true);
  });

  it("honours an explicit revocation, even for kernel engines", async () => {
    expect(await scopeAllowed(stubDb({ granted: false }), "u", "orchestrator", "engine_signals")).toBe(
      false,
    );
  });

  it("denies an undecided third-party engine by default", async () => {
    expect(await scopeAllowed(stubDb(null), "u", "nutrition", "check_ins")).toBe(false);
  });

  it("allows an undecided kernel-owned engine", async () => {
    expect(await scopeAllowed(stubDb(null), "u", "orchestrator", "engine_signals")).toBe(true);
  });
});

describe("engine lifecycle gate", () => {
  it("blocks a deactivated engine", async () => {
    expect(await engineIsActive(stubDb({ status: "inactive" }), "u", "nutrition")).toBe(false);
  });

  it("allows an active engine", async () => {
    expect(await engineIsActive(stubDb({ status: "active" }), "u", "nutrition")).toBe(true);
  });

  it("falls back to the declared contract status when not installed", async () => {
    expect(await engineIsActive(stubDb(null), "u", "nutrition")).toBe(true);
  });
});
