import { describe, expect, it } from "vitest";
import {
  canTransition,
  deriveHealth,
  resolveDependencies,
  statusForState,
} from "../platform-manager.server";
import {
  versionCompatible,
  CAPABILITIES,
  findCapability,
} from "../capabilities.server";
import { validateEvent, EventSchemaError } from "../events/schemas";
import { backoffFor } from "../mesh.server";
import { REGISTERED_ENGINES } from "../engines/contract";
import { validateEngineManifest } from "../engines/manifest";

describe("lifecycle state machine", () => {
  it("allows only declared transitions", () => {
    expect(canTransition("ENABLED", "SUSPENDED")).toBe(true);
    expect(canTransition("DISCOVERED", "ENABLED")).toBe(false);
    expect(canTransition("UNINSTALLED", "ENABLED")).toBe(false);
  });

  it("requires revalidation before a disabled engine can be enabled", () => {
    expect(canTransition("DISABLED", "ENABLED")).toBe(false);
    expect(canTransition("DISABLED", "VALIDATED")).toBe(true);
    expect(canTransition("VALIDATED", "ENABLED")).toBe(true);
  });

  it("maps lifecycle state to the legacy status column", () => {
    expect(statusForState("RUNNING")).toBe("active");
    expect(statusForState("SUSPENDED")).toBe("inactive");
    expect(statusForState("UNINSTALLED")).toBe("deprecated");
  });
});

describe("health derivation", () => {
  const base = {
    lifecycle_state: "ENABLED" as const,
    last_heartbeat_at: null,
    error_count: 0,
    last_error: null,
  };

  it("is disabled when not operational", () => {
    expect(deriveHealth({ ...base, lifecycle_state: "DISABLED" })).toBe("disabled");
  });

  it("degrades on errors and fails on many", () => {
    expect(deriveHealth({ ...base, error_count: 2 })).toBe("degraded");
    expect(deriveHealth({ ...base, error_count: 12 })).toBe("failed");
  });

  it("is unresponsive after a stale heartbeat", () => {
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
    expect(deriveHealth({ ...base, last_heartbeat_at: stale })).toBe("unresponsive");
  });

  it("is healthy with a fresh heartbeat and no errors", () => {
    expect(deriveHealth({ ...base, last_heartbeat_at: new Date().toISOString() })).toBe(
      "healthy",
    );
  });
});

describe("dependency resolution", () => {
  it("accepts engines when every declared dependency is actually installed", () => {
    for (const e of REGISTERED_ENGINES) {
      expect(
        resolveDependencies(
          e,
          REGISTERED_ENGINES.map((x) => x.id),
        ).ok,
      ).toBe(true);
    }
  });

  it("rejects a catalogue dependency that is not installed", () => {
    const fake = { ...REGISTERED_ENGINES[0]!, dependencies: ["ghost"] };
    expect(resolveDependencies(fake, []).ok).toBe(false);
  });
});

describe("engine manifest contract", () => {
  it("accepts a valid external engine manifest", () => {
    const manifest = validateEngineManifest({
      id: "example-engine",
      name: "Example Engine",
      version: "1.0.0",
      purpose: "Conformance test engine",
      owner: "External",
      status: "inactive",
      capabilities: ["example.read"],
      dataOwned: ["example_records"],
      eventsPublished: ["ExampleRecorded"],
      eventsConsumed: [],
      publishedSignals: ["example.signal"],
      requiredSignals: [],
      dependencies: [],
      permissions: {
        dataRequested: [],
        dataProvided: ["example.signal"],
        dataProhibited: ["finance.transactions"],
      },
    });
    expect(manifest.id).toBe("example-engine");
  });

  it("rejects self-dependency", () => {
    expect(() =>
      validateEngineManifest({
        id: "example-engine",
        name: "Example Engine",
        version: "1.0.0",
        purpose: "Conformance test engine",
        owner: "External",
        status: "inactive",
        capabilities: [],
        dataOwned: [],
        eventsPublished: [],
        eventsConsumed: [],
        publishedSignals: [],
        requiredSignals: [],
        dependencies: ["example-engine"],
        permissions: {
          dataRequested: [],
          dataProvided: [],
          dataProhibited: [],
        },
      }),
    ).toThrow();
  });
});

describe("capability runtime", () => {
  it("bootstraps built-in capabilities through the runtime registry", () => {
    const ids = new Set(REGISTERED_ENGINES.map((e) => e.id));
    for (const c of CAPABILITIES) {
      expect(ids.has(c.provider_engine_id)).toBe(true);
      expect(
        findCapability(c.provider_engine_id, c.capability, c.version),
      ).toBeDefined();
    }
  });

  it("enforces semver-major compatibility", () => {
    expect(versionCompatible("1.0.0", "1.2.0")).toBe(true);
    expect(versionCompatible("1.3.0", "1.2.0")).toBe(false);
    expect(versionCompatible("2.0.0", "1.0.0")).toBe(false);
  });
});

describe("event schema catalogue", () => {
  it("rejects unknown built-in event types", () => {
    expect(() => validateEvent("NotAThing", {})).toThrow(EventSchemaError);
  });

  it("rejects a bad payload", () => {
    expect(() => validateEvent("CheckInSubmitted", { energy: 500 })).toThrow(
      EventSchemaError,
    );
  });

  it("accepts a valid payload", () => {
    expect(validateEvent("MealLogged", { kcal: 600 })).toEqual({ kcal: 600 });
  });

  it("rejects a mismatched schema version", () => {
    expect(() => validateEvent("MealLogged", {}, 7)).toThrow(EventSchemaError);
  });
});

describe("retry backoff", () => {
  it("increases with attempts", () => {
    expect(backoffFor(0)).toBeLessThan(backoffFor(1));
    expect(backoffFor(1)).toBeLessThan(backoffFor(2));
  });
});
