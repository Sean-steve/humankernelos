import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_USER_ID =
  import.meta.env.VITE_LOCAL_USER_ID ??
  "00000000-0000-4000-8000-000000000001";
const LOCAL_USER_EMAIL =
  import.meta.env.VITE_LOCAL_USER_EMAIL ?? "local@humankernelos.test";

function localSession(): Session {
  return {
    access_token: `local:${LOCAL_USER_ID}`,
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    refresh_token: "local-development",
    user: {
      id: LOCAL_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: LOCAL_USER_EMAIL,
      app_metadata: { provider: "local-postgres" },
      user_metadata: { name: "Local Operator" },
      identities: [],
      created_at: new Date(0).toISOString(),
    },
  } as Session;
}

export function useSession() {
  const localMode = import.meta.env.VITE_DATABASE_PROVIDER === "postgres";
  const local = useMemo(() => (localMode ? localSession() : null), [localMode]);
  const [session, setSession] = useState<Session | null>(local);
  const [loading, setLoading] = useState(!localMode);

  useEffect(() => {
    if (localMode) {
      setSession(local);
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [localMode, local]);

  return { session, loading, user: session?.user ?? null };
}
