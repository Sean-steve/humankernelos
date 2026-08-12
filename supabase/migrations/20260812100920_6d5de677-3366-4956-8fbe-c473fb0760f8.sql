CREATE TABLE public.orchestrator_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fused_axes JSONB NOT NULL DEFAULT '{}'::jsonb,
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  signal_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orchestrator_runs TO authenticated;
GRANT ALL ON public.orchestrator_runs TO service_role;

ALTER TABLE public.orchestrator_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own orchestrator runs" ON public.orchestrator_runs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER orchestrator_runs_set_updated_at
  BEFORE UPDATE ON public.orchestrator_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.signal_conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.orchestrator_runs(id) ON DELETE CASCADE,
  axis TEXT NOT NULL,
  competing JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolution TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  severity NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_conflicts TO authenticated;
GRANT ALL ON public.signal_conflicts TO service_role;

ALTER TABLE public.signal_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own signal conflicts" ON public.signal_conflicts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER signal_conflicts_set_updated_at
  BEFORE UPDATE ON public.signal_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX orchestrator_runs_user_generated_idx ON public.orchestrator_runs (user_id, generated_at DESC);
CREATE INDEX signal_conflicts_user_created_idx ON public.signal_conflicts (user_id, created_at DESC);