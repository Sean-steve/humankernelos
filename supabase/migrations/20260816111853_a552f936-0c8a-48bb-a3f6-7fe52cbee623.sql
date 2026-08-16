CREATE TABLE public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  endpoint text NOT NULL,
  status integer NOT NULL DEFAULT 200,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key, endpoint)
);
GRANT SELECT, INSERT ON public.api_idempotency_keys TO authenticated;
GRANT ALL ON public.api_idempotency_keys TO service_role;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own idempotency keys" ON public.api_idempotency_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "write own idempotency keys" ON public.api_idempotency_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.api_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  method text NOT NULL,
  path text NOT NULL,
  status integer NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.api_request_log TO authenticated;
GRANT ALL ON public.api_request_log TO service_role;
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own api log" ON public.api_request_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "write own api log" ON public.api_request_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  auth_type text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'disconnected',
  supported_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  health text NOT NULL DEFAULT 'unknown',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connectors TO authenticated;
GRANT ALL ON public.connectors TO service_role;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connectors" ON public.connectors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER connectors_set_updated_at BEFORE UPDATE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.connector_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text NOT NULL DEFAULT 'default',
  secret_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connector_credentials TO authenticated;
GRANT ALL ON public.connector_credentials TO service_role;
ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connector credentials" ON public.connector_credentials FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER connector_credentials_set_updated_at BEFORE UPDATE ON public.connector_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  status text NOT NULL DEFAULT 'running',
  records integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.integration_sync_runs TO authenticated;
GRANT ALL ON public.integration_sync_runs TO service_role;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync runs" ON public.integration_sync_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own webhook deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);