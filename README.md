# Inplain.ai

Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries.

Source of truth: `SPEC.md`.

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

2) Web:

```bash
make dev-web
```

3) API:

```bash
make venv
make dev-api
```

## Golden commands

```bash
make lint
make test
make typecheck
```
