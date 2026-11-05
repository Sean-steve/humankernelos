import "dotenv/config";
import process from "node:process";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing.");

const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query("drop schema if exists public cascade");
  await client.query("create schema public");
  await client.query("drop schema if exists auth cascade");
} finally {
  client.release();
  await pool.end();
}

const result = spawnSync(process.execPath, ["scripts/postgres-migrate.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
