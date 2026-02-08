#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/backup/postgres_backup.sh

Creates a Postgres backup in custom pg_dump format.

Env:
  DATABASE_URL   Postgres URL. Accepts SQLAlchemy-style URLs like:
                postgresql+psycopg://user:pass@host:5432/db
  OUT_DIR        Output directory (default: artifacts)
  OUT_FILE       Output file path (overrides OUT_DIR)
  PG_DUMP_ARGS   Extra pg_dump args (optional; whitespace-split)

If DATABASE_URL is not set, pg_dump will use standard libpq env vars
like PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" ]]; then
  usage
  exit 0
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

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
    return
  fi
  echo ""
}

require_cmd pg_dump
require_cmd date
require_cmd mkdir

out_dir="${OUT_DIR:-artifacts}"
timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
out_file="${OUT_FILE:-${out_dir}/postgres-${timestamp}.dump}"

mkdir -p "$(dirname "$out_file")"

extra_args=()
if [[ -n "${PG_DUMP_ARGS-}" ]]; then
  read -r -a extra_args <<<"${PG_DUMP_ARGS}"
fi

db_args=()
if [[ -n "${DATABASE_URL-}" ]]; then
  db_args=(--dbname "$(normalize_pg_url "$DATABASE_URL")")
fi

tmp_file="${out_file}.tmp"
rm -f "$tmp_file"

echo "Backing up Postgres → ${out_file}"
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$tmp_file" \
  "${db_args[@]}" \
  "${extra_args[@]}"

mv "$tmp_file" "$out_file"

sha="$(sha256_file "$out_file")"
if [[ -n "$sha" ]]; then
  echo "${sha}  $(basename "$out_file")" >"${out_file}.sha256"
fi

ls -lh "$out_file" 2>/dev/null || true
echo "Done."
