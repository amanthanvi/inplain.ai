# Railway

Deployment notes for `SPEC.md` v0.2.0 (target: v0.1.0 review package).

## Services

- `web` (public) — Next.js marketing + app (Server Actions BFF)
- `api` (private) — FastAPI internal service (DB reads/writes)
- `worker` (private) — Python worker (scheduler + non-render job executor)
- `renderer` (private) — Python worker (render-only; Playwright installed on start)
- `posthog-proxy` (public) — FastAPI reverse proxy to PostHog (routes UI → `Web :8000`; ingestion → `Capture :3000`)
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
- `INTERNAL_API_BASE_URL` — the **private** base URL for `api` (Railway private networking)

`posthog-proxy`:
- `POSTHOG_UPSTREAM` (or `POSTHOG_WEB_UPSTREAM`) — the **private** base URL for PostHog Web (including port `:8000`)
- `POSTHOG_CAPTURE_UPSTREAM` — the **private** base URL for PostHog Capture (including port `:3000`, typically `http://capture:3000`)

Notes:
- Keep PostHog `Web` + `Capture` internal-only (no Railway-provided domains). Only `posthog-proxy` should be public.
- If the Railway project also has an Inplain `web` service, PostHog `Web`’s private DNS name may be suffixed (e.g. `web-<suffix>`) to avoid collisions; set `POSTHOG_UPSTREAM` to that private host (including `:8000`), e.g. `http://web-<suffix>.railway.internal:8000`.

## Clerk webhooks

Create a Clerk webhook pointing to:

- `POST /internal/webhooks/clerk`

Set `CLERK_WEBHOOK_SECRET` on `api`.

## Railpack notes

- Python services build from repo root using `requirements.txt` (kept in sync with `apps/api/requirements.txt`).
- Web deploy uses `apps/web` as the root directory (so `package.json` is at the build root).

## Start commands

Configured via `RAILPACK_START_CMD` per service:

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
- `Web` (UI) on a fixed port (`:8000`)
- `Capture` (ingestion) on a fixed port (`:3000`)

`posthog-proxy` binds Railway's `$PORT` and routes ingestion paths (`/capture/*`, `/e/*`, `/i/*`) to `Capture` so server-side events work (otherwise `/capture/` returns CSRF 403 when sent to `Web`).

Tip: `make smoke-test` will send a `smoke_test` event to PostHog if `POSTHOG_HOST` + `POSTHOG_API_KEY` are set.
See `scripts/smoke/smoke_test.py`.

`posthog-proxy`:
- `POSTHOG_UPSTREAM` (or `POSTHOG_WEB_UPSTREAM`) — private PostHog Web URL (including port `:8000`)
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
