#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   # Local dev:
#   DATABASE_URL=postgresql://... ./scripts/backup/postgres_backup.sh
#
#   # Railway (recommended; injects DATABASE_URL/REDIS_URL/etc from Railway env):
#   railway environment production
#   railway run --service api --no-local ./scripts/backup/postgres_backup.sh
#
# Optional uploads (S3/R2):
#   Set S3_BUCKET and AWS credentials (or AWS_PROFILE). For R2, also set S3_ENDPOINT_URL.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

date_utc="$(date -u +%F)"
time_utc="$(date -u +%H%M%S)"

out_dir="${OUT_DIR:-./.backups/postgres/${date_utc}}"
mkdir -p "${out_dir}"

dump_path="${out_dir}/backup-${time_utc}.dump"
manifest_path="${dump_path}.json"

docker run --rm \
  -v "${out_dir}:/out" \
  postgres:16 \
  pg_dump --format=c --dbname="${DATABASE_URL}" --file="/out/$(basename "${dump_path}")"

git_sha="$(git rev-parse HEAD 2>/dev/null || true)"
cat >"${manifest_path}" <<EOF
{"git_sha":"${git_sha}","created_at_utc":"$(date -u +%FT%TZ)","dump_file":"$(basename "${dump_path}")"}
EOF

if [[ -n "${S3_BUCKET:-}" ]]; then
  key="backups/postgres/${date_utc}/$(basename "${dump_path}")"
  manifest_key="${key}.json"

  endpoint_args=()
  if [[ -n "${S3_ENDPOINT_URL:-}" ]]; then
    endpoint_args=(--endpoint-url "${S3_ENDPOINT_URL}")
  fi

  aws "${endpoint_args[@]}" s3 cp "${dump_path}" "s3://${S3_BUCKET}/${key}"
  aws "${endpoint_args[@]}" s3 cp "${manifest_path}" "s3://${S3_BUCKET}/${manifest_key}"
fi

echo "Backup written: ${dump_path}"

