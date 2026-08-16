import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InvokeInput = z.object({
  consumer_engine_id: z.string().min(1).max(64),
  capability: z.string().min(1).max(64),
  version: z.string().max(20).optional(),
  input: z.unknown().optional(),
  correlation_id: z.string().uuid().optional(),
});

export const listCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { CAPABILITIES, capabilitySeeds } = await import("./capabilities.server");
    const [{ data: registered }, { data: invocations }] = await Promise.all([
      context.supabase
        .from("engine_capabilities")
        .select("provider_engine_id, capability, version, required_permission, status, updated_at"),
      context.supabase
        .from("capability_invocations")
        .select("consumer_engine_id, provider_engine_id, capability, status, duration_ms, error, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    return {
      declared: CAPABILITIES.map((c) => ({
        id: c.id,
        provider_engine_id: c.provider_engine_id,
        capability: c.capability,
        version: c.version,
        description: c.description,
        required_permission: c.required_permission,
        status: c.status,
      })),
      registered: registered ?? [],
      seeds: capabilitySeeds(),
      invocations: invocations ?? [],
    };
  });

/** Sync the declared capability registry into the user's catalogue. */
export const syncCapabilityRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { capabilitySeeds } = await import("./capabilities.server");
    const rows = capabilitySeeds().map((s) => ({ ...s, user_id: context.userId }));
    const { error } = await context.supabase
      .from("engine_capabilities")
      .upsert(rows, { onConflict: "user_id,provider_engine_id,capability,version" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const invoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InvokeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { invokeCapability } = await import("./capabilities.server");
    const result = await invokeCapability(context.supabase, context.userId, {
      consumer_engine_id: data.consumer_engine_id,
      capability: data.capability,
      ...(data.version ? { version: data.version } : {}),
      input: data.input ?? {},
      ...(data.correlation_id ? { correlation_id: data.correlation_id } : {}),
    });
    return { ok: true, ...result };
  });
