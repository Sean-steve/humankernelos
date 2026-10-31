import { createHash } from "node:crypto";
import type { Db } from "../permissions.server";

export class IngressSecurityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "IngressSecurityError";
  }
}

export const DEFAULT_EXTERNAL_INGRESS_MAX_BYTES = 256 * 1024;
export const DEFAULT_EXTERNAL_INGRESS_RATE_PER_MINUTE = 120;

function configuredPositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function externalIngressMaxBytes() {
  return configuredPositiveInt(
    process.env.HOS_EXTERNAL_INGRESS_MAX_BYTES,
    DEFAULT_EXTERNAL_INGRESS_MAX_BYTES,
    8 * 1024,
    2 * 1024 * 1024,
  );
}

export function externalIngressRatePerMinute() {
  return configuredPositiveInt(
    process.env.HOS_EXTERNAL_INGRESS_RATE_PER_MINUTE,
    DEFAULT_EXTERNAL_INGRESS_RATE_PER_MINUTE,
    10,
    1200,
  );
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes = externalIngressMaxBytes(),
) {
  const declared = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new IngressSecurityError(
      413,
      "payload_too_large",
      "External engine payload exceeds the configured maximum.",
    );
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new IngressSecurityError(
      413,
      "payload_too_large",
      "External engine payload exceeds the configured maximum.",
    );
  }
  return body;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

type ReceiptMetadata = {
  body_sha256: string;
  event_type: string;
  occurred_at: string;
  tenant_id: string;
  request_id: string;
};

function metadataHash(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>).body_sha256;
  return typeof value === "string" ? value : null;
}

export type IngressReceiptClaim =
  | { state: "new" | "retry"; receiptId: string }
  | { state: "duplicate_processed"; receiptId: string };

export async function claimExternalIngressReceipt(
  db: Db,
  input: {
    userId: string;
    provider: string;
    eventId: string;
    bodyHash: string;
    metadata: ReceiptMetadata;
  },
): Promise<IngressReceiptClaim> {
  const externalId = `${input.userId}:${input.eventId}`;

  const readExisting = async () => {
    const { data, error } = await db
      .from("webhook_deliveries")
      .select("id, status, payload")
      .eq("provider", input.provider)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const existing = await readExisting();
  if (existing) {
    if (metadataHash(existing.payload) !== input.bodyHash) {
      throw new IngressSecurityError(
        409,
        "replay_conflict",
        "The event ID was replayed with different content.",
      );
    }
    return existing.status === "processed"
      ? { state: "duplicate_processed", receiptId: existing.id }
      : { state: "retry", receiptId: existing.id };
  }

  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await db
    .from("webhook_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("provider", input.provider)
    .eq("user_id", input.userId)
    .gte("created_at", windowStart);
  if (countError) throw countError;

  if ((count ?? 0) >= externalIngressRatePerMinute()) {
    throw new IngressSecurityError(
      429,
      "rate_limited",
      "External engine ingress rate limit exceeded.",
    );
  }

  const { data, error } = await db
    .from("webhook_deliveries")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      external_id: externalId,
      signature_valid: true,
      status: "received",
      payload: input.metadata,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const raced = await readExisting();
    if (!raced) throw error;
    if (metadataHash(raced.payload) !== input.bodyHash) {
      throw new IngressSecurityError(
        409,
        "replay_conflict",
        "The event ID was concurrently replayed with different content.",
      );
    }
    return raced.status === "processed"
      ? { state: "duplicate_processed", receiptId: raced.id }
      : { state: "retry", receiptId: raced.id };
  }
  if (error) throw error;
  return { state: "new", receiptId: data.id };
}

export async function markExternalIngressReceipt(
  db: Db,
  receiptId: string,
  status: "processed" | "failed",
  errorMessage?: string,
) {
  const { error } = await db
    .from("webhook_deliveries")
    .update({
      status,
      error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
    .eq("id", receiptId);
  if (error) throw error;
}
