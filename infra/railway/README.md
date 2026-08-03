# Railway

Deployment notes for `SPEC.md` v0.2.0 (target: v0.1.0 review package).

## Services

- `web` (public) — Next.js marketing + app (Server Actions BFF)
- `api` (private) — FastAPI internal service (DB reads/writes)
- `worker` (private) — Python worker (scheduler + non-render job executor)
- `renderer` (private) — Python worker (render-only; Playwright installed on start)
- `posthog-proxy` (public) — FastAPI reverse proxy to PostHog (routes UI → `posthog-web :8000`; ingestion → `Capture :3000`)
- `postgres` — primary DB + job queue (`jobs` table)
- `redis` — cache only (robots.txt decisions; politeness tracking)

## Required env

Shared:
- `INTERNAL_SERVICE_TOKEN` — must match between `web` and `api`

`api` + `worker` + `renderer`:
- `DATABASE_URL` — Railway provides `postgresql://...`; the app normalizes to `postgresql+psycopg://...` at runtime.
- `REDIS_URL` — optional but recommended (robots cache); e.g. `redis://HOST:6379/0`

`worker` + `renderer`:
- `OPENROUTER_API_KEY` — required for AI summaries

`api`:
- `CLERK_WEBHOOK_SECRET` — required for Clerk webhook verification

`web`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- `CLERK_PLAN_FREE` + `CLERK_PLAN_PRO` + `CLERK_PLAN_BUSINESS`
- `CLERK_BILLING_WEBHOOK_SECRET`
- `INTERNAL_API_BASE_URL` — the **private** base URL for `api` (Railway private networking)

`posthog-proxy`:
- `POSTHOG_UPSTREAM` (or `POSTHOG_WEB_UPSTREAM`) — the **private** base URL for PostHog Web (including port `:8000`)
- `POSTHOG_CAPTURE_UPSTREAM` — the **private** base URL for PostHog Capture (including port `:3000`, typically `http://capture:3000`)

Notes:
- Keep PostHog `Web` + `Capture` internal-only (no Railway-provided domains). Only `posthog-proxy` should be public.
- Rename PostHog template `Web` to `posthog-web` to avoid `Web` (PostHog) vs `web` (Inplain) ambiguity.
- Set `POSTHOG_UPSTREAM` to `http://posthog-web:8000` (or equivalent private host for the renamed service).

## Clerk webhooks

Create two Clerk webhooks:

- User lifecycle webhook to `api`: `POST /internal/webhooks/clerk` (`CLERK_WEBHOOK_SECRET` on `api`)
- Billing webhook to `web`: `POST /api/webhooks/clerk-billing` (`CLERK_BILLING_WEBHOOK_SECRET` on `web`)

Billing webhook should include subscription events (`subscription.*`, `subscriptionItem.*`) so plan changes trigger entitlement sync immediately.

## Railpack notes

- Python services build from repo root using `requirements.txt` (kept in sync with `apps/api/requirements.txt`).
- Web deploy uses `apps/web` as the root directory (so `package.json` is at the build root).

## Start commands

**These now live in version-controlled config, not just in this file.**
Each service points at its own config-as-code file via Railway's
"Config as code" path setting:

| Service | Config path | Root directory |
|---|---|---|
| `web` | `infra/railway/web.json` | `apps/web` |
| `api` | `infra/railway/api.json` | repo root |
| `worker` | `infra/railway/worker.json` | repo root |
| `renderer` | `infra/railway/renderer.json` | repo root |
| `posthog-proxy` | `infra/railway/posthog-proxy.json` | repo root |

Those files carry the start command, builder and restart policy, so a
redeploy cannot silently drift from what is documented here. Environment
variables and private-network wiring remain dashboard/API state - Railway
has no way to express them in config-as-code - so the env lists above are
still the source of truth for those.

The equivalent `RAILPACK_START_CMD` values, for reference:

`web`:
- `npm run start -- -p $PORT`

`api`:
- `PYTHONPATH=apps/api alembic -c apps/api/alembic.ini upgrade head && PYTHONPATH=apps/api uvicorn inplain.api.main:app --host 0.0.0.0 --port $PORT`

`worker`:
- `PYTHONPATH=apps/api python -m inplain.worker.main`
- `INPLAIN_WORKER_QUEUES=fetch,diff,summarize,notify,cleanup`

`renderer`:
- `python -m playwright install chromium && PYTHONPATH=apps/api python -m inplain.worker.main`
- `INPLAIN_WORKER_QUEUES=render`
- `INPLAIN_WORKER_ENABLE_SCHEDULER=0`
- `INPLAIN_WORKER_ENABLE_STALE_LOCK_CLEANUP=0`

`posthog-proxy`:
- `PYTHONPATH=apps uvicorn posthog_proxy.main:app --host 0.0.0.0 --port $PORT --proxy-headers`

Note: the first `renderer` boot downloads Playwright Chromium/ffmpeg (~300MB).

## Backups

GitHub Actions scheduled backup workflow:
- `.github/workflows/backup.yml`

Set repo secret:
- `PROD_DATABASE_URL` — **libpq** style URL (no `+psycopg`), e.g. `postgresql://USER:PASS@HOST:5432/DB`

The workflow runs `scripts/backup/postgres_backup.sh` and uploads an artifact.

## Cloudflare launch settings (L4 + L5)

Cloudflare:
- Enable orange-cloud proxy on apex + `www` DNS records.
- SSL mode: `Full (strict)`.
- Cache static assets (`/_next/static/*`) with long TTL.

Turnstile:
- Enable Clerk CAPTCHA using Turnstile in Clerk Dashboard.
- Set Turnstile site key + secret in Clerk.
- Validate sign-up flow presents CAPTCHA before account creation.

## Renderer service (L6)

The dedicated `renderer` Railway service is configured via:
- `INPLAIN_WORKER_QUEUES=render`
- `INPLAIN_WORKER_ENABLE_SCHEDULER=0`
- `INPLAIN_WORKER_ENABLE_STALE_LOCK_CLEANUP=0`
- `RAILPACK_START_CMD=python -m playwright install chromium && PYTHONPATH=apps/api python -m inplain.worker.main`

## PostHog + Sentry env (L7 + L8)

PostHog (L7) is deployed from Railway's self-hosted template, but the template splits:
- `posthog-web` (UI, renamed from template `Web`) on a fixed port (`:8000`)
- `Capture` (ingestion) on a fixed port (`:3000`)

`posthog-proxy` binds Railway's `$PORT` and routes ingestion paths (`/capture/*`, `/e/*`, `/i/*`) to `Capture` so server-side events work (otherwise `/capture/` returns CSRF 403 when sent to `posthog-web`).

Tip: `make smoke-test` will send a `smoke_test` event to PostHog if `POSTHOG_HOST` + `POSTHOG_API_KEY` are set.
See `scripts/smoke/smoke_test.py`.

`posthog-proxy`:
- `POSTHOG_UPSTREAM` (or `POSTHOG_WEB_UPSTREAM`) — private PostHog Web URL (including port `:8000`; recommended `http://posthog-web:8000`)
- `POSTHOG_CAPTURE_UPSTREAM` — private PostHog Capture URL (including port `:3000`, typically `http://capture:3000`)

`api` + `worker`:
- `POSTHOG_API_KEY`
- `POSTHOG_HOST` (self-hosted URL)
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT` (`production`, `staging`, etc.)

`web`:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_SENTRY_DSN`

## Blue-green deploy flow (L9)

1. Deploy new version to `green` environment/services.
2. Run smoke checks against green:
   - `make smoke-test` with green `WEB_BASE_URL` + `API_BASE_URL`.
3. Switch production routing to green.
4. Monitor logs/errors for 15-30 minutes.
5. If healthy, keep green as prod and demote blue; otherwise rollback.

## Smoke test (no secrets)

To run the smoke test locally **without copying secrets**, pull variables from Railway:

```bash
railway run --service api --environment production -- make smoke-test
```

Note: Railway-provided `RAILWAY_SERVICE_*_URL` variables are hostnames (no `http://`/`https://`). If you use them directly in scripts, prefix `https://`.

## Determinism check (no secrets)

Use the scripted production check before or after any Railway recovery action:

```bash
make railway-prod-check
```

This verifies, without printing secret values:
- production staged patch is empty (`patch={}`) and `lastAppliedError` is clear
- all private-network endpoints are `syncStatus=ACTIVE`
- only `api`, `web`, and `posthog-proxy` are public in production

## Private network apply failures

If the Railway dashboard shows staged changes but applying fails with a private-network error:

1. **Reduce churn first**: ensure only `api`, `web`, and `posthog-proxy` have public domains in `production`. (PostHog template services like `Web` and `Capture` should stay internal-only.)
2. **Avoid name collisions**: rename PostHog template services to `posthog-*` to prevent `Web` (PostHog) vs `web` (Inplain) confusion and private DNS collisions.
   - Tip: `railway ssh --service web` may resolve to the wrong service when names collide; prefer using service IDs from `railway status --json`.
3. **Clear stale staged patch**: if all private-network endpoints are `ACTIVE` but a stale staged patch still exists with `lastAppliedError`, reset staged changes to `{}`.

```bash
PROD_ENV_ID=$(railway status --json | jq -r '.environments.edges[] | select(.node.name=="production") | .node.id')
TOKEN=$(jq -r '.user.token' "$HOME/.railway/config.json")

curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"query":"query($environmentId:String!){environmentStagedChanges(environmentId:$environmentId){id status message lastAppliedError patch}}","variables":{"environmentId":"'"$PROD_ENV_ID"'"}}' \
  https://backboard.railway.com/graphql/v2

curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"query":"mutation($environmentId:String!,$input:EnvironmentConfig!,$merge:Boolean!){environmentStageChanges(environmentId:$environmentId,input:$input,merge:$merge){id status lastAppliedError patch}}","variables":{"environmentId":"'"$PROD_ENV_ID"'","input":{},"merge":false}}' \
  https://backboard.railway.com/graphql/v2
```

4. **Repair safely**: if the environment is still stuck after staged patch reset, prefer creating a fresh `prod-green` environment and swapping custom domains over in-place surgery (keeps rollback simple).

## Deployment warning cleanup (`posthog-proxy`)

If `posthog-proxy` shows a warning because the latest deployment failed (for example, a blocked source build) but an older deploy was healthy:

1. **Do not use `railway down`** to clear the warning. It removes the most recent successful deployment in this service timeline and can leave only the failed deploy active in metadata.
2. Roll back directly to a known-good deployment ID with GraphQL `deploymentRollback`.
3. Re-verify with:
   - `railway service status --all --environment production`
   - `railway run --service api --environment production -- make smoke-test`
