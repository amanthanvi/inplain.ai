# AGENTS — inplain.ai

## Read-first files (in order)

- `SPEC.md` (contract)
- `PLAN.md` (execution + progress log)
- `README.md` (onboarding + golden commands)

## Respect hierarchy (global rules)

This repo follows Aman’s global agent rules at:

- `/Users/amanthanvi/GitRepos/_factory/agent-scripts/AGENTS.MD`

These project rules supplement (not replace) the global rules. If they conflict, follow global unless the user explicitly overrides.

## Project intent

Inplain.ai tracks, diffs, and summarizes public privacy policy changes with citation-backed provenance.

## Current direction

- Implement `SPEC.md` v0.2.0 (Postgres-only storage, Postgres-based job queue, Server Actions BFF, in-app notifications only, curated catalog only).

## Architecture summary

- Monorepo with 3 services: `apps/web` (Next.js), `apps/api` (FastAPI), worker runtime in `apps/api/inplain/worker/`
- Storage: Postgres only (no Redis required for core queueing)
- Deploy target: Railway (private network; migrations on deploy)

## Golden commands

- `make dev-up` / `make dev-down` (local Postgres)
- `make dev-api` / `make dev-web` / `make dev-worker` (run services)
- `make migrate` (Alembic)
- `make lint` / `make test` / `make typecheck` (gate)

## Work style (enforced)

- Small/medium diffs; no drive-by refactors, mass formatting, or mass renames.
- Conventional Commits; commit + push frequently on `refresh` when asked.
- Stage explicit paths; no `git add -A`.
- Update `SPEC.md` when implementation forces a change; log it in `PLAN.md`.

## Secrets / env

- Never commit secrets.
- Prefer `.env.example` templates.
- Web → FastAPI calls use `INTERNAL_SERVICE_TOKEN` (private network in production).

## Key constraints

- Keep files <500 LOC (split if larger).
- No new deps without a quick health check.
- Add tests with each feature/bugfix; keep critical paths ~70%+ covered.

## Testing

- Integration-first: pytest + FastAPI `TestClient`, DB-backed where needed.
- Run `make test` before committing.

## Deployment

- Railway deploy; Alembic migrations run on deploy.
- Blue-green strategy planned (see SPEC/PLAN).

## Do NOT

- Invent commands not in `Makefile`/`README`/CI.
- Commit secrets.
- Skip tests on behavior changes.
