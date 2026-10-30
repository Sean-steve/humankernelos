-- Phase 3 — Personal Kernel Completion
-- Kernel-owned goals, authoritative Daily Operating Plan, decision/personal memory,
-- and Human State provenance. Every table is user-owned and RLS protected.

ALTER TABLE public.human_states
  ADD COLUMN IF NOT EXISTS coverage numeric,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS source_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  horizon text NOT NULL DEFAULT 'quarterly',
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  target_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX goals_user_status_priority_idx ON public.goals(user_id, status, priority);
CREATE TRIGGER goals_set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plans TO authenticated;
GRANT ALL ON public.daily_plans TO service_role;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily plans" ON public.daily_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER daily_plans_set_updated_at BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  source_type text NOT NULL DEFAULT 'kernel',
  source_id text,
  source_engine text,
  priority integer NOT NULL DEFAULT 100,
  protected boolean NOT NULL DEFAULT false,
  flexibility text NOT NULL DEFAULT 'flexible',
  status text NOT NULL DEFAULT 'planned',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plan_items TO authenticated;
GRANT ALL ON public.daily_plan_items TO service_role;
ALTER TABLE public.daily_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily plan items" ON public.daily_plan_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX daily_plan_items_plan_time_idx ON public.daily_plan_items(plan_id, start_at);
CREATE TRIGGER daily_plan_items_set_updated_at BEFORE UPDATE ON public.daily_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_plan_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  source_engine text NOT NULL,
  source_id text,
  title text NOT NULL,
  description text,
  requested_start timestamptz,
  requested_end timestamptz,
  minimum_duration_min integer,
  preferred_duration_min integer,
  flexibility text NOT NULL DEFAULT 'flexible',
  priority integer NOT NULL DEFAULT 100,
  protected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_item_id uuid REFERENCES public.daily_plan_items(id) ON DELETE SET NULL,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plan_proposals TO authenticated;
GRANT ALL ON public.daily_plan_proposals TO service_role;
ALTER TABLE public.daily_plan_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily plan proposals" ON public.daily_plan_proposals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX daily_plan_proposals_user_date_status_idx
  ON public.daily_plan_proposals(user_id, plan_date, status);
CREATE TRIGGER daily_plan_proposals_set_updated_at BEFORE UPDATE ON public.daily_plan_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.decision_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen_action text NOT NULL,
  decision_status text NOT NULL,
  expected_outcome text,
  actual_outcome text,
  lesson text,
  confidence numeric,
  decided_at timestamptz NOT NULL DEFAULT now(),
  measured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_memory TO authenticated;
GRANT ALL ON public.decision_memory TO service_role;
ALTER TABLE public.decision_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decision memory" ON public.decision_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX decision_memory_user_decided_idx ON public.decision_memory(user_id, decided_at DESC);
CREATE TRIGGER decision_memory_set_updated_at BEFORE UPDATE ON public.decision_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.personal_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  memory_key text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  active boolean NOT NULL DEFAULT true,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, memory_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_memory TO authenticated;
GRANT ALL ON public.personal_memory TO service_role;
ALTER TABLE public.personal_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own personal memory" ON public.personal_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX personal_memory_user_active_type_idx ON public.personal_memory(user_id, active, memory_type);
CREATE TRIGGER personal_memory_set_updated_at BEFORE UPDATE ON public.personal_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.human_state_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_date date NOT NULL,
  axis text NOT NULL,
  source_key text NOT NULL,
  source_engine text NOT NULL,
  raw_value numeric,
  normalized_value numeric,
  confidence numeric,
  reliability numeric,
  recency_weight numeric,
  trend text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.human_state_evidence TO authenticated;
GRANT ALL ON public.human_state_evidence TO service_role;
ALTER TABLE public.human_state_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own human state evidence" ON public.human_state_evidence FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX human_state_evidence_user_date_axis_idx
  ON public.human_state_evidence(user_id, state_date, axis);
