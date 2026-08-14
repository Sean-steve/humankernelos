-- Event Mesh hardening on the existing append-only event log
ALTER TABLE public.hos_events
  ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS hos_events_idempotency_uniq
  ON public.hos_events (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS hos_events_correlation_idx
  ON public.hos_events (user_id, correlation_id);

-- Per-engine delivery ledger (attempts, failures, dead-letter)
CREATE TABLE IF NOT EXISTS public.hos_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.hos_events(id) ON DELETE CASCADE,
  correlation_id uuid,
  engine_id text NOT NULL,
  handler text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  dead_letter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, engine_id, handler)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hos_event_deliveries TO authenticated;
GRANT ALL ON public.hos_event_deliveries TO service_role;

ALTER TABLE public.hos_event_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own event deliveries"
  ON public.hos_event_deliveries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS hos_event_deliveries_user_created_idx
  ON public.hos_event_deliveries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hos_event_deliveries_dlq_idx
  ON public.hos_event_deliveries (user_id, dead_letter)
  WHERE dead_letter;

CREATE TRIGGER hos_event_deliveries_set_updated_at
  BEFORE UPDATE ON public.hos_event_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Declarative subscriptions: engine -> event type
CREATE TABLE IF NOT EXISTS public.engine_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  event_type text NOT NULL,
  handler text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, engine_id, event_type, handler)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_subscriptions TO authenticated;
GRANT ALL ON public.engine_subscriptions TO service_role;

ALTER TABLE public.engine_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own engine subscriptions"
  ON public.engine_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS engine_subscriptions_lookup_idx
  ON public.engine_subscriptions (user_id, event_type, enabled);

CREATE TRIGGER engine_subscriptions_set_updated_at
  BEFORE UPDATE ON public.engine_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();