# Railway

## Project

- Project: `inplain-ai-v0-1-0`
- Services: `web`, `api`, `worker`, `renderer`, `scheduler`, `Postgres`, `Redis`
- Environments: `production`, `development`

## Domains

Railway provides a public domain per service per environment (see Railway dashboard or `railway domain`).

## Deploy commands

All deploys use Railpack and are driven by `RAILPACK_START_CMD` per service.

From repo root:

```bash
# Select env (optional; defaults to production)
railway environment production
railway environment development

# Deploy
railway up --service web apps/web --path-as-root
railway up --service api apps/api --path-as-root
railway up --service worker apps/api --path-as-root
railway up --service renderer apps/api --path-as-root
railway up --service scheduler apps/api --path-as-root
```

## Migrations (remote)

The `api` start command runs `alembic upgrade head` on boot (v0.1.0).

Manual fallback: run Alembic inside the `api` container so it can reach `Postgres` on Railway’s private network:

```bash
railway ssh -s api -- alembic -c alembic.ini upgrade head
```

## Required env vars (by service)

This repo assumes **env vars are set in Railway** (not committed).

### `web`

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `INPLAIN_API_BASE_URL` (e.g. `https://${{ api.RAILWAY_PUBLIC_DOMAIN }}`)
- Sentry (optional):
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
  - `NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE`
  - `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE` (server)
- `RAILPACK_START_CMD` (set to `npm run start -- -p $PORT`)

### `api` / `worker` / `renderer` / `scheduler`

- `DATABASE_URL` (from `Postgres`)
- `REDIS_URL` (from `Redis`)
- `ENQUEUE_JOBS` (`0` for safe boot; `1` for production processing)
- `INPLAIN_SERVICE_NAME` (`api`|`worker`|`renderer`|`scheduler`)
- `ENABLE_DAILY_DIGEST` (`0`/`1`) (worker + scheduler only)
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `CLERK_JWT_AUDIENCE`
- `CLERK_SECRET_KEY`
- `UNSUBSCRIBE_SECRET` (api + worker; must match)
- Sentry (optional): `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`
- OpenTelemetry (optional): `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`
- `CORS_ALLOW_ORIGINS` (api only)
- `WEB_BASE_URL` (api only)
- `API_PUBLIC_BASE_URL` (api only)
- `RAILPACK_START_CMD`:
  - `api`: `alembic -c alembic.ini upgrade head && uvicorn inplain.api.main:app --host 0.0.0.0 --port $PORT`
  - `worker`: `celery -A inplain.worker.celery_app:celery_app worker -Q fetch,summarize,notify,cleanup -l info`
  - `renderer`: `celery -A inplain.worker.celery_app:celery_app worker -Q render -l info`
  - `scheduler`: `python -m inplain.worker.scheduler`

Renderer setup (Playwright):

- Install browser binaries inside the `renderer` container (per environment):
  - `railway ssh -s renderer python -m playwright install chromium`

Also required for full v0.1.0 functionality (not yet configured here):

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`
- Postmark: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`
- OpenRouter: `OPENROUTER_API_KEY`
- Webhooks: `CLERK_WEBHOOK_SECRET`
- Unsubscribe: `UNSUBSCRIBE_SECRET`
- S3/R2 raw snapshots + backups: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (optional: `S3_ENDPOINT_URL`, `S3_REGION`, `S3_PREFIX`, `S3_FORCE_PATH_STYLE`)
