-- Phase 0: ownership integrity
ALTER TABLE public.engine_signals
  ADD CONSTRAINT engine_signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.hos_events
  ADD CONSTRAINT hos_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.body_sessions
  ADD CONSTRAINT body_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.routine_completions
  ADD CONSTRAINT routine_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Phase 1: idempotency + backoff
CREATE UNIQUE INDEX IF NOT EXISTS hos_events_idempotency_uniq
  ON public.hos_events (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.hos_event_deliveries
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE TABLE public.event_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  description text,
  payload_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, schema_version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_schemas TO authenticated;
GRANT ALL ON public.event_schemas TO service_role;
ALTER TABLE public.event_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own event schemas" ON public.event_schemas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER event_schemas_set_updated_at BEFORE UPDATE ON public.event_schemas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 2: capability registry + invocation ledger
CREATE TABLE public.engine_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_engine_id text NOT NULL,
  capability text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  required_permission text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_engine_id, capability, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_capabilities TO authenticated;
GRANT ALL ON public.engine_capabilities TO service_role;
ALTER TABLE public.engine_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engine capabilities" ON public.engine_capabilities FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER engine_capabilities_set_updated_at BEFORE UPDATE ON public.engine_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.capability_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumer_engine_id text NOT NULL,
  provider_engine_id text NOT NULL,
  capability text NOT NULL,
  status text NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  error text,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.capability_invocations TO authenticated;
GRANT ALL ON public.capability_invocations TO service_role;
ALTER TABLE public.capability_invocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own invocations" ON public.capability_invocations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "write own invocations" ON public.capability_invocations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Phase 3: platform manager lifecycle + health + config
ALTER TABLE public.engines
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'ENABLED',
  ADD COLUMN IF NOT EXISTS platform_version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS sdk_version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'healthy';

UPDATE public.engines SET lifecycle_state = CASE WHEN status = 'active' THEN 'ENABLED' ELSE 'DISABLED' END;

CREATE TABLE public.engine_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  health text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.engine_health_events TO authenticated;
GRANT ALL ON public.engine_health_events TO service_role;
ALTER TABLE public.engine_health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own health events" ON public.engine_health_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "write own health events" ON public.engine_health_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.engine_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  key text NOT NULL,
  value text,
  is_secret_ref boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, engine_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_config TO authenticated;
GRANT ALL ON public.engine_config TO service_role;
ALTER TABLE public.engine_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engine config" ON public.engine_config FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER engine_config_set_updated_at BEFORE UPDATE ON public.engine_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 4: SDK scoped storage + logs
CREATE TABLE public.engine_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, engine_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_storage TO authenticated;
GRANT ALL ON public.engine_storage TO service_role;
ALTER TABLE public.engine_storage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engine storage" ON public.engine_storage FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER engine_storage_set_updated_at BEFORE UPDATE ON public.engine_storage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.engine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.engine_logs TO authenticated;
GRANT ALL ON public.engine_logs TO service_role;
ALTER TABLE public.engine_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own engine logs" ON public.engine_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "write own engine logs" ON public.engine_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);