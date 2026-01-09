# PLAN — Inplain.ai v0.1.0

Last updated: 2026-01-09

North star: production-ready SaaS that tracks public privacy/ToS URLs over time, detects meaningful changes, shows a readable diff, and generates AI summaries **with citations**.

## Working agreements (locked)

- Small/medium diffs only.
- Commit + push frequently on branch `refresh` (Conventional Commits).
- No drive-by refactors; only what unblocks `v0.1.0`.
- SPEC is the contract; update `SPEC.md` when implementation decisions force it.

## Decisions (approved)

- Web frontend: **single Next.js app** (marketing + authenticated app) + TanStack Query.
- Fetch pipeline: **HTTP-first** (`httpx`) + extraction (`trafilatura`/`readability`), with **isolated Playwright renderer** service (no Scrapy in `v0.1.0`).
- Data model: add `users.stripe_customer_id` for stable Stripe↔Clerk mapping.
- Spec hygiene: fix section numbering collision in API/UI/UX sections.

## Milestones

### M0 — Repo bootstrap (golden commands + CI skeleton)

- [x] Create monorepo structure from SPEC 15.1
- [x] Add `README.md` + `CONTRIBUTING.md`
- [x] Add local dev env (`docker-compose.yml`: postgres, redis, (optional) s3/minio)
- [x] Define golden commands (lint/typecheck/test/dev/migrate) in Makefile/scripts
- [x] Add GitHub Actions workflow(s): lint, typecheck, tests, migrations check

Acceptance:
- A new dev can run one documented setup path and get `web` + `api` up locally.
- CI runs on push and executes the same golden commands.

### M1 — Database + migrations

- [x] Implement schema from SPEC 8.x (+ `stripe_customer_id`)
- [x] Alembic migrations; deterministic revision history
- [ ] Minimal seed/dev helpers

Acceptance:
- `alembic upgrade head` creates full schema; tests can run against a fresh DB.

### M2 — API core (FastAPI)

- [ ] Clerk JWT verification + authz guards (user-owned + admin)
- [ ] Standard error format, rate limiting hooks, CORS
- [ ] Entities + Documents CRUD + Check-now enqueue
- [ ] Read-only ChangeEvent endpoints + export gates
- [ ] Webhooks: Clerk + Stripe + idempotency (`webhook_events`)
- [ ] Admin endpoints: jobs list + retry, user ban/plan override

Acceptance:
- API supports the primary journeys (A–D) using only documented endpoints.

### M3 — Background system (Celery/Redis + scheduler)

- [ ] Celery queues/routing/retry policies + `jobs` DB visibility
- [ ] Scheduler service using `FOR UPDATE SKIP LOCKED` (SPEC 17.3)
- [ ] Dead-letter semantics (`jobs.status=dead`)

Acceptance:
- Scheduler can drive periodic fetches without duplicate work.

### M4 — Fetch → extract → normalize → diff pipeline

- [ ] SSRF + redirect re-validation + content-type allowlist
- [ ] robots.txt caching + block semantics
- [ ] Conditional GET (ETag/Last-Modified); 304 is no-op update
- [ ] HTML extraction + canonicalization rules (extract versioning)
- [ ] PDF extraction + OCR fallback
- [ ] Iframe resolution (src-first → render fallback)
- [ ] Snapshot storage (raw to S3/R2; extracted in Postgres)
- [ ] Meaningful change thresholds; diff generation + structured hunks

Acceptance:
- For a known test URL, system produces snapshots, detects changes, and generates hunks suitable for citations.

### M5 — AI summaries (OpenRouter) + metering

- [ ] Prompt v1 JSON schema; strict validation
- [ ] Citation validation (quote must exist in referenced hunk)
- [ ] Quota enforcement + provider_usage metering + caching
- [ ] Golden test fixtures for summarizer (unit tests)

Acceptance:
- Summaries are grounded, cite real text, and fail open (diff still visible).

### M6 — Notifications + billing + web UI + ops hardening

- [ ] Postmark: immediate + daily digest + unsubscribe
- [ ] Stripe Checkout + Portal + downgrade policy; update Clerk metadata
- [ ] Web app: onboarding, dashboard, diff viewer (section-first), citations UX, settings/billing meters
- [ ] Admin UI: jobs, users, abuse, LLM usage, impersonation banner + audit
- [ ] Observability: Sentry (web/api/workers), OTLP traces/metrics, structured logs
- [ ] Backups + restore scripts + retention cleanup job
- [ ] Launch readiness checklist gates (SPEC 20.x)

Acceptance:
- `v0.1.0` passes SPEC launch checklists; staging → prod playbook documented.

## Progress log (append-only)

- 2026-01-09: plan approved; starting M0.
- 2026-01-09: repo scaffolded (Next.js web, FastAPI api skeleton, CI, Makefile golden commands).
- 2026-01-09: Postgres schema implemented + Alembic init migration; local dev ports standardized (Postgres 54321, Redis 6380).
- 2026-01-09: `/v1/entities` and `/v1/entities/{entityId}/documents` endpoints wired (dev auth bypass mode only for now).
- 2026-01-09: Clerk wired (Next.js App Router integration + API JWT verification + Clerk webhook endpoint skeleton).
- 2026-01-09: Worker pipeline upgraded (robots + extraction + PDF + iframe attempts) and OpenRouter summarizer job added (citation validation + provider_usage metering).
