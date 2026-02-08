# Railway

Deployment notes for `SPEC.md` v0.2.0 (target: v0.1.0 review package).

## Services

- `web` (public) — Next.js marketing + app (Server Actions BFF)
- `api` (private) — FastAPI internal service (DB reads/writes)
- `worker` (private) — Python worker (scheduler + job executor)
- `postgres` — primary DB + job queue (`jobs` table)
- `redis` — cache only (robots.txt decisions; politeness tracking)

## Required env

Shared:
- `INTERNAL_SERVICE_TOKEN` — must match between `web` and `api`

`api` + `worker`:
- `DATABASE_URL` — SQLAlchemy URL (psycopg3), e.g. `postgresql+psycopg://USER:PASS@HOST:5432/DB`
- `REDIS_URL` — optional but recommended (robots cache); e.g. `redis://HOST:6379/0`
- `OPENROUTER_API_KEY` — required for AI summaries
- `CLERK_WEBHOOK_SECRET` — required for Clerk webhook verification

`web`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- `INTERNAL_API_BASE_URL` — the **private** base URL for `api` (Railway private networking)

## Clerk webhooks

Create a Clerk webhook pointing to:

- `POST /internal/webhooks/clerk`

Set `CLERK_WEBHOOK_SECRET` on `api`.

## Build / start commands (suggested)

Railway can run these per service:

`web`:
- build: `npm --prefix apps/web ci && npm --prefix apps/web run build`
- start: `npm --prefix apps/web run start`

`api`:
- build: `python -m pip install -r apps/api/requirements.txt`
- start: `PYTHONPATH=apps/api uvicorn inplain.api.main:app --host 0.0.0.0 --port $PORT`

`worker`:
- build: `python -m pip install -r apps/api/requirements.txt`
- start: `PYTHONPATH=apps/api python -m inplain.worker.main`

If you enable JS-render fallback, install Playwright browsers during build for `worker`:

- `python -m playwright install chromium`

## Backups

GitHub Actions scheduled backup workflow:
- `.github/workflows/backup.yml`

Set repo secret:
- `PROD_DATABASE_URL` — **libpq** style URL (no `+psycopg`), e.g. `postgresql://USER:PASS@HOST:5432/DB`

The workflow runs `scripts/backup/postgres_backup.sh` and uploads an artifact.
