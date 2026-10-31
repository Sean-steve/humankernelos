import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "../permissions.server";

export type RemoteHosIdentity = {
  subjectId: string;
  tenantId: string;
  permissions: string[];
  consentScopes: string[];
  issuedAt: string;
};

function normalize(items: string[]) {
  return [...new Set(items.map((value) => value.trim()).filter(Boolean))].sort();
}

export function canonicalHosIdentityPayload(assertion: RemoteHosIdentity) {
  return [
    assertion.subjectId,
    assertion.tenantId,
    normalize(assertion.permissions).join(","),
    normalize(assertion.consentScopes).join(","),
    assertion.issuedAt,
  ].join("|");
}

export function signHosIdentityAssertion(
  assertion: RemoteHosIdentity,
  secret: string,
) {
  if (secret.trim().length < 32) {
    throw new Error("HOS external-engine shared secret must be at least 32 characters.");
  }
  return createHmac("sha256", secret)
    .update(canonicalHosIdentityPayload(assertion))
    .digest("hex");
}

export function verifyHmacBody(body: string, signature: string, secret: string) {
  if (!signature || secret.trim().length < 32) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(signature, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

async function engineConfig(db: Db, userId: string, engineId: string) {
  const { data, error } = await db
    .from("engine_config")
    .select("key, value, is_secret_ref")
    .eq("user_id", userId)
    .eq("engine_id", engineId);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.key, row]));
}

export async function remoteEngineBaseUrl(
  db: Db,
  userId: string,
  engineId: string,
  envFallback?: string,
) {
  const config = await engineConfig(db, userId, engineId);
  const configured = config.get("base_url")?.value?.trim();
  const base = configured || envFallback?.trim();
  if (!base) {
    throw new Error(
      `External engine "${engineId}" has no base URL. Configure engine_config.base_url or its environment fallback.`,
    );
  }
  return base.replace(/\/+$/, "");
}

export async function grantedEngineScopes(
  db: Db,
  userId: string,
  engineId: string,
) {
  const { data, error } = await db
    .from("engine_permissions")
    .select("scope, granted")
    .eq("user_id", userId)
    .eq("engine_id", engineId)
    .eq("granted", true);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.scope));
}

export type RemoteHosRequestOptions = {
  db: Db;
  userId: string;
  engineId: string;
  baseUrl: string;
  sharedSecret: string;
  tenantId?: string;
  permissions: string[];
  consentScopes: string[];
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  requestId?: string;
  fetchImpl?: typeof fetch;
};

export async function remoteHosRequest(options: RemoteHosRequestOptions) {
  const {
    db,
    userId,
    engineId,
    baseUrl,
    sharedSecret,
    permissions,
    consentScopes,
    path,
    body,
    idempotencyKey,
    requestId,
  } = options;

  const granted = await grantedEngineScopes(db, userId, engineId);
  for (const permission of permissions) {
    if (!granted.has(permission)) {
      throw new Error(`Consent/permission "${permission}" has not been granted to ${engineId}.`);
    }
  }
  for (const scope of consentScopes) {
    if (!granted.has(scope)) {
      throw new Error(`Consent/permission "${scope}" has not been granted to ${engineId}.`);
    }
  }

  const assertion: RemoteHosIdentity = {
    subjectId: userId,
    tenantId: options.tenantId || "personal-hos",
    permissions,
    consentScopes,
    issuedAt: new Date().toISOString(),
  };
  const signature = signHosIdentityAssertion(assertion, sharedSecret);
  const headers = new Headers({
    "content-type": "application/json",
    "x-hos-subject": assertion.subjectId,
    "x-hos-tenant": assertion.tenantId,
    "x-hos-permissions": normalize(assertion.permissions).join(","),
    "x-hos-consent": normalize(assertion.consentScopes).join(","),
    "x-hos-issued-at": assertion.issuedAt,
    "x-hos-signature": signature,
  });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (requestId) headers.set("x-request-id", requestId);

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `HTTP ${response.status}`;
    throw new Error(`Remote engine "${engineId}" rejected ${path}: ${message}`);
  }

  return payload as any;
}
