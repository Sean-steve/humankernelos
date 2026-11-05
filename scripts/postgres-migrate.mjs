import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env or run bun run db:setup.");
}

const localUserId =
  process.env.LOCAL_USER_ID ?? "00000000-0000-4000-8000-000000000001";
const localUserEmail =
  process.env.LOCAL_USER_EMAIL ?? "local@humankernelos.test";

function postgresCompatible(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*(GRANT|REVOKE)\b/i.test(line))
    .join("\n")
    .replace(/\bTO\s+authenticated\b/gi, "TO PUBLIC");
}

async function bootstrap(client) {
  await client.query("create extension if not exists pgcrypto");
  await client.query("create schema if not exists auth");
  await client.query(`
    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$
  `);
  await client.query(`
    create table if not exists public.hos_schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function migrate() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await bootstrap(client);

    const applied = new Set(
      (await client.query("select name from public.hos_schema_migrations"))
        .rows.map((row) => row.name),
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const name of files) {
      if (applied.has(name)) continue;

      const raw = fs.readFileSync(path.join(migrationsDir, name), "utf8");
      const sql = postgresCompatible(raw);

      await client.query("begin");
      try {
        if (sql.trim()) await client.query(sql);
        await client.query(
          "insert into public.hos_schema_migrations(name) values ($1)",
          [name],
        );
        await client.query("commit");
        console.log(`applied ${name}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(
          `Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await client.query(
      `insert into auth.users(id, email, raw_user_meta_data)
       values ($1, $2, jsonb_build_object('name', 'Local Operator'))
       on conflict (id) do update set email = excluded.email`,
      [localUserId, localUserEmail],
    );

    console.log("HumanKernelOS PostgreSQL schema is ready.");
    console.log(`Local operator: ${localUserEmail} (${localUserId})`);
  } finally {
    client.release();
    await pool.end();
  }
}

await migrate();
