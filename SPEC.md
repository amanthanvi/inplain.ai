# Inplain.ai — SPEC (v0.2.0)

"Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries."

> **v0.2.0**: Clean-slate redesign. Replaces v0.1.0-rev1. Simplified architecture: Postgres-only storage, Postgres-based job queue, Server Actions BFF, in-app notifications only. All decisions from 9 interview rounds incorporated.

## Table of Contents

0. [Metadata](#0-metadata)
1. [Executive Summary](#1-executive-summary)
2. [Users & UX](#2-users--ux)
3. [Functional Requirements](#3-functional-requirements)
4. [System Design](#4-system-design)
5. [Security, Privacy, Compliance](#5-security-privacy-compliance)
6. [Reliability & Failure Modes](#6-reliability--failure-modes)
7. [Observability & Ops](#7-observability--ops)
8. [Rollout, Migration, Compatibility](#8-rollout-migration-compatibility)
9. [Billing & Entitlements](#9-billing--entitlements)
10. [Testing & Acceptance Criteria](#10-testing--acceptance-criteria)
11. [Dependencies & Integrations](#11-dependencies--integrations)
12. [Decision Log](#12-decision-log)
13. [Assumptions, Open Questions, Risks](#13-assumptions-open-questions-risks)
14. [Legal/Safety UX Copy](#14-legalsafety-ux-copy)
A. [Catalog JSON Schema](#appendix-a--catalog-json-schema)
B. [Job Queue Schema](#appendix-b--job-queue-schema-skip-locked)
C. [Default Config Values](#appendix-c--default-config-values)

---

## 0) Metadata

- **Title**: Inplain.ai — Privacy Policy Change Tracker
- **Owner (DRI)**: Aman Thanvi (@amanthanvi)
- **Status**: Implementing
- **Last updated**: 2026-02-08
- **Spec version**: v0.2.0
- **License model**: Source-available (code inspectable/contributable; full platform monetized)
- **Links**:
  - Repo: `github.com/amanthanvi/inplain.ai`
  - Production: `inplain.ai`

---

## 1) Executive Summary

### 1.1 What we're building

A web app that monitors public privacy policies and terms of service, detects meaningful changes, produces readable diffs, and generates AI summaries explaining **what changed**, **why it matters**, with **citation-backed provenance** linking to exact changed passages.

### 1.2 Problem statement / why now

Privacy policies change without notice, are unreadable, and no tool makes changes accessible to non-lawyers. Existing solutions (ToS;DR, Visualping) either rely on volunteer curation or lack AI-powered interpretation.

### 1.3 Success metrics (activation-focused)

- **Primary KPI**: % of sign-ups who watch ≥1 entity within 7 days → target **40%**
- **Secondary KPI**: % of change events where user views the summary → target **60%**
- **Guardrail**: p95 pipeline latency < 5 min (fetch → summary available)
- **"Done means"**: A user can watch a company, receive a change notification in-app, view an AI summary with citations that link to the exact diff hunk

### 1.4 Non-goals / out of scope (v0.2.0)

1. Not a legal compliance product (no legal opinions or guarantees)
2. No authenticated/behind-login document monitoring (public URLs only)
3. No browser extension
4. No email notifications (in-app only; email deferred to v0.3)
5. No Slack/Teams/webhook notifications
6. No full-text search across snapshots
7. No enterprise SSO / SCIM / organizations
8. No custom URL tracking (curated catalog only)
9. No admin UI (DB queries + Clerk admin role for ops)

---

## 2) Users & UX

### 2.1 Personas

1. **Privacy-conscious user**: Tracks apps/services they use; wants plain-language summaries of changes
2. **Founder / PM**: Tracks competitors' privacy/ToS changes; wants quick "why it matters" alerts
3. **Developer / Security engineer**: Needs diffs and citations; may export data
4. **Admin (internal)**: Monitors system health, jobs, failures via DB + Railway console

### 2.2 Primary flows

#### Flow A — Sign up and watch first company

1. User lands on marketing page or browses `/companies` directory
2. Clicks "Watch changes" on a company
3. Clerk auth (email magic link) → returned to company page
4. System creates tracked entity, adds curated documents (Privacy/ToS/Cookie)
5. Initial snapshot job enqueued; UI shows "First snapshot pending..."
6. First snapshot completes; user sees current policy text

#### Flow B — Change detected → diff + summary + notification

1. Scheduled worker fetches URL → trafilatura extracts text → change detected
2. diff-match-patch computes word-level diff; tiered pipeline classifies change
3. OpenRouter generates AI summary with citations
4. Change event created; in-app notification created
5. User sees unread badge → opens notification → views AI summary → clicks citation → auto-scrolls to diff hunk

#### Flow C — On-demand check

1. User clicks "Check now" (within tier quota)
2. Job enqueued; UI shows spinner
3. Results appear; if no meaningful change, "No changes detected" toast

#### Flow D — Unwatch

1. User clicks "Stop tracking" on a company
2. Confirmation modal: "Stop tracking [Company]? This will remove X policies and their history."
3. Soft-delete cascades; data retained per tier retention policy

### 2.3 UX states checklist

- **Loading**: Skeleton screens for policy text and diff viewer; spinner for on-demand checks
- **Empty**: "No changes detected yet" with clear explanation; "First snapshot pending..." for new watches
- **Error**: "Last check failed" with error category (timeout, blocked, parse error); user can retry via "Check now"
- **Permission denied**: Clerk `<SignedIn>`/`<SignedOut>` gating; upgrade CTAs for tier-limited features
- **Offline/degraded**: Standard browser offline handling; no PWA in v0.2.0
- **Accessibility**: Semantic HTML, ARIA labels on diff viewer, keyboard-navigable citation links

### 2.4 Frontend IA (progressive auth)

Single Next.js app with progressive auth. No separate `/app` route group.

**Public routes**:
- `/` — marketing homepage
- `/companies` — public directory (search + category filter)
- `/companies/[slug]` — company page (public overview, latest policy, change timeline)
- `/pricing`, `/about`

**Protected routes** (Clerk middleware):
- `/dashboard` — user's watched companies
- `/settings` — account, notification preferences, billing

**Auth flow**: `<SignedIn>`/`<SignedOut>` components gate inline content. Watching a company from the public directory triggers Clerk auth if needed, then returns to the company page with tracking active.

**Header nav**:
- Signed out: Home, Companies, Pricing, About | Sign in / Start free
- Signed in: Home, Companies, Dashboard, notification bell (unread badge) | User menu (Settings, Billing, Sign out)

### 2.5 Diff viewer

**Primary view**: AI summary with citations at top. Most users stop here.

**Expanded view**: Section-first collapsed diff.
- Group changes by detected section/heading
- Each section shows heading + change count badge (additions/removals)
- Click to expand → inline word-level diff (diff-match-patch)
- Section detection: heuristic (H1-H6, bold first lines, numbered sections, ALL CAPS) with fallback to paragraph-level grouping
- No LLM-based section detection in v0.2.0 (simplification from v0.1.0)

**Citation navigation**:
- Click citation → smooth scroll to referenced hunk → temporary highlight (fade after 2s) → auto-expand containing section if collapsed

**Toggle modes**: Unified full diff (desktop + mobile), side-by-side (desktop only) as secondary options for power users.

**Engine**: `diff-match-patch` (Google's library) with semantic cleanup. Custom React renderer (~200-300 LOC). No off-the-shelf React diff component (none handle legal prose well).

### 2.6 Company page (`/companies/[slug]`)

Public page with progressive enhancement:
- **Signed out**: Browse company overview, see latest policy text, view change timeline (limited)
- **Signed in**: "Watch changes" button, full history, AI summaries, export

Sections:
- Overview (company info, tracked documents)
- Current Policy (latest extracted snapshot)
- Changes (recent change events with summaries + citations)
- Timeline (chronological list)

---

## 3) Functional Requirements

**FR-1 Authentication & sessions** (MUST)
- Clerk for authentication (identity source of truth)
- Email magic link (passwordless); optional OAuth (Google) later
- No `users` table; Clerk is the user store

**FR-2 Tracking — curated companies only** (MUST)
- Users watch/unwatch companies from curated directory
- Watching creates tracked entity + curated documents (Privacy/ToS/Cookie)
- No custom URL entry in v0.2.0

**FR-3 Fetching & snapshots** (MUST)
- Scheduled + on-demand fetches via Postgres job queue
- HTTP-first (httpx) with conditional GET (ETag/Last-Modified)
- JS rendering via Playwright when HTTP fetch yields minimal text
- PDF extraction: `pypdf` with Tesseract OCR fallback for image-based PDFs
- Text extraction: `trafilatura` only (F1 0.958); ~20 lines post-processing for timestamps/copyright
- Snapshots stored as text in Postgres (TOAST + LZ4 compression)
- No S3/R2 in v0.2.0; migrate to object storage when DB exceeds ~20 GB

**FR-4 Change detection** (MUST)
- Tiered pipeline:
  1. SHA256 hash gate (identical → skip)
  2. SequenceMatcher ratio (below threshold → skip)
  3. Cosmetic pattern strip (timestamps, copyright, counters)
  4. LLM classify via cheap model (~$3/year) for ambiguous changes
  5. Full AI summary for confirmed meaningful changes

**FR-5 Diff viewing** (MUST)
- Pre-computed diffs stored as JSONB in `diffs` table
- Section-first collapsed view with inline word-level diff
- Citation anchors linking summary bullets to diff hunks
- Export: JSON (tier-gated); CSV deferred

**FR-6 AI summaries with provenance** (MUST)
- "What changed" bullet list with citations
- "Why it matters" bullet list with citations
- Every bullet must cite `hunkId` + exact quote from diff
- Runtime citation validation (verify quotes exist as substrings)
- "Not legal advice" disclaimer on every summary
- Summary language matches source language

**FR-7 In-app notifications** (MUST)
- Notification feed accessible from nav bar (unread badge)
- Dropdown panel showing recent notifications
- Poll every 60s for unread count
- Notification created for each meaningful change event

**FR-8 Notifications — email** (SHOULD, deferred)
- Email notifications deferred to v0.3
- Schema supports future email (notification preferences, unsubscribe tokens)

**FR-9 Admin ops** (MUST)
- Clerk admin role (via `publicMetadata`)
- Admin-only FastAPI endpoints: job status/retry, user lookup
- No admin UI; use Railway DB explorer + psql for ad-hoc queries
- No impersonation in v0.2.0

**FR-10 Monetization & quotas** (MUST)
- 3 tiers (Free/Pro/Business) via Clerk Billing (Stripe connected)
- Tier enforcement at Server Action middleware layer using Clerk `has()` helper
- Quota display: usage meters on settings page + in-app banner at 80%+

**FR-11 Safety and legal posture** (MUST)
- Public URLs only (http/https)
- Respect robots.txt; block monitoring if disallowed with clear UI explanation
- Takedown/reporting process for site owners
- "Not legal advice" on every summary and watch flow

---

## 4) System Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client (Browser)                                       │
│  Next.js App (React + TypeScript)                       │
│  Clerk <SignedIn>/<SignedOut> components                 │
└────────────────┬────────────────────────────────────────┘
                 │ Server Actions (BFF)
                 │ Clerk session verification
                 │ Tier enforcement via has()
                 │ hey-api generated client
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Railway Private Network                                │
│                                                         │
│  ┌──────────────┐    service token    ┌──────────────┐  │
│  │  Next.js      │──────────────────→│  FastAPI       │  │
│  │  (public)     │                    │  (internal)    │  │
│  └──────────────┘                    └──────┬────────┘  │
│                                             │           │
│  ┌──────────────┐                    ┌──────▼────────┐  │
│  │  Worker       │◄──── polls ──────│  Postgres      │  │
│  │  (fetch/diff/ │────── writes ───→│  (DB + queue)  │  │
│  │   summarize/  │                    └───────────────┘  │
│  │   render)     │                                      │
│  └──────┬────────┘                    ┌───────────────┐  │
│         │                             │  Redis         │  │
│         └──── cache ────────────────→│  (cache only)  │  │
│                                       └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                 │
                 ▼ External (outbound HTTPS)
    ┌────────┐ ┌────────────┐ ┌──────────┐
    │ Clerk  │ │ OpenRouter  │ │ Target   │
    │ Auth   │ │ LLM API    │ │ Websites │
    └────────┘ └────────────┘ └──────────┘
```

**Railway services** (4 services + 2 add-ons):
1. `web` (public) — Next.js via `next start`
2. `api` (internal, private network) — FastAPI + Uvicorn
3. `worker` (internal) — Python process: scheduler loop + job executor (fetch, render, diff, summarize, notify, cleanup)
4. `postgres` — Railway Postgres (DB + job queue + snapshot storage)
5. `redis` — Railway Redis (caching + robots.txt decisions; NOT for queue)

Key simplifications from v0.1.0:
- No Celery/Beat/Flower → Postgres `SELECT FOR UPDATE SKIP LOCKED` queue
- No S3/R2 → Postgres TOAST compression for snapshot text
- No separate renderer service → same worker process, separate queue with concurrency limits
- No separate scheduler service → worker runs scheduler loop
- FastAPI is internal-only (private network); clients never hit it directly

### 4.2 Data model (7 tables)

No `users` table — Clerk manages identity. `clerk_user_id` is the foreign key across all user-scoped tables.

#### `entities`

Curated catalog items (companies/services).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `slug` | text | Unique, URL-friendly |
| `name` | text | Display name |
| `website_url` | text | Company website |
| `category` | text | e.g., "social_media", "cloud", "finance" |
| `policy_urls` | jsonb | `{"privacy": "https://...", "tos": "https://...", "cookie": "https://..."}` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Indexes: unique(`slug`)

Seeded from `catalog.json` in repo via Alembic migration (upsert by slug). Community contributes new entities via GitHub PRs.

#### `documents`

A tracked URL for a specific user + entity combination.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `clerk_user_id` | text | NOT NULL |
| `entity_id` | uuid | FK → entities |
| `url` | text | |
| `doc_type` | text | `privacy` / `tos` / `cookie` / `other` |
| `status` | text | `active` / `paused` / `blocked_robots` / `error` |
| `schedule_tier` | text | `daily` / `6h` / `1h` |
| `next_check_at` | timestamptz | Used by scheduler |
| `last_checked_at` | timestamptz | |
| `last_snapshot_id` | uuid | Nullable |
| `etag` | text | Nullable, for conditional GET |
| `last_modified` | text | Nullable, for conditional GET |
| `robots_checked_at` | timestamptz | Nullable |
| `robots_status` | text | `unknown` / `allowed` / `disallowed` |
| `robots_rule` | text | Nullable, specific blocking rule (e.g. `Disallow: /privacy`) |
| `created_at` | timestamptz | |
| `deleted_at` | timestamptz | Nullable, soft-delete |

Indexes:
- `(clerk_user_id, entity_id, doc_type)` unique where `deleted_at IS NULL`
- `(next_check_at)` where `status IN ('active','blocked_robots','error') AND deleted_at IS NULL` (scheduler)
- `(clerk_user_id, status)`

#### `snapshots`

Fetched + extracted text for a document at a point in time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `document_id` | uuid | FK → documents |
| `fetched_at` | timestamptz | |
| `fetch_method` | text | `http` / `render` |
| `http_status` | int | |
| `content_type` | text | Nullable |
| `extracted_text` | text | Stored via TOAST + LZ4 |
| `extracted_sha256` | text | |
| `extract_version` | int | Bump when extractor changes |
| `byte_size_extracted` | int | |
| `retention_delete_at` | timestamptz | Tier-based |
| `created_at` | timestamptz | |

Indexes:
- `(document_id, fetched_at DESC)`
- `(retention_delete_at)` (cleanup job)

#### `diffs`

Pre-computed diff between two consecutive snapshots.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `document_id` | uuid | FK → documents |
| `from_snapshot_id` | uuid | FK → snapshots |
| `to_snapshot_id` | uuid | FK → snapshots |
| `diff_hunks` | jsonb | Structured: `[{hunkId, context, added[], removed[], positions}]` |
| `change_score` | numeric | 0..1 |
| `change_classification` | text | `cosmetic` / `meaningful` / `major` |
| `created_at` | timestamptz | |

Indexes:
- unique(`from_snapshot_id`, `to_snapshot_id`)
- `(document_id, created_at DESC)`

#### `change_events`

User-facing change record tying diff + AI summary.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `document_id` | uuid | FK → documents |
| `diff_id` | uuid | FK → diffs |
| `title` | text | Generated, e.g., "Privacy Policy updated" |
| `summary_status` | text | `pending` / `completed` / `failed` / `skipped_quota` |
| `summary_what_changed` | jsonb | Bullets with citations |
| `summary_why_matters` | jsonb | Bullets with citations |
| `summary_model` | text | Nullable |
| `summary_prompt_version` | int | Nullable |
| `summary_error` | text | Nullable |
| `created_at` | timestamptz | |

Indexes:
- `(document_id, created_at DESC)`

#### `jobs`

Postgres-based job queue. Workers poll with `SELECT FOR UPDATE SKIP LOCKED`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `queue` | text | `fetch` / `render` / `diff` / `summarize` / `notify` / `cleanup` |
| `clerk_user_id` | text | Nullable |
| `document_id` | uuid | Nullable FK → documents |
| `status` | text | `queued` / `running` / `succeeded` / `failed` / `dead` |
| `payload` | jsonb | Job-specific data |
| `attempt` | int | Default 0 |
| `max_attempts` | int | Default 5 |
| `error` | text | Nullable |
| `run_at` | timestamptz | For delayed execution |
| `locked_at` | timestamptz | Nullable, set when claimed |
| `started_at` | timestamptz | Nullable |
| `finished_at` | timestamptz | Nullable |
| `created_at` | timestamptz | |

Indexes:
- `(queue, status, run_at)` where `status = 'queued'` (worker polling)
- `(document_id, created_at DESC)`
- `(status, created_at)`

See [Appendix B](#appendix-b--job-queue-schema-skip-locked) for the polling query.

#### `notifications`

In-app notification feed.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `clerk_user_id` | text | NOT NULL |
| `type` | text | `change_detected` / `check_failed` / `system` |
| `title` | text | |
| `body` | text | Short description |
| `payload` | jsonb | Links, entity info, change event ID |
| `read_at` | timestamptz | Nullable |
| `created_at` | timestamptz | |

Indexes:
- `(clerk_user_id, created_at DESC)`
- `(clerk_user_id, read_at)` where `read_at IS NULL` (unread count)

### 4.3 API layer

**Pattern**: Next.js Server Actions (BFF) → FastAPI (internal)

- FastAPI generates OpenAPI spec
- `hey-api/openapi-ts` generates type-safe TypeScript client from spec
- Server Actions call FastAPI via Railway private networking (e.g., `http://api.railway.internal:8000`)
- Client-side code never calls FastAPI directly
- Auth: Server Actions verify Clerk session server-side. Calls to FastAPI use a shared service token (`INTERNAL_SERVICE_TOKEN` env var) + pass `clerk_user_id` as parameter
- FastAPI trusts the service token; enforces row-level access by `clerk_user_id`

**FastAPI endpoints** (internal, not public):

```
GET    /healthz
GET    /internal/entities                    (list catalog)
GET    /internal/entities/{slug}             (catalog detail)
POST   /internal/documents/watch             (create tracked docs for user+entity)
DELETE /internal/documents/{id}              (unwatch)
GET    /internal/documents                   (user's tracked docs)
GET    /internal/documents/{id}              (doc detail)
POST   /internal/documents/{id}/check-now    (enqueue on-demand check)
GET    /internal/snapshots/{id}              (snapshot detail)
GET    /internal/change-events               (user's change events)
GET    /internal/change-events/{id}          (detail with summary + diff)
GET    /internal/notifications               (user's notifications)
POST   /internal/notifications/mark-read     (mark notifications read)
GET    /internal/notifications/unread-count   (polling endpoint)
POST   /internal/webhooks/clerk              (Clerk webhook, signature verified)
GET    /internal/admin/jobs                  (admin only)
POST   /internal/admin/jobs/{id}/retry       (admin only)
```

**Error format**:
```json
{
  "error": {
    "code": "DOCUMENT_LIMIT_EXCEEDED",
    "message": "You've reached your document limit. Upgrade to Pro for 25 documents.",
    "details": { "current": 3, "limit": 3, "tier": "free" }
  }
}
```

### 4.4 Pipeline

```
Scheduler loop (every 60s)
  → SELECT documents WHERE next_check_at <= now() AND no pending job
  → INSERT INTO jobs (queue='fetch')

Worker loop:
  1. FETCH
     - Validate URL (SSRF checks)
     - Check robots.txt (cached 24h per host)
     - HTTP GET with conditional headers (ETag, Last-Modified)
     - If minimal text: enqueue render job (Playwright, same process, concurrency-limited)
     - For PDFs: pypdf extraction; Tesseract OCR fallback if < 500 chars

  2. EXTRACT
     - trafilatura 2.0 (F1 0.958)
     - ~20 lines post-processing: strip timestamps, copyright years, counters
     - Store extracted text → snapshots table (TOAST compressed)

  3. DETECT CHANGE (tiered)
     - SHA256 gate: identical hash → no-op
     - SequenceMatcher ratio: below 0.02 → skip
     - Cosmetic pattern strip: timestamps, "© 2026", counters
     - LLM classify (cheap model) for ambiguous cases (~$3/year)
     - Confirmed meaningful → proceed to diff

  4. DIFF
     - diff-match-patch with semantic cleanup
     - Generate structured hunks as JSONB
     - Store in diffs table

  5. SUMMARIZE (if within quota)
     - OpenRouter API call with structured hunks
     - Primary: Claude Sonnet 4.5
     - Fallback: GPT-5.2 → Gemini 3 Flash
     - Runtime citation validation
     - Store in change_events

  6. NOTIFY
     - Create in-app notification
     - (Future: email notification)
```

### 4.5 Scheduler

Worker process runs a scheduler loop (no external cron, no Celery Beat):

```python
# Every 60 seconds:
SELECT d.id FROM documents d
WHERE d.status = 'active'
  AND d.next_check_at <= now()
  AND d.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.document_id = d.id
      AND j.queue = 'fetch'
      AND j.status IN ('queued', 'running')
  )
LIMIT 200
FOR UPDATE OF d SKIP LOCKED;

# For each document:
INSERT INTO jobs (queue, document_id, clerk_user_id, status, run_at)
VALUES ('fetch', d.id, d.clerk_user_id, 'queued', now());

UPDATE documents SET next_check_at = now() + interval_for(schedule_tier)
WHERE id = d.id;
```

Self-contained, horizontally scalable via `SKIP LOCKED`.

### 4.6 Catalog

**Source**: `catalog.json` in repo root.

```json
[
  {
    "slug": "google",
    "name": "Google",
    "website_url": "https://google.com",
    "category": "search",
    "policy_urls": {
      "privacy": "https://policies.google.com/privacy",
      "tos": "https://policies.google.com/terms"
    }
  }
]
```

**Seeding**: Alembic migration step runs on every deploy. Upserts by `slug` — new entities in JSON appear in DB after next deploy. Idempotent.

**Community contributions**: GitHub PRs to `catalog.json`. Maintainer reviews (valid URL, robots.txt compatible, not duplicate).

### 4.7 Performance targets

- API (Server Actions) p95 latency: < 300ms for reads, < 600ms for writes
- Background monitoring: 95% of scheduled checks start within 10 min of due time
- Diff viewer render: < 200ms (pre-computed diffs, no on-demand computation)
- Pipeline throughput: sized for ~50k checks/day at launch (1 worker instance)

---

## 5) Security, Privacy, Compliance

### 5.1 Auth model

```
Browser → Clerk JS → Session cookie
Server Actions → Clerk server SDK → verify session → extract clerk_user_id
Server Actions → FastAPI (private network) → service token + clerk_user_id
FastAPI → row-level access check by clerk_user_id
```

- Clerk is the identity provider (no password storage)
- Server Actions verify Clerk session server-side
- FastAPI trusts service token (`INTERNAL_SERVICE_TOKEN`); enforces row-level access by `clerk_user_id`
- No JWT verification in Python — service token is a shared secret between Next.js and FastAPI on private network

### 5.2 Tier enforcement

Server Action middleware checks Clerk session's plan metadata using `has()` helper before calling FastAPI.

Enforced for:
- Document creation (document limit)
- On-demand "Check now" (daily quota)
- JS rendering (monthly quota)
- AI summary generation (monthly quota)
- Export (tier-gated)

FastAPI does NOT duplicate tier checks — it trusts the BFF.

### 5.3 Admin

- Admin users identified via Clerk `publicMetadata.role = "admin"`
- Admin-only FastAPI endpoints check role from service token payload
- No admin UI in v0.2.0 — use Railway DB explorer, psql, admin API endpoints
- No impersonation in v0.2.0

### 5.4 Rate limiting

Tier-based entitlements only in v0.2.0:
- Clerk auth gates all access (no anonymous API)
- Document limits, check quotas, summary quotas enforced per tier
- No IP-based rate limiting (add if abuse observed)
- No Redis rate limiter (add if needed post-launch)
- Per-host politeness: 2 concurrent fetches per host, 2s delay between requests

### 5.5 SSRF defenses

Enforced before tracking AND before each fetch:
1. Allow only `http://` and `https://`
2. Disallow: usernames/passwords in URL, non-standard ports, IP literal URLs
3. DNS resolution: block RFC1918, loopback, link-local, cloud metadata (`169.254.169.254`)
4. Redirects: max 5, re-run SSRF validation per hop
5. Timeouts: connect 5s, read 20s; max response 5 MB

### 5.6 PII & data residency

- No `users` table — Clerk manages PII
- Snapshots contain only publicly available text (no user PII)
- Unwatch → soft-delete; data retained per tier retention, then hard-deleted by cleanup job
- Account deletion → purge all user-scoped data (documents, notifications)
- US-only data residency (Railway US regions); documented in privacy policy

### 5.7 Webhook verification

- Clerk webhook: Svix signature verification using `CLERK_WEBHOOK_SECRET`
- Replay protection: check timestamp freshness
- No separate `webhook_events` table in v0.2.0 (simplification; add if idempotency issues arise)

### 5.8 Renderer safety (Playwright)

- New incognito context per job
- Downloads disabled
- Blocked permissions (geolocation, notifications)
- Request interception: block `file://`, private IP ranges
- Navigation timeout: 30s; total budget: 45s
- No Clerk/Stripe secrets in worker env

### 5.9 Content security

- Diff viewer renders extracted text as plain text (no raw HTML injection)
- XSS: all user-facing content escaped
- Security headers: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS
- CORS: allow only web origin

### 5.10 Threat model

| Threat | Risk | Mitigation |
|--------|------|------------|
| SSRF via URL tracking | High | Strict URL validation, DNS blocklist, redirect re-validation |
| Renderer exploited by malicious page | High | Isolated context, timeouts, no secrets, request interception |
| Webhook spoofing (Clerk) | High | Svix signature verification |
| Prompt injection from policy text | Medium | Only summarize provided hunks; strict JSON schema; citations required |
| Data exfiltration via logs | Medium | Never log fetched content; structured logging |
| Unauthorized access to other users' data | High | Row-level authz by clerk_user_id |
| Secret leakage | High | Env vars only; no secrets in client; private network |
| XSS in diff viewer | Medium | Plain text rendering; no raw HTML |

---

## 6) Reliability & Failure Modes

### 6.1 Failure modes table

| Failure | Detection | User impact | System behavior | Recovery | Blast radius |
|---------|-----------|-------------|-----------------|----------|--------------|
| Fetch timeout | Job fails after 20s | "Last check failed" in UI | Job retried (max 5 attempts) | Auto-retry with backoff; user can "Check now" | Single document |
| Robots.txt blocks | Pre-fetch check | "Blocked by robots.txt" with specific rule | Document status → `blocked_robots` | Re-check robots daily; auto-unblock if allowed | Single document |
| URL 404/410 | HTTP status check | "Document paused: URL no longer accessible" | Document status → `paused` | Manual re-enable by user | Single document |
| Trafilatura extraction fails | Empty/minimal text | "Content extraction failed" | Job marked failed; retry with render fallback | Playwright render attempt | Single document |
| PDF OCR fails | Tesseract returns < 500 chars | "Image-based PDF could not be extracted" | Job marked failed with specific error | None (manual review) | Single document |
| OpenRouter API down | HTTP error / timeout | "AI summary unavailable" | Summary status → `failed`; diff still available | Circuit breaker; retry next cycle | All summaries |
| Postgres connection lost | Connection pool error | API returns 503 | All services degrade | Railway auto-restart; connection pool retry | All services |
| Worker crash | Process exit | Delayed checks | Railway auto-restart; locked jobs expire | Stale lock cleanup (jobs locked > 10 min) | All background work |
| Clerk outage | Auth verification fails | Cannot sign in | Cached sessions may still work | Wait for Clerk recovery | All auth |

### 6.2 Job failure handling

- Job marked `status=dead` after max retries (5 for fetch/render, 3 for summarize)
- Document shows "Last check failed" with error category
- User can retry via "Check now"
- Auto-resume on next scheduled cycle (scheduler re-enqueues regardless of previous failure)
- Stale job cleanup: jobs with `status='running'` AND `locked_at < now() - interval '10 minutes'` reset to `queued`

### 6.3 Retry policy

| Queue | Max attempts | Backoff | Hard timeout |
|-------|-------------|---------|-------------|
| fetch | 5 | Exponential + jitter (30s, 60s, 120s, 240s, 480s) | 60s |
| render | 5 | Exponential + jitter | 90s |
| diff | 3 | Fixed 10s | 30s |
| summarize | 3 | Exponential (30s, 60s, 120s) | 60s |
| notify | 3 | Fixed 5s | 10s |
| cleanup | 1 | None | 300s |

---

## 7) Observability & Ops

### 7.1 Structured logging

- Python: `structlog` (JSON output)
- Next.js: `pino` (JSON output)
- Included fields: `request_id`, `clerk_user_id`, `document_id`, `job_id`, `status`, `latency_ms`
- **Never log**: fetched page content, user tokens, service token
- Log sampling: errors always logged; success sampled at 10%

### 7.2 Health endpoint

`GET /healthz` — checks Postgres connectivity, returns `{"ok": true}` or 503.

Used by Railway health checks for auto-restart.

### 7.3 Railway log drain

Railway's built-in log search for debugging. No external log aggregation in v0.2.0.

### 7.4 Future observability (deferred)

- Sentry (error tracking): add when first undiagnosed production error occurs
- Metrics (Prometheus/OTLP): add when scaling beyond 1 worker
- Alerting: add when operating with real users

---

## 8) Rollout, Migration, Compatibility

### 8.1 Rollout strategy

**Public launch immediately.** No invite-only beta.

Rationale: curated-only tracking naturally limits blast radius. No user data to migrate (clean-slate rebuild).

### 8.2 Rollback

Railway built-in rollback: redeploy previous image. DB migrations designed to be backward-compatible (additive-first).

### 8.3 Data retention

| Tier | Snapshot retention | Change events |
|------|--------------------|---------------|
| Free | 90 days | 90 days |
| Pro | 1 year | 1 year |
| Business | 2 years | 2 years |

Daily cleanup job: delete snapshots where `retention_delete_at <= now()` in batches of 500. Cascade-delete associated diffs + change events.

### 8.4 Backup strategy

- Railway Postgres automatic backups (platform-managed)
- Nightly `pg_dump` via GitHub Actions scheduled workflow → stored as artifact (30-day retention)
- Restore tested: `pg_restore --clean --if-exists` → run migrations → verify `/healthz`

### 8.5 Environments

- `dev`: Local Docker Compose (Postgres, Redis); local API/workers; Clerk test instance
- `staging`: Railway project environment; Clerk test instance; Stripe test mode
- `prod`: Railway prod environment

### 8.6 CI/CD

- GitHub → Railway deploy on merge to `main`
- Release phase: Alembic `upgrade head` before starting `api`
- GitHub Actions checks: lint (ruff, eslint), typecheck (TypeScript), integration tests (pytest, vitest), `pip-audit`, `npm audit`

### 8.7 Repo structure

```
/
  apps/
    web/          # Next.js (App Router) + Clerk + Server Actions
    api/          # FastAPI (internal)
    worker/       # Python: scheduler + job executor + pipeline
  catalog.json    # Curated entity catalog (community-maintained)
  SPEC.md
  README.md
```

---

## 9) Billing & Entitlements

### 9.1 Tiers

| Feature / Quota | Free | Pro | Business |
|-----------------|------|-----|----------|
| Tracked documents | 3 | 25 | 200 |
| Schedule frequency | daily | every 6h | every 1h |
| On-demand "Check now" | 10/day | 100/day | 500/day |
| JS-render fetches | 0/mo | 200/mo | 2,000/mo |
| AI summaries | 10/mo | 500/mo | 5,000/mo |
| In-app notifications | Unlimited | Unlimited | Unlimited |
| History retention | 90 days | 1 year | 2 years |
| Export (JSON) | Last 10 events | Full | Full |

### 9.2 Implementation

- **Clerk Billing** (Stripe connected) manages subscriptions
- Plans configured in Clerk dashboard
- `<PricingTable />` component renders pricing page
- `<Protect />` and `has()` gate features in Server Actions
- No local `entitlements` table; Clerk is source of truth
- Usage metering: count rows in `jobs` and `change_events` tables per period (indexed query)

### 9.3 Downgrade handling

- Non-payment → Clerk Billing handles grace period → downgrade to Free
- On downgrade: documents beyond Free limit auto-paused (oldest by `created_at`)
- Future: user-controlled document selection ("pick 3 to keep active")

### 9.4 Quota display

- Settings page: usage meters ("8/10 AI summaries used this month")
- In-app banner at 80%+: "You've used 8/10 AI summaries this month"
- At limit: block action with upgrade CTA: "Upgrade to Pro for 500 summaries/month"

---

## 10) Testing & Acceptance Criteria

### 10.1 Acceptance criteria

**AC-1**: Given a signed-out user on `/companies/google`, when they click "Watch changes" and complete Clerk auth, then Google's privacy policy and ToS documents are tracked and an initial snapshot job is enqueued.

**AC-2**: Given a tracked document with a new snapshot that has meaningful changes, when the pipeline completes, then a change event exists with a diff, an AI summary with ≥1 citation per bullet, and an in-app notification.

**AC-3**: Given a change event summary, when the user clicks a citation, then the diff viewer scrolls to the referenced hunk and highlights it.

**AC-4**: Given a Free tier user with 3 tracked documents, when they try to watch a 4th company, then they see an upgrade CTA and the action is blocked.

**AC-5**: Given a document URL that returns 404, when the fetch job runs, then the document status is set to `paused` and the user sees "URL no longer accessible."

**AC-6**: Given a document blocked by robots.txt, then the UI shows the specific blocking rule and the document status is `blocked_robots`.

**AC-7**: Given a fetch job that fails 5 times, then `jobs.status = 'dead'` and the document shows "Last check failed" with the ability to retry.

### 10.2 Test plan

**Integration tests (primary focus)**:
- FastAPI endpoint tests via `TestClient` — all CRUD operations, auth enforcement, error responses
- Pipeline integration tests with fixtures: fetch → extract → diff → summarize (mocked OpenRouter)
- Clerk webhook handling with signature verification
- Job queue tests: enqueue → claim → complete/fail cycle
- Scheduler loop: verify correct documents selected, deduplication works

**Unit tests (pure logic only)**:
- Change detection scoring algorithm
- Cosmetic pattern strip
- SSRF URL validation
- Diff hunk structuring
- Citation validation

**Skipped in v0.2.0**:
- E2E browser tests (Playwright)
- Performance/load tests
- Accessibility automated tests (manual review instead)

**Coverage target**: ~70% on critical paths (pipeline, auth, job queue).

---

## 11) Dependencies & Integrations

### 11.1 External services

| Service | Purpose | Failure behavior |
|---------|---------|-----------------|
| Clerk | Auth, identity, billing | Cannot sign in; cached sessions may work |
| OpenRouter | AI summaries | Summaries marked `failed`; diffs still work |
| Railway | Hosting, Postgres, Redis | Full outage |

### 11.2 Python libraries (key)

| Library | Purpose | License |
|---------|---------|---------|
| `fastapi` + `uvicorn` | API server | MIT |
| `httpx` | HTTP fetching | BSD |
| `trafilatura` | HTML text extraction | Apache 2.0 |
| `pypdf` | PDF text extraction | BSD |
| `pytesseract` | OCR fallback | Apache 2.0 |
| `playwright` | JS rendering | Apache 2.0 |
| `structlog` | Structured logging | MIT |
| `alembic` + `sqlalchemy` | DB migrations + ORM | MIT |
| `psycopg` | Postgres driver (async) | LGPL |

### 11.3 JavaScript libraries (key)

| Library | Purpose | License |
|---------|---------|---------|
| `next` | React framework | MIT |
| `@clerk/nextjs` | Auth + billing components | MIT |
| `diff-match-patch` | Diff engine for prose | Apache 2.0 |
| `@hey-api/openapi-ts` | Type-safe API client gen | MIT |
| `pino` | Structured logging | MIT |

---

## 12) Decision Log

All decisions from the 9-round interview, organized by domain.

### Architecture & Stack

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | Source-available FOSS | Full open-source, proprietary | Code inspectable for trust; platform monetized |
| 2026-02-07 | Python (FastAPI) + Next.js | Go + Next.js, Python + SvelteKit | Aligns with Python scraping ecosystem; team familiarity |
| 2026-02-07 | Clerk-only auth | Auth0, Supabase Auth, roll-own | Already integrated; Billing built-in; reduces surface |
| 2026-02-07 | Railway deployment | Fly.io, Render, Vercel + Railway | Single platform; private networking; managed Postgres |
| 2026-02-07 | Postgres job queue (SKIP LOCKED) | Celery + Redis, BullMQ, SQS | Eliminates Redis-as-queue dependency; jobs table IS the queue; simpler ops |
| 2026-02-07 | Same worker process for render | Separate renderer service | Simpler deployment; concurrency-limited queue protects resources |
| 2026-02-07 | Server Actions + hey-api client | Direct client → FastAPI, tRPC | Type-safe; FastAPI stays internal; single auth boundary |
| 2026-02-07 | Progressive auth (single app) | Separate /app route group, subdomain split | GitHub-style; less boilerplate; shared layout/nav |

### Data & Storage

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | 7-table minimal schema | 9 tables + audit, 11+ tables | Lean; no users table (Clerk manages); covers all flows |
| 2026-02-07 | Postgres TOAST for snapshots | S3/R2 object storage | 2-5 GB/year realistic; no external storage dep; migrate at ~20 GB |
| 2026-02-07 | Pre-compute + store diffs | Compute on-the-fly, hybrid | Instant reads; ~10-20% more storage, eliminates read latency |
| 2026-02-07 | Repo JSON seed for catalog | Admin API, Git-triggered sync | Version-controlled, idempotent, standard OSS contribution flow |
| 2026-02-07 | Tier-based retention (90d/1y/2y) | Keep forever, keep last N | Keeps DB lean; change events kept indefinitely (small) |

### Pipeline & Extraction

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | Trafilatura-only extraction | readability-lxml fallback, custom rules | F1 0.958; replaces ~80% of canonicalization pipeline |
| 2026-02-07 | pypdf + Tesseract OCR fallback | pdfplumber, pdfminer | BSD license; zero deps; OCR covers image-based PDFs |
| 2026-02-07 | Tiered change detection with LLM gate | Simple threshold, diff-only | SHA256 → ratio → cosmetic strip → LLM classify; ~$3/year for classification |
| 2026-02-07 | diff-match-patch engine | jsdiff, Python difflib | Google's library; semantic cleanup superior for prose; powers Google Docs |
| 2026-02-07 | Curated-only tracking | Custom URLs, hybrid | Limits abuse surface; community contributes via PRs |

### AI & UX

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | OpenRouter (Sonnet 4.5 → GPT-5.2 → Gemini 3 Flash) | Direct API calls, single provider | Provider abstraction; fallback chain; model flexibility |
| 2026-02-07 | In-app notifications only | Email (Postmark), email + in-app | No external email dep for v0.2.0; simpler; add email later |
| 2026-02-07 | Postgres feed + polling (60s) | SSE, WebSocket, Novu | Simplest; no connection management; upgrade to SSE later |

### Security & Ops

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | Service token auth (Next.js → FastAPI) | Pass-through Clerk JWT, API keys | Simple; no JWT verification in Python; private network trusted |
| 2026-02-07 | Tier-based entitlements only (no Redis rate limiter) | Redis sliding window, Cloudflare WAF | Clerk auth gates access; curated tracking limits abuse surface |
| 2026-02-07 | Clerk admin role + DB queries | Full admin dashboard, CLI-only | Minimal ops overhead; admin API endpoints for essentials |
| 2026-02-07 | Structured logs + /healthz only | Sentry, full metrics stack | Add observability incrementally when first incident demands it |
| 2026-02-07 | Public launch immediately | Invite-only beta, soft launch with caps | Curated-only tracking limits blast radius; no existing users to migrate |
| 2026-02-07 | Integration-heavy testing | Unit + integration balanced, E2E first | Highest ROI for solo rebuild; ~70% critical path coverage |
| 2026-02-07 | Server Action middleware for tier enforcement | FastAPI middleware, both layers | Single checkpoint; Clerk `has()` is fast; FastAPI trusts BFF |

### Billing

| Date | Decision | Alternatives Considered | Rationale |
|------|----------|------------------------|-----------|
| 2026-02-07 | 3 tiers via Clerk Billing | Stripe direct, LemonSqueezy | Clerk already integrated; Stripe connected; built-in components |
| 2026-02-07 | Worker scheduler polling loop | Railway cron, pg_cron | Self-contained; no external dep; horizontally scalable |

---

## 13) Assumptions, Open Questions, Risks

### Assumptions

1. Trafilatura 2.0 maintains its F1 0.958 on legal/policy text in production
2. Postgres TOAST handles 2-5 GB/year of snapshot text without performance degradation
3. Clerk Billing covers all billing flows needed (subscription, downgrade, plan changes)
4. Railway private networking is reliable for internal service communication
5. diff-match-patch's semantic cleanup is sufficient for legal prose diffs
6. 60s polling interval for notifications is acceptable UX (no real-time requirement)
7. Curated catalog of ~100-500 entities is sufficient for initial user demand
8. OpenRouter provides reliable access to Sonnet 4.5 / GPT-5.2 / Gemini 3 Flash

### Open questions

1. **Catalog bootstrapping**: How many entities should be in the initial catalog.json? Which companies are highest priority?
2. **Pricing**: Exact pricing for Pro and Business tiers (not yet determined)
3. **Marketing site content**: Exact copy, testimonials, social proof for launch
4. **Mobile polish**: Exact breakpoint behaviors for diff viewer on small screens
5. **Scheduler interval tuning**: 60s polling may need adjustment based on worker load

### Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Trafilatura fails on specific site structures | False negatives; missed changes | Medium | Monitor extraction quality; add site-specific post-processing if needed |
| Postgres TOAST performance degrades at scale | Slow reads, high I/O | Low | Migrate to S3/R2 when DB > 20 GB; already architected for this |
| Clerk Billing API changes / limitations | Billing flow breaks | Low | Clerk is stable; fallback to direct Stripe if needed |
| OpenRouter rate limits or downtime | No AI summaries | Medium | Fallback chain (3 models); circuit breaker; diffs still work |
| robots.txt blocks major target sites | Key entities un-trackable | Medium | Document clearly in UI; curated catalog vetted before inclusion |
| Single worker bottleneck at scale | Delayed checks, queue backlog | Medium | Horizontal scale: add worker replicas; queue-based distribution |
| Service token compromised | Unauthorized API access | Low | Private network only; rotate quarterly; Railway env vars |

---

## 14) Legal/Safety UX Copy

Required on every summary view:
> "This summary is generated by AI from the detected text changes and is provided for informational purposes only. It is not legal advice."

Required on "Watch changes" flow:
> "We only monitor public policy URLs from our curated directory. We respect robots.txt and apply rate limits."

Required in footer / about:
> "Inplain.ai is an independent tool for informational purposes. We are not affiliated with any of the companies we monitor."

---

## Appendix A — Catalog JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["slug", "name", "website_url", "category", "policy_urls"],
    "properties": {
      "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
      "name": { "type": "string" },
      "website_url": { "type": "string", "format": "uri" },
      "category": {
        "type": "string",
        "enum": ["social_media", "search", "cloud", "finance", "ecommerce", "streaming", "gaming", "productivity", "health", "education", "other"]
      },
      "policy_urls": {
        "type": "object",
        "properties": {
          "privacy": { "type": "string", "format": "uri" },
          "tos": { "type": "string", "format": "uri" },
          "cookie": { "type": "string", "format": "uri" }
        },
        "minProperties": 1
      }
    }
  }
}
```

---

## Appendix B — Job Queue Schema (SKIP LOCKED)

**Worker polling query** (run in a loop, one per queue):

```sql
WITH claimed AS (
  SELECT id
  FROM jobs
  WHERE queue = $1
    AND status = 'queued'
    AND run_at <= now()
  ORDER BY created_at
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
UPDATE jobs
SET status = 'running', locked_at = now(), started_at = now(), attempt = attempt + 1
FROM claimed
WHERE jobs.id = claimed.id
RETURNING jobs.*;
```

**Stale lock cleanup** (run every 5 minutes):

```sql
UPDATE jobs
SET status = 'queued', locked_at = NULL
WHERE status = 'running'
  AND locked_at < now() - interval '10 minutes';
```

**Job completion**:

```sql
UPDATE jobs
SET status = 'succeeded', finished_at = now()
WHERE id = $1;
```

**Job failure**:

```sql
UPDATE jobs
SET status = CASE WHEN attempt >= max_attempts THEN 'dead' ELSE 'queued' END,
    finished_at = now(),
    locked_at = NULL,
    error = $2,
    run_at = CASE WHEN attempt >= max_attempts THEN run_at
             ELSE now() + ($3 * power(2, attempt)) * interval '1 second' END
WHERE id = $1;
```

---

## Appendix C — Default Config Values

**Fetch**:
- Max redirects: 5
- Max response size: 5 MB
- Connect timeout: 5s
- Read timeout: 20s

**Renderer**:
- Navigation timeout: 30s
- Total budget: 45s
- Max concurrent renders: 2

**Politeness**:
- Per-host concurrency: 2
- Per-host delay: 2s
- Robots.txt cache: 24h

**Change detection**:
- Minimum added/removed chars: 500
- change_score threshold: 0.02
- Cosmetic patterns: timestamps, copyright years, counters

**Summaries**:
- Max hunks passed to LLM: 20
- Prompt version: 1
- Primary model: `anthropic/claude-sonnet-4-5` (via OpenRouter)
- Fallback models: `openai/gpt-5.2`, `google/gemini-3-flash`

**Scheduler**:
- Polling interval: 60s
- Batch size: 200 documents per cycle

**Notifications**:
- Polling interval: 60s (client-side)
- Max feed items: 50 (paginated)

**Retention cleanup**:
- Batch size: 500 snapshots per run
- Run frequency: daily
