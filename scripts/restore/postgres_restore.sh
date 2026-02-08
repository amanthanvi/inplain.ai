#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/restore/postgres_restore.sh <backup.dump>

Restores a custom-format pg_dump backup to a target database.

WARNING: destructive. Requires CONFIRM=YES.

Env:
  DATABASE_URL      Postgres URL. Accepts SQLAlchemy-style URLs like:
                    postgresql+psycopg://user:pass@host:5432/db
  PG_RESTORE_ARGS   Extra pg_restore args (optional; whitespace-split)

If DATABASE_URL is not set, pg_restore will use standard libpq env vars
like PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" ]]; then
  usage
  exit 0
fi

backup_file="${1-}"
if [[ -z "$backup_file" ]]; then
  usage
  exit 2
fi

if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 2
fi

if [[ "${CONFIRM-}" != "YES" ]]; then
  echo "Refusing to restore without CONFIRM=YES (destructive)." >&2
  exit 2
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

normalize_pg_url() {
  local url="$1"
  url="${url/postgresql+psycopg:\/\//postgresql:\/\/}"
  url="${url/postgresql+psycopg2:\/\//postgresql:\/\/}"
  url="${url/postgresql+psycopg_binary:\/\//postgresql:\/\/}"
  echo "$url"
}

require_cmd pg_restore

extra_args=()
if [[ -n "${PG_RESTORE_ARGS-}" ]]; then
  read -r -a extra_args <<<"${PG_RESTORE_ARGS}"
fi

db_args=()
if [[ -n "${DATABASE_URL-}" ]]; then
  db_args=(--dbname "$(normalize_pg_url "$DATABASE_URL")")
fi

echo "Restoring ${backup_file}"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --single-transaction \
  "${db_args[@]}" \
  "${extra_args[@]}" \
  "$backup_file"

echo "Done."
