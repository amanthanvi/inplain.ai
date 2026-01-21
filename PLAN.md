# PLAN — Inplain.ai v0.1.0

Last updated: 2026-01-21

North star: production-ready SaaS that tracks public privacy/ToS URLs over time, detects meaningful changes, shows a readable diff, and generates AI summaries **with citations**.

## Working agreements (locked)

- Small/medium diffs only.
- Commit + push frequently on branch `refresh` (Conventional Commits).
- No drive-by refactors; only what unblocks `v0.1.0`.
- SPEC is the contract; update `SPEC.md` when implementation decisions force it.

## Decisions (approved)

- Web frontend: **single Next.js app** (marketing + authenticated app).
- Fetch pipeline: **HTTP-first** (`httpx`) + extraction (`trafilatura`/`readability`), with **isolated Playwright renderer** service (no Scrapy in `v0.1.0`).
- Data model: add `users.stripe_customer_id` for stable Stripe↔Clerk mapping.
- Spec hygiene: fix section numbering collision in API/UI/UX sections.
- Email: **disabled by default** (Postmark deferred for cost).
- Billing: **Clerk Billing** (`<PricingTable />`) for v0.1.0.
- Backups: nightly `pg_dump` via GitHub Actions artifact (no S3 required).
- Reference UX target: `https://inplain.vercel.app/` (marketing pages + public companies directory + company pages).
- Tracking surface: **curated companies only** (no custom URL / user-uploaded entities).

## Remaining manual ops (needed for real prod)

- [ ] Cloudflare DNS: point `inplain.ai` and `www.inplain.ai` to Railway (custom domains already created in Railway).
- [ ] Clerk prod: confirm allowed origins / redirect URLs include `https://inplain.ai` + `https://www.inplain.ai`.
- [ ] Clerk Billing: create Free/Pro/Business plans and verify upgrade/downgrade flows.
- [ ] Rotate any secrets that were pasted into chats/logs during setup.

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
- [x] Minimal seed/dev helpers

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

- [x] Email notifications: **disabled by default** (Postmark deferred); prefs + unsubscribe remain
- [x] Billing UI: Clerk Billing `<PricingTable />` on Settings (plans TBD in Clerk)
- [x] Web app: onboarding, dashboard, diff viewer + citations + export links
- [x] Admin UI: jobs, users, abuse dashboard, LLM usage (audit log written for sensitive actions)
- [ ] Observability: defer Sentry + OTLP (Railway logs only for now)
- [x] Backups: nightly `pg_dump` via GitHub Actions artifact + restore script
- [ ] Launch readiness checklist gates (SPEC 20.x)

Acceptance:
- `v0.1.0` passes SPEC launch checklists; staging → prod playbook documented.

### M7 — UX parity (marketing + companies directory)

- [x] Update marketing IA: Home / Companies / Roadmap / About.
- [x] Add public Companies directory (search/filter) + per-company page (`/[slug]`).
- [x] Implement “Watch changes” → creates tracked company + documents in `/app`.
- [x] Add missing “current policy / versions” UX (requires snapshot endpoints).
- [x] Remove custom URL / manual entity+document creation flows (curated directory only).
- [x] Polish: terminology (“Companies” vs “Entities”) and error states.

Acceptance:
- A new visitor can browse `Companies` publicly, sign up, watch a company, and land in a functional `/app` experience without server-side exceptions.

### M8 — App stability + curated-only enforcement

- [ ] Stabilize `/app/*` so it never bricks into generic Next.js digest pages:
  - [ ] Catch + render safe error states (API down, 5xx, misconfig) with retry CTAs
  - [ ] Improve server-side logging for actionable debugging (no secrets)
- [ ] Replace generic create endpoints with curated-only watch flows:
  - [ ] API: add `POST /v1/companies/{companySlug}/watch` (creates tracked entity + curated documents idempotently)
  - [ ] Web: update “Watch changes” to call the watch endpoint (no client-supplied URLs)
  - [ ] API: restrict `POST /v1/entities` and `POST /v1/entities/{entityId}/documents` to admin/internal use
- [ ] App UX becomes company-first:
  - [ ] `/app` shows tracked companies + recent activity (or redirects to tracking view)
  - [ ] Add “Unwatch” flow (soft-delete tracked company + docs) with confirmation

Acceptance:
- A signed-in user can always reach `/app`, `/app/entities`, `/app/settings` without server-side exceptions.
- Users cannot create arbitrary entities/documents; only curated companies can be tracked.

### M9 — Billing (Clerk Billing) readiness

- [ ] Clerk Billing plans created (Free/Pro/Business) + `<PricingTable />` renders without errors
- [ ] Web gating uses Clerk Billing `has()` / `<Protect />` where appropriate
- [ ] API entitlement enforcement verified against real paid tiers (doc limits, schedule tiers, JS render quota, AI summaries)

Acceptance:
- Upgrades/downgrades change entitlements and are reflected in both UI and API behavior.

### M10 — Launch readiness closeout

- [ ] Runbooks updated (deploy, rollback, incident basics)
- [ ] Backup + restore drill documented and performed once
- [ ] DNS + Clerk origins verified on `https://inplain.ai` + `https://www.inplain.ai`
- [ ] Rotate any secrets that were pasted into chats/logs during setup

Acceptance:
- `SPEC.md` launch checklists are all green (or explicitly deferred with rationale).

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
- 2026-01-10: Provision fresh Railway project (`inplain-ai-v0-1-0`) with production+development; deploy all services; set Clerk env vars + create `inplain` JWT template (aud=`inplain`); enable job processing + daily digest; install Playwright Chromium in renderer.
- 2026-01-20: Disable email delivery (Postmark deferred); add Clerk Billing PricingTable; add export endpoints + admin dashboards; set OpenRouter keys; update backups workflow to GitHub artifacts; deploy to Railway.
- 2026-01-21: Add Railway custom domains for `web` in production (`inplain.ai`, `www.inplain.ai`) to resolve Clerk `origin_invalid` on `*.up.railway.app` domains.
- 2026-01-21: Fix API 500s from Pydantic v2 alias validation; remove deprecated Next `middleware.ts` in favor of `proxy.ts` so Clerk middleware runs in production.
- 2026-01-21: Add global Next.js error boundary + stronger API config error messages to prevent “defunct” digests from bricking the app.
- 2026-01-21: Upgrade marketing homepage + companies directory UI (reference parity), expand curated company catalog, and add per-company “All policies” page.
- 2026-01-21: Harden app create flows for idempotency (409 duplicate entity/document redirects) and consolidate app navigation into the main header.
- 2026-01-21: Remove custom URL / manual entity+document creation from the app; tracking is via curated Companies directory only.
