#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ops/railway_prod_determinism_check.sh [environment]

Validates Railway environment determinism for launch readiness:
  1) staged patch is empty (`patch={}`) and has no `lastAppliedError`
  2) all private-network endpoint sync statuses are `ACTIVE`
  3) only `api`, `web`, and `posthog-proxy` are publicly exposed

Args:
  environment  Environment name (default: production)

Env:
  ALLOWED_PUBLIC_SERVICES  Comma-separated allowlist (default: api,web,posthog-proxy)
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

require_cmd railway
require_cmd jq
require_cmd curl

environment_name="${1:-production}"
allowed_public_services="${ALLOWED_PUBLIC_SERVICES:-api,web,posthog-proxy}"

status_json="$(mktemp)"
staged_json="$(mktemp)"
private_networks_json="$(mktemp)"
sync_jsonl="$(mktemp)"
trap 'rm -f "$status_json" "$staged_json" "$private_networks_json" "$sync_jsonl"' EXIT

railway status --json >"$status_json"

environment_id="$(
  jq -r --arg env "$environment_name" '
    .environments.edges[]
    | select(.node.name == $env)
    | .node.id
  ' "$status_json"
)"

if [[ -z "$environment_id" || "$environment_id" == "null" ]]; then
  echo "Environment not found in Railway status: $environment_name" >&2
  exit 1
fi

token="$(jq -r '.user.token // empty' "$HOME/.railway/config.json")"
if [[ -z "$token" ]]; then
  echo "Railway token missing in ~/.railway/config.json" >&2
  exit 1
fi

gql() {
  local query="$1"
  local variables_json="$2"
  curl -sS \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n --arg q "$query" --argjson v "$variables_json" '{query:$q,variables:$v}')" \
    https://backboard.railway.com/graphql/v2
}

staged_query='query($environmentId:String!){environmentStagedChanges(environmentId:$environmentId){id status message lastAppliedError patch}}'
gql "$staged_query" "{\"environmentId\":\"$environment_id\"}" >"$staged_json"

staged_id="$(jq -r '.data.environmentStagedChanges.id // empty' "$staged_json")"
staged_status="$(jq -r '.data.environmentStagedChanges.status // empty' "$staged_json")"
staged_last_error="$(jq -r '.data.environmentStagedChanges.lastAppliedError // empty' "$staged_json")"
staged_patch="$(jq -c '.data.environmentStagedChanges.patch' "$staged_json")"

private_networks_query='query($environmentId:String!){privateNetworks(environmentId:$environmentId){publicId name dnsName}}'
gql "$private_networks_query" "{\"environmentId\":\"$environment_id\"}" >"$private_networks_json"

private_network_id="$(jq -r '.data.privateNetworks[0].publicId // empty' "$private_networks_json")"
private_network_name="$(jq -r '.data.privateNetworks[0].name // empty' "$private_networks_json")"
private_network_count="$(jq -r '.data.privateNetworks | length' "$private_networks_json")"

if [[ -z "$private_network_id" ]]; then
  echo "No private network found for environment: $environment_name" >&2
  exit 1
fi

service_ids="$(
  jq -r --arg env "$environment_name" '
    .environments.edges[]
    | select(.node.name == $env)
    | .node.serviceInstances.edges[].node.serviceId
  ' "$status_json" | sort -u
)"

endpoint_query='query($environmentId:String!,$privateNetworkId:String!,$serviceId:String!){privateNetworkEndpoint(environmentId:$environmentId,privateNetworkId:$privateNetworkId,serviceId:$serviceId){syncStatus}}'

while IFS= read -r service_id; do
  if [[ -z "$service_id" ]]; then
    continue
  fi
  service_name="$(
    jq -r --arg sid "$service_id" '
      .services.edges[]
      | select(.node.id == $sid)
      | .node.name
    ' "$status_json"
  )"
  response="$(gql "$endpoint_query" "{\"environmentId\":\"$environment_id\",\"privateNetworkId\":\"$private_network_id\",\"serviceId\":\"$service_id\"}")"
  sync_status="$(echo "$response" | jq -r '.data.privateNetworkEndpoint.syncStatus // "MISSING"')"
  jq -nc --arg name "$service_name" --arg id "$service_id" --arg sync "$sync_status" '{"serviceName":$name,"serviceId":$id,"syncStatus":$sync}' >>"$sync_jsonl"
done <<<"$service_ids"

active_count="$(jq -s '[.[] | select(.syncStatus == "ACTIVE")] | length' "$sync_jsonl")"
total_count="$(jq -s 'length' "$sync_jsonl")"
non_active_count="$(jq -s '[.[] | select(.syncStatus != "ACTIVE")] | length' "$sync_jsonl")"

public_services="$(
  jq -r --arg env "$environment_name" '
    .environments.edges[]
    | select(.node.name == $env)
    | .node.serviceInstances.edges[].node as $instance
    | ((($instance.domains.serviceDomains // []) + ($instance.domains.customDomains // [])) | length) as $domain_count
    | select($domain_count > 0)
    | $instance.serviceName
  ' "$status_json" | sort -u
)"

allowed_csv=",$allowed_public_services,"
unexpected_public=""
while IFS= read -r service_name; do
  if [[ -z "$service_name" ]]; then
    continue
  fi
  if [[ "$allowed_csv" != *",$service_name,"* ]]; then
    unexpected_public+="${service_name} "
  fi
done <<<"$public_services"

public_services_line="$(echo "$public_services" | tr '\n' ' ' | sed -E 's/[[:space:]]+$//')"

echo "Environment: $environment_name ($environment_id)"
echo "Staged patch: id=$staged_id status=$staged_status lastAppliedError=${staged_last_error:-<none>} patch=$staged_patch"
echo "Private network: id=$private_network_id name=$private_network_name count=$private_network_count"
echo "Private network endpoint sync: ACTIVE=$active_count TOTAL=$total_count NON_ACTIVE=$non_active_count"
echo "Public services: ${public_services_line:-<none>}"

failures=()

if [[ "$staged_patch" != "{}" ]]; then
  failures+=("staged patch is not empty")
fi
if [[ -n "$staged_last_error" ]]; then
  failures+=("staged patch has lastAppliedError")
fi
if [[ "$non_active_count" != "0" ]]; then
  failures+=("private-network sync has non-ACTIVE endpoints")
fi
if [[ -n "${unexpected_public// }" ]]; then
  failures+=("unexpected public services: ${unexpected_public}")
fi

if [[ "${#failures[@]}" -gt 0 ]]; then
  echo "Determinism check: FAIL"
  for failure in "${failures[@]}"; do
    echo "- $failure"
  done
  if [[ "$non_active_count" != "0" ]]; then
    echo "Non-ACTIVE endpoints:"
    jq -s -r '.[] | select(.syncStatus != "ACTIVE") | "- \(.serviceName) (\(.serviceId)): \(.syncStatus)"' "$sync_jsonl"
  fi
  exit 1
fi

echo "Determinism check: PASS"
