#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DATABASE_URL=postgresql://... ./scripts/restore/postgres_restore.sh /path/to/backup.dump
#
# Railway (recommended):
#   railway environment production
#   railway run --service api --no-local ./scripts/restore/postgres_restore.sh ./backup.dump

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

dump_path="${1:-}"
if [[ -z "${dump_path}" ]]; then
  echo "usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

if [[ ! -f "${dump_path}" ]]; then
  echo "backup file not found: ${dump_path}" >&2
  exit 1
fi

dir="$(cd "$(dirname "${dump_path}")" && pwd)"
file="$(basename "${dump_path}")"

docker run --rm \
  -v "${dir}:/in" \
  postgres:16 \
  pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL}" "/in/${file}"

echo "Restore completed from: ${dump_path}"

