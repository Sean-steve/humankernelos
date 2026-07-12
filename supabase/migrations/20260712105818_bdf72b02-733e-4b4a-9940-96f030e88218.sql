
-- Event bus
CREATE TABLE public.hos_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  source_engine text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hos_events_user_time ON public.hos_events (user_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.hos_events TO authenticated;
GRANT ALL ON public.hos_events TO service_role;
ALTER TABLE public.hos_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events r" ON public.hos_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own events i" ON public.hos_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Engine signals (normalized kernel view)
CREATE TABLE public.engine_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  engine text NOT NULL,
  signal_key text NOT NULL,
  value_num numeric,
  value_text text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX engine_signals_lookup ON public.engine_signals (user_id, signal_key, occurred_at DESC);
GRANT SELECT, INSERT ON public.engine_signals TO authenticated;
GRANT ALL ON public.engine_signals TO service_role;
ALTER TABLE public.engine_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signals r" ON public.engine_signals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own signals i" ON public.engine_signals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Nutrition engine
CREATE TABLE public.nutrition_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  meal text NOT NULL,
  kcal integer NOT NULL DEFAULT 0,
  protein_g integer NOT NULL DEFAULT 0,
  water_ml integer NOT NULL DEFAULT 0,
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_logs_user_time ON public.nutrition_logs (user_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_logs TO authenticated;
GRANT ALL ON public.nutrition_logs TO service_role;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nutrition all" ON public.nutrition_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Body engine
CREATE TABLE public.body_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  duration_min integer NOT NULL DEFAULT 0,
  intensity integer NOT NULL DEFAULT 5,
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX body_sessions_user_time ON public.body_sessions (user_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_sessions TO authenticated;
GRANT ALL ON public.body_sessions TO service_role;
ALTER TABLE public.body_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own body all" ON public.body_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routine engine
CREATE TABLE public.routine_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  routine_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_completions_user_time ON public.routine_completions (user_id, completed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_completions TO authenticated;
GRANT ALL ON public.routine_completions TO service_role;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own routines all" ON public.routine_completions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
