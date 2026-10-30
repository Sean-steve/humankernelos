import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlatformObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getPlatformObservabilitySnapshot } = await import(
      "./observability.server"
    );
    return getPlatformObservabilitySnapshot(context.supabase, context.userId);
  });
