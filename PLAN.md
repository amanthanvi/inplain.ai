# PLAN — Inplain.ai v0.1.0 (SPEC v0.2.0)

Last updated: 2026-02-08

North star: production-ready web app that monitors public privacy/ToS pages (curated catalog only), detects meaningful changes, shows a readable diff, and generates AI summaries **with citations** that link to exact diff hunks.

Source of truth: `SPEC.md` (currently v0.2.0, 2026-02-07). This plan implements the SPEC; if implementation forces a decision/change, update `SPEC.md` and record it in the progress log here.

## Working agreements (locked)

- Small/medium diffs only.
- Commit + push frequently on branch `refresh` (Conventional Commits).
- No drive-by refactors; only changes that advance this plan.
- Keep docs in sync: `SPEC.md` (contract) + `PLAN.md` (execution log) + `README.md` (onboarding).

## Release definition (v0.1.0)

v0.1.0 is “review-ready” when:

- SPEC acceptance criteria AC-1…AC-7 are implemented and pass locally (or in CI where applicable).
- Core pipeline works end-to-end on at least one known public document URL: fetch → extract → snapshot → diff → summarize → notify.
- UI supports the primary flows in SPEC 2.2 (watch, see pending first snapshot, view change events, click citations).
- CI is green and runs the repo’s golden commands.
- Minimal ops docs exist (Railway + env templates + backup/restore).

## Milestones

### M0 — Baseline (clean-slate)

- [x] Commit clean-slate teardown baseline (docs preserved, old code removed from working tree).

Acceptance:
- Repo state is intentional: only docs remain in the working tree; old implementation stays available via git history.

### M1 — Repo scaffold (golden commands + CI skeleton)

- [x] Recreate monorepo structure per SPEC 8.7:
  - `apps/web` (Next.js App Router + TypeScript)
  - `apps/api` (FastAPI internal service)
  - `apps/worker` (Python worker: scheduler + executors)
  - `catalog.json`, `docker-compose.yml`, `infra/railway`, `scripts/*`
- [x] Add `Makefile` golden commands: `dev-up`, `dev-web`, `dev-api`, `dev-worker`, `migrate`, `lint`, `test`, `typecheck`.
- [x] Add CI workflows: lint/typecheck/tests; scheduled Postgres backup artifact.
- [x] Add `CONTRIBUTING.md` + minimal env templates.

Acceptance:
- A new dev can run one documented setup path and boot `web` + `api` locally.
- CI runs the same golden commands used locally.

### M2 — Database schema + migrations (SPEC 4.2)

- [x] Implement Alembic migrations for the 7-table schema:
  - `entities`, `documents`, `snapshots`, `diffs`, `change_events`, `jobs`, `notifications`
- [x] Indexes match SPEC (incl. scheduler/unread indexes).
- [x] `catalog.json` seed via idempotent upsert-by-slug migration step.

Acceptance:
- `alembic upgrade head` creates the full schema on a fresh DB.
- Catalog entities appear in `entities` after migration/seed.

### M3 — API (FastAPI internal, SPEC 4.3)

- [x] Internal-only FastAPI endpoints (no public client access):
  - `/healthz`
  - `/internal/entities`, `/internal/entities/{slug}`
  - `/internal/documents/*` (watch/unwatch/list/detail/check-now)
  - `/internal/change-events/*` (list/detail)
  - `/internal/notifications/*` (list/unread-count/mark-read)
  - `/internal/webhooks/clerk` (Svix verification)
  - `/internal/admin/jobs*` (admin only)
- [x] Auth model: service token between Next.js Server Actions and FastAPI; row-level access by `clerk_user_id` (SPEC 5.1).
- [ ] Standard error format (SPEC 4.3).

Acceptance:
- Endpoints exist and enforce row-level isolation by `clerk_user_id`.

### M4 — Job queue + worker runtime (Postgres SKIP LOCKED, SPEC Appendix B)

- [x] Implement `jobs` claiming loop per queue (`fetch`, `render`, `diff`, `summarize`, `notify`, `cleanup`).
- [x] Scheduler loop (every 60s) enqueues due documents; dedupes; sets next check.
- [x] Retry/backoff + dead-letter semantics per SPEC 6.3 (baseline backoff; refined per-queue later).
- [x] Stale-lock cleanup (`running` + `locked_at` too old → requeue).

Acceptance:
- Due documents reliably enqueue fetch jobs without duplication.
- Workers can claim, run, and transition jobs correctly under concurrency.

### M5 — Fetch/extract/snapshot pipeline (SPEC FR-3, 4.4, 5.5)

- [x] SSRF defenses + redirect re-validation (SPEC 5.5).
- [ ] robots.txt checks cached in Redis (SPEC 4.4). (Implemented in-memory cache first.)
- [x] Conditional GET (ETag/Last-Modified).
- [ ] Extraction:
  - [x] HTML: `trafilatura` (post-processing for cosmetic noise).
  - [x] PDF: `pypdf` + OCR fallback when needed (best-effort; requires `pdftoppm` + `tesseract`).
- [x] Snapshot storage in Postgres (TOAST; no object storage in v0.2.0).
- [ ] Render fallback via Playwright when HTTP extraction yields minimal text. (Fetch enqueues `render`; handler pending.)

Acceptance:
- For known test URLs, snapshots are created with stable extracted text + sha256.

### M6 — Change detection + diffs + change events (SPEC FR-4/5/6)

- [ ] Tiered change detection gates:
  - hash gate
  - ratio gate
  - cosmetic strip
  - cheap LLM classify for ambiguous changes
  - meaningful change → proceed
- [ ] Diff generation (`diff-match-patch`) → structured hunks (`hunkId`, added/removed/context).
- [ ] Create `change_events` with summary status (`pending`/`completed`/`failed`/`skipped_quota`).

Acceptance:
- A meaningful change produces a stored diff with stable `hunkId`s.

### M7 — Summaries + notifications (SPEC FR-6/7)

- [ ] OpenRouter summarizer with fallback chain (SPEC Appendix C).
- [ ] Strict JSON schema output + runtime citation validation.
- [ ] Quota enforcement (tier-based); summary skip when over quota (diff still available).
- [ ] In-app notification record created per meaningful change event.

Acceptance:
- Meaningful changes result in: diff + summary (or quota-skip) + notification.

### M8 — Web app (Next.js, progressive auth, diff viewer)

- [ ] Routes per SPEC 2.4:
  - Public: `/`, `/companies`, `/companies/[slug]`, `/pricing`, `/about`
  - Protected: `/dashboard`, `/settings`
- [ ] Server Actions BFF calling internal FastAPI via service token.
- [ ] Watch flow: signed-out → Clerk auth → returns to company page with tracking active (SPEC AC-1).
- [ ] Company page: current policy text, change timeline, summary + citations.
- [ ] Diff viewer: citation click scroll/expand/highlight (SPEC AC-3).
- [ ] Notification bell: unread badge + feed; poll unread count every 60s.

Acceptance:
- SPEC AC-1…AC-3 implemented end-to-end in the UI.

### M9 — Billing + entitlements (Clerk Billing)

- [ ] Server Actions enforce tier entitlements via Clerk `has()` (doc limits, quotas).
- [ ] Settings page shows usage meters + upgrade CTAs.

Acceptance:
- SPEC AC-4 enforced (Free tier doc limit blocks 4th watch).

### M10 — Testing + ops + release readiness

- [ ] Tests per SPEC 10.2 (integration-heavy):
  - API tests
  - worker pipeline tests (mock OpenRouter)
  - job queue claiming tests
  - SSRF + citation validation unit tests
- [ ] CI green (lint/typecheck/tests).
- [ ] Backup workflow + restore script documented and runnable.
- [ ] Minimal runbooks / env templates for Railway.

Acceptance:
- SPEC AC-5…AC-7 covered with tests and/or reproducible local steps.
- v0.1.0 review package complete.

## Progress log (append-only)

- 2026-02-08: Approved. Committed clean-slate teardown baseline on `refresh`.
- 2026-02-08: Scaffolded monorepo + CI + golden commands (web/api skeletons; env templates).
- 2026-02-08: Implemented initial Postgres schema + Alembic migration; `catalog.json` seeds `entities` via upsert.
- 2026-02-08: Implemented internal FastAPI endpoints + service-token auth skeleton (entities/documents/change events/notifications/admin).
- 2026-02-08: Implemented Postgres job queue + scheduler loops (SKIP LOCKED claim, retries, stale-lock cleanup).
- 2026-02-08: Implemented fetch→extract→snapshot pipeline (HTTP + trafilatura; PDF via pypdf; conditional GET; SSRF + robots).
