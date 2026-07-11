ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_statements JSONB NOT NULL DEFAULT '["I am someone who never breaks a standard twice.","I am someone who moves my body every day.","I am someone who reads before I sleep.","I am someone who tells the truth in my journal.","I am someone who compounds calmly, over decades."]';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();