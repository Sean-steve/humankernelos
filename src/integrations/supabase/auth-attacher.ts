import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (import.meta.env.VITE_DATABASE_PROVIDER === "postgres") {
      const userId =
        import.meta.env.VITE_LOCAL_USER_ID ??
        "00000000-0000-4000-8000-000000000001";
      return next({
        headers: { Authorization: `Bearer local:${userId}` },
      });
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
