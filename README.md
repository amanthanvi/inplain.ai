# Inplain.ai

Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries.

Source of truth: `SPEC.md`.

## Product routes

- Public: `/`, `/companies`, `/about`, `/roadmap`
- Authenticated app: `/app/*` (tracking, diffs, settings)

## Repo layout

```text
apps/
  web/        # Next.js (marketing + app)
  api/        # FastAPI (auth + REST)
  worker/     # Celery workers (jobs, fetch/diff/summarize/notify)
infra/
  railway/    # Railway deployment notes + env templates
scripts/      # ops scripts (migrate/backup/restore)
SPEC.md
PLAN.md
```

## Prerequisites

- Node.js (LTS recommended) + npm
- Python 3.13+
- Docker (for Postgres + Redis)

## Quickstart (local dev)

1) Start dependencies:

```bash
make dev-up
```

Default dev ports:

- Postgres: `localhost:54321` (db/user/pass: `inplain` / `inplain` / `inplain`)
- Redis: `localhost:6380`

2) Web:

```bash
make dev-web
```

3) API:

```bash
make venv
make migrate
make dev-api
```

Optional: seed demo data (local/dev only). Run the API with dev auth bypass enabled, then seed:

```bash
# terminal A
DEV_AUTH_BYPASS=1 make dev-api

# terminal B
make seed
```

4) Worker (optional; only needed if `ENQUEUE_JOBS=1`):

```bash
make dev-worker
```

## Golden commands

```bash
make lint
make test
make typecheck
```
