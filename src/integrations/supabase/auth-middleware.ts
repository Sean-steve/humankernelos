import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "./types";
import { createPostgresDb } from "@/integrations/postgres/client.server";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: Record<string, unknown>;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function localUserIdFromRequest(request: Request | undefined) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Local development auth is disabled in production. Configure a production identity provider before using DATABASE_PROVIDER=postgres in production.",
    );
  }

  const configured =
    process.env.LOCAL_USER_ID ?? "00000000-0000-4000-8000-000000000001";
  const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (token?.startsWith("local:")) {
    const asserted = token.slice("local:".length);
    if (asserted !== configured) {
      throw new Error("Unauthorized: local user assertion does not match LOCAL_USER_ID");
    }
  }

  return configured;
}

/**
 * Historical name retained so existing server functions do not need a rewrite.
 * It now resolves either the plain PostgreSQL development runtime or Supabase.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const provider = (process.env.DATABASE_PROVIDER ?? "supabase").toLowerCase();
    let context: AuthContext;

    if (provider === "postgres") {
      const userId = localUserIdFromRequest(request);
      context = {
        supabase: createPostgresDb(userId) as unknown as SupabaseClient<Database>,
        userId,
        claims: {
          sub: userId,
          email: process.env.LOCAL_USER_EMAIL ?? "local@humankernelos.test",
          provider: "local-postgres",
        },
      };
    } else {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
        const missing = [
          ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
          ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
        ];
        throw new Error(
          `Missing Supabase environment variable(s): ${missing.join(", ")}.`,
        );
      }

      if (!request?.headers) {
        throw new Error("Unauthorized: No request headers available");
      }

      const authHeader = request.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw new Error("Unauthorized: Bearer token required");
      }

      const token = authHeader.replace("Bearer ", "");
      if (!token || token.split(".").length !== 3) {
        throw new Error("Unauthorized: Invalid token");
      }

      const supabase = createClient<Database>(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          global: {
            fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims?.sub) {
        throw new Error("Unauthorized: Invalid token");
      }

      context = {
        supabase,
        userId: data.claims.sub,
        claims: data.claims as unknown as Record<string, unknown>,
      };
    }

    return next({ context });
  },
);
