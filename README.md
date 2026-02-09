# Inplain.ai

Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries.

## Status

v0.1.0 internal review package is the current target. `SPEC.md` is the contract; `PLAN.md` is the execution log.

## Spec

Full product spec: [`SPEC.md`](SPEC.md) (v0.2.0, 16 sections + 4 appendices).

## Plan

Execution plan: [`PLAN.md`](PLAN.md).

## Review runbook

Internal v0.1.0 reviewer checklist: [`docs/v0.1.0-review-runbook.md`](docs/v0.1.0-review-runbook.md).

## Quickstart (local dev)

Prereqs:
- Node.js + npm
- Python 3.13+
- Docker (for Postgres + Redis)

Start dependencies:
```bash
make dev-up
```

Bootstrap Python env:
```bash
make venv
make migrate
```

Optional (needed for JS-render fallback in the worker): install Playwright browsers.

Env templates:
- `apps/api/.env.example`
- `apps/web/.env.example`

Run services:
```bash
make dev-api
make dev-web
```

Golden commands:
```bash
make lint
make test
make typecheck
make catalog-validate
```
