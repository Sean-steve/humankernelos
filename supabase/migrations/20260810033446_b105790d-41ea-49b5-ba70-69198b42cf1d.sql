CREATE TABLE public.engine_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  scope text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, engine_id, scope)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_permissions TO authenticated;
GRANT ALL ON public.engine_permissions TO service_role;
ALTER TABLE public.engine_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engine permissions" ON public.engine_permissions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER engine_permissions_set_updated_at BEFORE UPDATE ON public.engine_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX audit_log_user_created_idx ON public.audit_log (user_id, created_at DESC);