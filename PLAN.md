# PLAN — Inplain.ai v0.1.0

Last updated: 2026-01-10

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

- [x] Clerk JWT verification + authz guards (user-owned; admin pending)
- [x] Standard error format, rate limiting hooks, CORS
- [x] Entities + Documents core endpoints + check-now enqueue
- [x] Read-only ChangeEvent endpoints + export gates
- [x] Webhooks: Clerk + idempotency (`webhook_events`)
- [x] Webhooks: Stripe + idempotency (`webhook_events`)
- [x] Admin endpoints: jobs list + retry, user ban/plan override

Acceptance:
- API supports the primary journeys (A–D) using only documented endpoints.

### M3 — Background system (Celery/Redis + scheduler)

- [x] Celery queues/routing/retry policies + `jobs` DB visibility
- [x] Scheduler service using `FOR UPDATE SKIP LOCKED` (SPEC 17.3)
- [x] Dead-letter semantics (`jobs.status=dead`)

Acceptance:
- Scheduler can drive periodic fetches without duplicate work.

### M4 — Fetch → extract → normalize → diff pipeline

- [x] SSRF + redirect re-validation + content-type allowlist
- [x] robots.txt caching + block semantics
- [x] Conditional GET (ETag/Last-Modified); 304 is no-op update
- [x] HTML extraction + canonicalization rules (extract versioning)
- [x] PDF extraction (OCR fallback pending)
- [x] Iframe resolution (src-first; render fallback pending)
- [x] Snapshot raw storage to S3/R2 (gzip; `raw_storage_key` persisted when configured)
- [x] Meaningful change thresholds; diff generation + structured hunks

Acceptance:
- For a known test URL, system produces snapshots, detects changes, and generates hunks suitable for citations.

### M5 — AI summaries (OpenRouter) + metering

- [x] Prompt v1 JSON schema; strict validation
- [x] Citation validation (quote must exist in referenced hunk)
- [x] Quota enforcement + provider_usage metering + caching
- [x] Golden test fixtures for summarizer (unit tests)

Acceptance:
- Summaries are grounded, cite real text, and fail open (diff still visible).

### M6 — Notifications + billing + web UI + ops hardening

- [ ] Postmark: immediate + daily digest + unsubscribe (daily digest + prefs implemented; provider env vars pending)
- [ ] Stripe Checkout + Portal + downgrade policy; update Clerk metadata
- [ ] Web app: onboarding, dashboard, diff viewer (section-first), citations UX, settings/billing meters
- [ ] Admin UI: jobs, users, abuse, LLM usage, impersonation banner + audit
- [ ] Observability: Sentry (web/api/workers), OTLP traces/metrics, structured logs (web Sentry + Python OTLP scaffolded; env vars pending)
- [ ] Backups + restore scripts + retention cleanup job (backup/restore scripts + GH nightly workflow + retention cleanup job wired; S3 creds pending)
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
- 2026-01-09: Postmark notify job pipeline added (writes `notifications` + provider_usage).
- 2026-01-09: Add `/v1/me`, `/v1/entities/{entityId}/documents` (list), and `/v1/documents/{documentId}` endpoints for web app wiring.
- 2026-01-09: Web app scaffolded (onboarding via Entities → Documents; document history + diff viewer).
- 2026-01-09: Enforce entitlements on document creation; add Stripe checkout/portal + Stripe webhook sync to entitlements and Clerk metadata.
- 2026-01-09: Add unsubscribe token + `/v1/unsubscribe`; suppress immediate emails when unsubscribed or over quota.
- 2026-01-09: Admin endpoints added (`/v1/admin/jobs`, retry, user ban/plan override).
- 2026-01-09: Railway infra created (project + Postgres/Redis + web/api/worker/scheduler) + production/development deploys; migrations run in both envs.
- 2026-01-09: Fix Railway DB URL driver mismatch (`postgresql://` → `postgresql+psycopg://`) and Alembic URL normalization for remote migrations.
- 2026-01-10: Add S3/R2 raw snapshot uploads (`raw_storage_key`) + retention cleanup job (deletes S3 objects + dependent rows).
- 2026-01-10: Add Playwright renderer (`render` queue) with SSRF route blocking + quota gating.
- 2026-01-10: Add Sentry wiring (api/workers) + backup/restore scripts; deploy all services incl. new `renderer` to Railway.
- 2026-01-10: Implement daily digest scheduling + notification preferences (global + per-document) and wire into web Settings + Document pages.
- 2026-01-10: Enforce tier-based snapshot retention using `history_retention_days` entitlement limit.
- 2026-01-10: Add web Sentry config + Python OpenTelemetry (OTLP) scaffold; add GitHub Actions nightly Postgres backup workflow.
- 2026-01-10: Set Clerk env vars + enable daily digest flag in Railway; redeploy all services in production and development.
