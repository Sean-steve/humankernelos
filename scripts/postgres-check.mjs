import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing.");

const pool = new Pool({ connectionString });
try {
  const db = await pool.query(
    "select current_database() as database, current_user as user, version() as version",
  );
  const migrations = await pool.query(
    "select count(*)::int as count from public.hos_schema_migrations",
  );
  const users = await pool.query("select count(*)::int as count from auth.users");
  console.log({
    database: db.rows[0].database,
    user: db.rows[0].user,
    migrations: migrations.rows[0].count,
    local_users: users.rows[0].count,
  });
} finally {
  await pool.end();
}
