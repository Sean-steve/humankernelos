import { afterEach, describe, expect, it } from "vitest";
import {
  ConnectorRuntimeError,
  processConnectorWebhook,
  registerConnectorAdapter,
  resetConnectorRegistryForTests,
  resolveConnectorAdapter,
} from "../integrations/registry.server";
import { handlePlatformProbe } from "../api/platform-api.server";

afterEach(() => resetConnectorRegistryForTests());

describe("Integration Mesh runtime registry", () => {
  it("registers connector adapters without core provider branches", () => {
    registerConnectorAdapter({
      provider: "example",
      version: "1.0.0",
      supported_operations: ["sync"],
      health: async () => ({ status: "healthy" }),
      sync: async () => ({ records: 0 }),
    });

    expect(resolveConnectorAdapter("example")?.version).toBe("1.0.0");
  });

  it("fails closed when a webhook adapter is unavailable", async () => {
    await expect(
      processConnectorWebhook("missing", {
        headers: new Headers(),
        body: "{}",
      }),
    ).rejects.toMatchObject({
      code: "adapter_unavailable",
    });
  });

  it("requires signature verification before normalization", async () => {
    registerConnectorAdapter({
      provider: "signed",
      version: "1.0.0",
      supported_operations: ["webhook"],
      health: async () => ({ status: "healthy" }),
      sync: async () => ({ records: 0 }),
      verifyWebhook: () => false,
      normalizeWebhook: () => ({ normalized: { ok: true } }),
    });

    await expect(
      processConnectorWebhook("signed", {
        headers: new Headers(),
        body: "{}",
      }),
    ).rejects.toMatchObject({
      code: "signature_invalid",
    });
  });
});

describe("Platform API probes", () => {
  it("returns a versioned health envelope", async () => {
    const response = handlePlatformProbe(
      new Request("https://hos.example/api/v1/health"),
    );
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const body = (await response!.json()) as {
      success: boolean;
      data: { service: string; status: string; platform_version: string };
      meta: { request_id: string; timestamp: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.service).toBe("humankernelos");
    expect(body.data.status).toBe("ok");
    expect(body.data.platform_version).toBeTruthy();
    expect(body.meta.request_id).toBeTruthy();
  });

  it("does not intercept unrelated application routes", () => {
    expect(
      handlePlatformProbe(new Request("https://hos.example/")),
    ).toBeNull();
  });
});
