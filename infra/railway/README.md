# Railway

Deployment notes for `SPEC.md` v0.2.0 (target: v0.1.0 review package).

## Services

- `web` (public) — Next.js marketing + app (Server Actions BFF)
- `api` (private) — FastAPI internal service (DB reads/writes)
- `worker` (private) — Python worker (scheduler + non-render job executor)
- `renderer` (private) — Python worker (render-only; Playwright installed on start)
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

Note: the first `renderer` boot downloads Playwright Chromium/ffmpeg (~300MB).

## Backups

GitHub Actions scheduled backup workflow:
- `.github/workflows/backup.yml`

Set repo secret:
- `PROD_DATABASE_URL` — **libpq** style URL (no `+psycopg`), e.g. `postgresql://USER:PASS@HOST:5432/DB`

The workflow runs `scripts/backup/postgres_backup.sh` and uploads an artifact.
