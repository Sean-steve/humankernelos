import { describe, expect, it } from "vitest";
import { engineIsActive, scopeAllowed, type Db } from "../permissions.server";

function stubDb(
  tables: Record<string, Record<string, unknown> | null>,
) {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: tables[table] ?? null,
          error: null,
        }),
        insert: async () => ({ error: null }),
      };
      return builder;
    },
  } as unknown as Db;
}

describe("consent resolution", () => {
  it("honours an explicit grant", async () => {
    expect(
      await scopeAllowed(
        stubDb({ engine_permissions: { granted: true } }),
        "u",
        "nutrition",
        "check_ins",
      ),
    ).toBe(true);
  });

  it("honours an explicit revocation, even for kernel engines", async () => {
    expect(
      await scopeAllowed(
        stubDb({
          engine_permissions: { granted: false },
          engines: { owner: "HOS Kernel" },
        }),
        "u",
        "orchestrator",
        "engine_signals",
      ),
    ).toBe(false);
  });

  it("denies an undecided third-party engine by default", async () => {
    expect(
      await scopeAllowed(
        stubDb({
          engine_permissions: null,
          engines: { owner: "External Provider" },
        }),
        "u",
        "external",
        "human_states",
      ),
    ).toBe(false);
  });

  it("allows an undecided persisted kernel-owned engine", async () => {
    expect(
      await scopeAllowed(
        stubDb({
          engine_permissions: null,
          engines: { owner: "HOS Kernel" },
        }),
        "u",
        "orchestrator",
        "engine_signals",
      ),
    ).toBe(true);
  });
});

describe("engine lifecycle gate", () => {
  it("blocks an inactive engine", async () => {
    expect(
      await engineIsActive(
        stubDb({
          engines: { status: "inactive", lifecycle_state: "DISABLED" },
        }),
        "u",
        "nutrition",
      ),
    ).toBe(false);
  });

  it("allows an installed engine only in an operational lifecycle state", async () => {
    expect(
      await engineIsActive(
        stubDb({
          engines: { status: "active", lifecycle_state: "ENABLED" },
        }),
        "u",
        "nutrition",
      ),
    ).toBe(true);
  });

  it("blocks suspended engines even if their legacy status is active", async () => {
    expect(
      await engineIsActive(
        stubDb({
          engines: { status: "active", lifecycle_state: "SUSPENDED" },
        }),
        "u",
        "nutrition",
      ),
    ).toBe(false);
  });

  it("fails closed when an engine is not installed", async () => {
    expect(await engineIsActive(stubDb({ engines: null }), "u", "nutrition")).toBe(false);
  });
});
