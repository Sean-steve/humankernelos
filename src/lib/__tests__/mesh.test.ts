import { describe, expect, it } from "vitest";
import {
  EVENT_HANDLERS,
  MAX_ATTEMPTS,
  resolveEventHandler,
  subscriptionSeeds,
} from "../mesh.server";
import { REGISTERED_ENGINES } from "../engines/contract";

describe("event mesh subscriptions", () => {
  it("declares at least one handler per subscribed event type", () => {
    for (const [type, handlers] of Object.entries(EVENT_HANDLERS)) {
      expect(handlers.length, `${type} has no handler`).toBeGreaterThan(0);
    }
  });

  it("only routes to engines that exist in the registry", () => {
    const ids = new Set(REGISTERED_ENGINES.map((e) => e.id));
    for (const seed of subscriptionSeeds()) {
      expect(ids.has(seed.engine_id), `unknown engine ${seed.engine_id}`).toBe(true);
    }
  });

  it("produces unique engine/handler pairs per event type", () => {
    const keys = subscriptionSeeds().map(
      (s) => `${s.event_type}:${s.engine_id}:${s.handler}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("resolves declared handlers through the runtime registry", () => {
    for (const seed of subscriptionSeeds()) {
      expect(
        resolveEventHandler(seed.event_type, seed.engine_id, seed.handler),
      ).toBeDefined();
    }
  });

  it("bounds retries", () => {
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(5);
  });

  it("covers every event any engine declares as consumed", () => {
    const consumed = new Set(REGISTERED_ENGINES.flatMap((e) => e.eventsConsumed));
    const routed = new Set(Object.keys(EVENT_HANDLERS));
    for (const type of consumed) {
      expect(routed.has(type), `${type} is consumed but never dispatched`).toBe(true);
    }
  });
});
