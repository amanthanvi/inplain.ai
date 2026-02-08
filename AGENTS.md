# AGENTS — inplain.ai

Read-first:

- `SPEC.md` (contract)
- `PLAN.md` (execution + progress log)
- `README.md` (onboarding + golden commands once scaffolded)

## Global rules

This repo follows Aman’s global agent rules at:

- `/Users/amanthanvi/GitRepos/_factory/agent-scripts/AGENTS.MD`

If local instructions conflict with global instructions, follow global unless explicitly overridden by the user.

## Project intent

Inplain.ai tracks, diffs, and summarizes public privacy policy changes with citation-backed provenance.

Current direction:

- Implement `SPEC.md` v0.2.0 (Postgres-only storage, Postgres-based job queue, Server Actions BFF, in-app notifications only, curated catalog only).

## Work style (enforced)

- Small/medium diffs.
- Conventional Commits.
- Commit + push frequently on the active branch (`refresh`) when asked (user has asked in this project).
- No drive-by refactors / mass formatting / mass renames.
- Update `SPEC.md` when implementation forces a change; log it in `PLAN.md`.

## Repo layout (target)

Planned structure (see `PLAN.md`):

```text
apps/
  web/        # Next.js (marketing + app)
  api/        # FastAPI (internal)
  worker/     # Python worker (scheduler + executors)
infra/
  railway/    # deployment notes + env templates
scripts/      # ops scripts (backup/restore/seed)
catalog.json
SPEC.md
PLAN.md
```

## Golden commands policy

Do not invent commands. Only run commands that are:

- defined in `Makefile`, `package.json` scripts, CI workflows, or `README.md`, or
- standard tooling invoked by those commands.

When adding new commands, update `README.md` and/or `Makefile` in the same change.

## Secrets / env

- Never commit secrets.
- Prefer `.env.example` templates.
- Web → FastAPI calls use `INTERNAL_SERVICE_TOKEN` on a private network in production (per SPEC).

