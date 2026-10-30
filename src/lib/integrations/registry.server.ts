import type { Db } from "../permissions.server";

export type ConnectorHealth = {
  status: "healthy" | "degraded" | "unavailable";
  detail?: string;
};

export type ConnectorSyncResult = {
  records: number;
  cursor?: string | null;
};

export type ConnectorWebhookResult = {
  external_id?: string | null;
  normalized: Record<string, unknown>;
};

export type ConnectorAdapter = {
  provider: string;
  version: string;
  supported_operations: string[];
  health: () => Promise<ConnectorHealth>;
  sync: (context: {
    db: Db;
    userId: string;
    direction: "inbound" | "outbound";
  }) => Promise<ConnectorSyncResult>;
  verifyWebhook?: (request: {
    headers: Headers;
    body: string;
  }) => Promise<boolean> | boolean;
  normalizeWebhook?: (request: {
    headers: Headers;
    body: string;
  }) => Promise<ConnectorWebhookResult> | ConnectorWebhookResult;
};

const adapters = new Map<string, ConnectorAdapter>();

export class ConnectorRuntimeError extends Error {
  constructor(
    message: string,
    public code:
      | "connector_not_configured"
      | "connector_disconnected"
      | "adapter_unavailable"
      | "signature_invalid"
      | "normalizer_unavailable"
      | "sync_failed",
  ) {
    super(message);
    this.name = "ConnectorRuntimeError";
  }
}

export function registerConnectorAdapter(adapter: ConnectorAdapter) {
  adapters.set(adapter.provider, adapter);
  return adapter;
}

export function resolveConnectorAdapter(provider: string) {
  return adapters.get(provider);
}

export function listConnectorAdapters() {
  return Array.from(adapters.values());
}

export async function runConnectorSync(
  db: Db,
  userId: string,
  provider: string,
  direction: "inbound" | "outbound" = "inbound",
) {
  const { data: connector, error: connectorError } = await db
    .from("connectors")
    .select("provider, status")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (connectorError) throw new ConnectorRuntimeError(connectorError.message, "sync_failed");
  if (!connector) {
    throw new ConnectorRuntimeError(
      `Connector "${provider}" is not configured.`,
      "connector_not_configured",
    );
  }
  if (connector.status !== "connected") {
    throw new ConnectorRuntimeError(
      `Connector "${provider}" is not connected.`,
      "connector_disconnected",
    );
  }

  const adapter = resolveConnectorAdapter(provider);
  if (!adapter) {
    throw new ConnectorRuntimeError(
      `No runtime adapter is loaded for connector "${provider}".`,
      "adapter_unavailable",
    );
  }

  const { data: run, error: runError } = await db
    .from("integration_sync_runs")
    .insert({
      user_id: userId,
      provider,
      direction,
      status: "running",
    })
    .select("id")
    .single();
  if (runError) throw new ConnectorRuntimeError(runError.message, "sync_failed");

  try {
    const result = await adapter.sync({ db, userId, direction });
    const now = new Date().toISOString();

    await Promise.all([
      db
        .from("integration_sync_runs")
        .update({
          status: "succeeded",
          records: result.records,
          finished_at: now,
          error: null,
        })
        .eq("id", run.id)
        .eq("user_id", userId),
      db
        .from("connectors")
        .update({
          health: "healthy",
          last_sync_at: now,
          last_error: null,
        })
        .eq("user_id", userId)
        .eq("provider", provider),
    ]);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();

    await Promise.all([
      db
        .from("integration_sync_runs")
        .update({
          status: "failed",
          error: message,
          finished_at: now,
        })
        .eq("id", run.id)
        .eq("user_id", userId),
      db
        .from("connectors")
        .update({
          health: "degraded",
          last_error: message,
        })
        .eq("user_id", userId)
        .eq("provider", provider),
    ]);

    throw new ConnectorRuntimeError(
      `Connector "${provider}" sync failed.`,
      "sync_failed",
    );
  }
}

export async function processConnectorWebhook(
  provider: string,
  request: { headers: Headers; body: string },
) {
  const adapter = resolveConnectorAdapter(provider);
  if (!adapter) {
    throw new ConnectorRuntimeError(
      `No runtime adapter is loaded for connector "${provider}".`,
      "adapter_unavailable",
    );
  }
  if (!adapter.verifyWebhook) {
    throw new ConnectorRuntimeError(
      `Connector "${provider}" does not expose webhook verification.`,
      "signature_invalid",
    );
  }

  const valid = await adapter.verifyWebhook(request);
  if (!valid) {
    throw new ConnectorRuntimeError("Webhook signature is invalid.", "signature_invalid");
  }
  if (!adapter.normalizeWebhook) {
    throw new ConnectorRuntimeError(
      `Connector "${provider}" has no inbound normalizer.`,
      "normalizer_unavailable",
    );
  }

  return adapter.normalizeWebhook(request);
}

export function resetConnectorRegistryForTests() {
  adapters.clear();
}
