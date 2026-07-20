-- human_states: HSV snapshot per user per day
CREATE TABLE public.human_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  as_of DATE NOT NULL,
  physical JSONB NOT NULL DEFAULT '{}'::jsonb,
  cognitive JSONB NOT NULL DEFAULT '{}'::jsonb,
  emotional JSONB NOT NULL DEFAULT '{}'::jsonb,
  behavioral JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifestyle JSONB NOT NULL DEFAULT '{}'::jsonb,
  operational JSONB NOT NULL DEFAULT '{}'::jsonb,
  composite NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, as_of)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.human_states TO authenticated;
GRANT ALL ON public.human_states TO service_role;
ALTER TABLE public.human_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hsv" ON public.human_states
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER human_states_set_updated_at BEFORE UPDATE ON public.human_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- recommendations: PDIE object model
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'daily',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC,
  priority NUMERIC,
  state_alignment NUMERIC,
  urgency NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs" ON public.recommendations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recommendations_user_created_idx ON public.recommendations (user_id, created_at DESC);

-- policies: personal operating rules
CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  when_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  then_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own policies" ON public.policies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER policies_set_updated_at BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();