-- Learning Loop (Constitution Art. XII)

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS sustainability jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.recommendation_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  executed text NOT NULL DEFAULT 'no',
  effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  friction text,
  note text,
  measured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_outcomes TO authenticated;
GRANT ALL ON public.recommendation_outcomes TO service_role;
ALTER TABLE public.recommendation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outcomes" ON public.recommendation_outcomes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER recommendation_outcomes_set_updated_at BEFORE UPDATE ON public.recommendation_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX recommendation_outcomes_user_idx ON public.recommendation_outcomes (user_id, measured_at DESC);
CREATE UNIQUE INDEX recommendation_outcomes_rec_idx ON public.recommendation_outcomes (recommendation_id);

CREATE TABLE public.learned_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  axis text,
  evidence_count integer NOT NULL DEFAULT 1,
  confidence numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learned_patterns TO authenticated;
GRANT ALL ON public.learned_patterns TO service_role;
ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own patterns" ON public.learned_patterns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER learned_patterns_set_updated_at BEFORE UPDATE ON public.learned_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX learned_patterns_user_idx ON public.learned_patterns (user_id, updated_at DESC);