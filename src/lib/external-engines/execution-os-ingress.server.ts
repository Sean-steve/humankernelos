import { z } from "zod";
import { publishAndDispatch } from "../mesh.server";
import { createProductionServiceDb } from "../production.server";
import { registerExternalEngineIngress } from "./ingress.server";
import {
  claimExternalIngressReceipt,
  IngressSecurityError,
  markExternalIngressReceipt,
  readBoundedRequestBody,
  sha256Hex,
} from "./ingress-security.server";
import { verifyHmacBody } from "./remote-engine.server";

const ExecutionEnvelope = z.object({
  id: z.string().min(1).max(240),
  type: z.string().min(1).max(128),
  version: z.string().min(1).max(16),
  occurredAt: z.string().datetime(),
  source: z.literal("execution-os"),
  subjectId: z.string().uuid(),
  tenantId: z.string().min(1).max(128),
  correlationId: z.string().max(240).optional(),
  causationId: z.string().max(240).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

function sharedSecret() {
  const value = process.env.HOS_EXECUTION_SHARED_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      "HOS_EXECUTION_SHARED_SECRET must be configured with at least 32 characters.",
    );
  }
  return value;
}

function isUuid(value?: string) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleExecutionOsEventIngress(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let receiptId: string | null = null;
  let db: ReturnType<typeof createProductionServiceDb> | null = null;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", request_id: requestId }),
      {
        status: 405,
        headers: {
          "content-type": "application/json",
          allow: "POST",
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    const body = await readBoundedRequestBody(request);
    const signature = request.headers.get("x-execution-os-signature") ?? "";
    if (!verifyHmacBody(body, signature, sharedSecret())) {
      throw new IngressSecurityError(
        401,
        "invalid_signature",
        "External engine signature validation failed.",
      );
    }

    const envelope = ExecutionEnvelope.parse(JSON.parse(body));
    db = createProductionServiceDb();

    const { data: configuredTenant, error: tenantError } = await db
      .from("engine_config")
      .select("value")
      .eq("user_id", envelope.subjectId)
      .eq("engine_id", "execution-os")
      .eq("key", "tenant_id")
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!configuredTenant?.value) {
      throw new IngressSecurityError(
        503,
        "engine_not_configured",
        "Execution OS tenant binding is not configured.",
      );
    }
    if (configuredTenant.value !== envelope.tenantId) {
      throw new IngressSecurityError(
        403,
        "tenant_mismatch",
        "Execution OS tenant assertion does not match HOS configuration.",
      );
    }

    const bodyHash = sha256Hex(body);
    const receipt = await claimExternalIngressReceipt(db, {
      userId: envelope.subjectId,
      provider: "execution-os",
      eventId: envelope.id,
      bodyHash,
      metadata: {
        body_sha256: bodyHash,
        event_type: envelope.type,
        occurred_at: envelope.occurredAt,
        tenant_id: envelope.tenantId,
        request_id: requestId,
      },
    });
    receiptId = receipt.receiptId;

    if (receipt.state === "duplicate_processed") {
      return new Response(
        JSON.stringify({
          ok: true,
          deduped: true,
          request_id: requestId,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        },
      );
    }

    const payload = {
      ...envelope.data,
      external_event_id: envelope.id,
      external_occurred_at: envelope.occurredAt,
      external_correlation_id: envelope.correlationId ?? null,
      external_causation_id: envelope.causationId ?? null,
      external_tenant_id: envelope.tenantId,
    };

    const result = await publishAndDispatch(db, envelope.subjectId, {
      type: envelope.type,
      source_engine: "execution-os",
      payload,
      idempotency_key: `execution-os:${envelope.id}`,
      schema_version: Number.parseInt(envelope.version.split(".")[0] || "1", 10),
      occurred_at: envelope.occurredAt,
      ...(isUuid(envelope.correlationId)
        ? { correlation_id: envelope.correlationId }
        : {}),
    });

    await markExternalIngressReceipt(db, receiptId, "processed");

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: result.event_id,
        deduped: result.deduped,
        deliveries: result.deliveries,
        request_id: requestId,
      }),
      {
        status: result.deduped ? 200 : 202,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const internalMessage =
      error instanceof Error ? error.message : String(error);
    if (db && receiptId) {
      try {
        await markExternalIngressReceipt(
          db,
          receiptId,
          "failed",
          internalMessage,
        );
      } catch (receiptError) {
        console.error("[Execution OS ingress receipt]", receiptError);
      }
    }

    const securityError =
      error instanceof IngressSecurityError ? error : null;
    const validationError = error instanceof z.ZodError;
    const status = securityError?.status ?? (validationError ? 400 : 503);
    const code =
      securityError?.code ??
      (validationError ? "invalid_envelope" : "ingress_unavailable");

    console.error("[Execution OS ingress]", {
      request_id: requestId,
      code,
      error,
    });

    return new Response(
      JSON.stringify({
        error: code,
        request_id: requestId,
      }),
      {
        status,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          ...(status === 429 ? { "retry-after": "60" } : {}),
        },
      },
    );
  }
}

registerExternalEngineIngress(
  "/api/v1/external-engines/execution-os/events",
  handleExecutionOsEventIngress,
);
