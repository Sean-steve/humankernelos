import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { publishAndDispatch } from "../mesh.server";
import { registerExternalEngineIngress } from "./ingress.server";
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

function serviceDb() {
  const url = process.env.SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      "Execution OS event ingress requires SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient<Database>(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

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
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get("x-execution-os-signature") ?? "";
    if (!verifyHmacBody(body, signature, sharedSecret())) {
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const envelope = ExecutionEnvelope.parse(JSON.parse(body));
    const db = serviceDb();

    const { data: configuredTenant, error: tenantError } = await db
      .from("engine_config")
      .select("value")
      .eq("user_id", envelope.subjectId)
      .eq("engine_id", "execution-os")
      .eq("key", "tenant_id")
      .maybeSingle();
    if (tenantError) throw new Error(tenantError.message);
    if (
      configuredTenant?.value &&
      configuredTenant.value !== envelope.tenantId
    ) {
      return new Response(JSON.stringify({ error: "tenant_mismatch" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
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

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: result.event_id,
        deduped: result.deduped,
        deliveries: result.deliveries,
      }),
      {
        status: result.deduped ? 200 : 202,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Execution OS ingress]", error);
    return new Response(
      JSON.stringify({ error: "ingress_failed", message }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

registerExternalEngineIngress(
  "/api/v1/external-engines/execution-os/events",
  handleExecutionOsEventIngress,
);
