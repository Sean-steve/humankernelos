import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProductionCertification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getProductionCertificationSnapshot } = await import(
      "./production-certification.server"
    );
    return getProductionCertificationSnapshot(
      context.supabase,
      context.userId,
    );
  });
