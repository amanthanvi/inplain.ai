# Inplain.ai

Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries.

## Status

Clean-slate rebuild in progress. `SPEC.md` is the contract; `PLAN.md` is the execution log.

## Spec

Full product spec: [`SPEC.md`](SPEC.md) (v0.2.0, 14 sections + 3 appendices).

## Plan

Execution plan: [`PLAN.md`](PLAN.md).

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
```
