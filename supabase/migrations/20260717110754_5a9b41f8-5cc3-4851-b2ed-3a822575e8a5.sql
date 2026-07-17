
-- Engine Registry (Ch. 6 / Ch. 7 / Constitution Art. VI)
CREATE TABLE public.engines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '0.1.0',
  purpose text,
  owner text,
  status text NOT NULL DEFAULT 'active',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_owned jsonb NOT NULL DEFAULT '[]'::jsonb,
  events_published jsonb NOT NULL DEFAULT '[]'::jsonb,
  events_consumed jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, engine_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engines TO authenticated;
GRANT ALL ON public.engines TO service_role;

ALTER TABLE public.engines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engines_owner_all" ON public.engines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER engines_set_updated_at
  BEFORE UPDATE ON public.engines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signal schema upgrade (Ch. 10 / Constitution Art. VIII)
ALTER TABLE public.engine_signals
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS reliability numeric(4,3),
  ADD COLUMN IF NOT EXISTS trend text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.engine_signals
  ADD CONSTRAINT engine_signals_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

ALTER TABLE public.engine_signals
  ADD CONSTRAINT engine_signals_reliability_range
    CHECK (reliability IS NULL OR (reliability >= 0 AND reliability <= 1));

ALTER TABLE public.engine_signals
  ADD CONSTRAINT engine_signals_trend_values
    CHECK (trend IS NULL OR trend IN ('improving','declining','stable','volatile','unknown'));
