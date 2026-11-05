import "dotenv/config";
import { createPostgresDb, getPostgresPool } from "../src/integrations/postgres/client.server";

const userId =
  process.env.LOCAL_USER_ID ?? "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const db = createPostgresDb(userId);

const profile = await db.from("profiles").select("id,name").maybeSingle();
if (profile.error) throw new Error(profile.error.message);
if (!profile.data || profile.data.id !== userId) {
  throw new Error("Local operator profile was not bootstrapped correctly.");
}

const checkIn = await db
  .from("check_ins")
  .insert({
    energy: 7,
    focus: 6,
    recovery: 5,
    stress: 3,
    mood: 7,
    sleep_hours: 7.5,
    note: "PostgreSQL smoke test",
  })
  .select("id,user_id,note")
  .single();

if (checkIn.error) throw new Error(checkIn.error.message);
if (checkIn.data?.user_id !== userId) {
  throw new Error("Scoped insert did not attach the local user.");
}

const goal = await db
  .from("goals")
  .insert({
    title: "Local PostgreSQL certification",
    description: "Verify plain PostgreSQL runtime",
    horizon: "short",
    priority: 1,
    status: "active",
    progress: 0,
  })
  .select("id,user_id,title")
  .single();

if (goal.error) throw new Error(goal.error.message);

const pool = getPostgresPool();
await pool.query(
  `insert into auth.users(id, email, raw_user_meta_data)
   values ($1, 'other@humankernelos.test', '{}'::jsonb)
   on conflict (id) do nothing`,
  [otherUserId],
);
await pool.query(
  `insert into public.goals(user_id, title, horizon, priority, status, progress)
   values ($1, 'Other user goal', 'short', 1, 'active', 0)`,
  [otherUserId],
);

const scopedGoals = await db
  .from("goals")
  .select("id,user_id,title")
  .order("priority", { ascending: true });

if (scopedGoals.error) throw new Error(scopedGoals.error.message);
if (!Array.isArray(scopedGoals.data)) {
  throw new Error("Scoped goal query did not return a row collection.");
}
if (scopedGoals.data.some((row) => row.user_id !== userId)) {
  throw new Error("PostgreSQL adapter leaked another user's row.");
}

console.log({
  postgres_smoke: "passed",
  local_user_id: userId,
  scoped_goal_count: scopedGoals.data.length,
  check_in_id: checkIn.data?.id,
});

await pool.end();
