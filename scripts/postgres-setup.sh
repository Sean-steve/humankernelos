#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

DB_NAME="${POSTGRES_DB_NAME:-humankernelos}"
DB_USER="${POSTGRES_APP_USER:-hos_user}"
DB_PASSWORD="${POSTGRES_APP_PASSWORD:-hos_local_password}"

if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || [[ ! "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "POSTGRES_DB_NAME and POSTGRES_APP_USER may contain only letters, numbers, and underscores."
  exit 1
fi

ESCAPED_PASSWORD=${DB_PASSWORD//\'/\'\'}

if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create role \"${DB_USER}\" login password '${ESCAPED_PASSWORD}'"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "alter role \"${DB_USER}\" password '${ESCAPED_PASSWORD}'"
fi

if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

echo "PostgreSQL database ready: $DB_NAME (owner: $DB_USER)"
bun run db:migrate
bun run db:check

echo
echo "Local HumanKernelOS database is ready."
echo "Run: bun run dev"
