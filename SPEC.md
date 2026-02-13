# Inplain.ai — SPEC (v0.2.0)

"Track, diff, and understand privacy policy changes with grounded, citation-backed AI summaries."

> **v0.2.0**: Clean-slate redesign targeting a full Product Hunt / Hacker News launch. Postgres-only storage, Postgres-based job queue, Server Actions BFF, in-app notifications only. Incorporates all decisions from 9 interview rounds + launch-readiness audit.

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
15. [UI & Brand](#15-ui--brand)
16. [Launch Plan](#16-launch-plan)
    A. [Catalog JSON Schema](#appendix-a--catalog-json-schema)
    B. [Job Queue Schema](#appendix-b--job-queue-schema-skip-locked)
    C. [Default Config Values](#appendix-c--default-config-values)
    D. [Catalog Target List](#appendix-d--catalog-target-list)

---

## 0) Metadata

- **Title**: Inplain.ai — Privacy Policy Change Tracker
- **Owner (DRI)**: Aman Thanvi (@amanthanvi)
- **Status**: Implementing (launch-readiness phase)
- **Last updated**: 2026-02-08
- **Spec version**: v0.2.0
- **License**: MIT (fully open source; monetize via hosted service)
- **Links**:
    - Repo: `github.com/amanthanvi/inplain.ai`
    - Production: `inplain.ai`
    - Support: GitHub Issues

---

## 1) Executive Summary

### 1.1 What we're building

A web app that monitors public privacy policies and terms of service, detects meaningful changes, produces readable diffs, and generates AI summaries explaining **what changed**, **why it matters**, with **citation-backed provenance** linking to exact changed passages.

### 1.2 Problem statement / why now

Privacy policies change without notice, are unreadable, and no tool makes changes accessible to non-lawyers. Existing solutions (ToS;DR, Visualping) either rely on volunteer curation or lack AI-powered interpretation.

### 1.3 Success metrics (activation-focused)

- **Primary KPI**: % of sign-ups who watch ≥1 entity within 7 days → target **40%**
- **Secondary KPI**: % of change events where user views the summary → target **60%**
- **Guardrail**: p95 pipeline latency < 15 min (fetch → summary available)
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
10. No analytics dashboard or risk scoring (deferred)
11. No RSS/JSON feed (deferred to v0.3)
12. No live feed on homepage (static marketing pages)

### 1.5 Launch strategy

**Full public launch** on Product Hunt and Hacker News. Curated-only tracking limits blast radius. No invite-only beta.

This means:

- UI must be polished and responsive (desktop + mobile)
- Source code will be scrutinized (MIT license)
- Traffic spikes expected; infrastructure must handle gracefully
- First impressions matter; marketing copy and UX must be sharp

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
3. Clerk auth (email magic link + Turnstile CAPTCHA) → returned to company page
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
- **Accessibility**: Semantic HTML, ARIA labels on diff viewer, keyboard-navigable citation links, sufficient color contrast

### 2.4 Frontend IA (progressive auth)

Single Next.js app with progressive auth. No separate `/app` route group.

**Public routes**:

- `/` — marketing homepage (polished hero + how-it-works + example change)
- `/companies` — public directory (search + category filter)
- `/companies/[slug]` — company page (public overview, latest policy, change timeline)
- `/pricing` — feature comparison table + Clerk Billing PricingTable
- `/about` — mission, design principles, disclaimers

**Protected routes** (Clerk middleware):

- `/dashboard` — user's watched companies
- `/settings` — account, notification preferences, billing, usage meters

**Auth flow**: `<SignedIn>`/`<SignedOut>` components gate inline content. Watching a company from the public directory triggers Clerk auth (with Turnstile CAPTCHA) if needed, then returns to the company page with tracking active.

**Header nav**:

- Signed out: Home, Companies, Pricing, About | Sign in / Start free
- Signed in: Home, Companies, Dashboard, notification bell (unread badge) | User menu (Settings, Billing, Sign out)

### 2.5 Diff viewer

**Primary view**: AI summary with citations at top. Most users stop here.

**Citation handling** (three-tier):

1. **Valid citation**: Quote found as exact substring in hunk text → normal display with clickable link
2. **Partial match (repairable)**: Quote is close but not exact (e.g., whitespace differences, truncation) → best-effort fuzzy match repair → display normally if repaired
3. **Failed citation**: Quote not found after repair attempt → display summary bullet with "unverified" indicator (subtle badge/icon) → citation link disabled

**Expanded view**: Section-first collapsed diff.

- Group changes by detected section/heading
- Each section shows heading + change count badge (additions/removals)
- Click to expand → inline word-level diff (diff-match-patch)
- Section detection: heuristic (H1-H6, bold first lines, numbered sections, ALL CAPS) with fallback to paragraph-level grouping
- No LLM-based section detection in v0.2.0

**Citation navigation**:

- Click citation → smooth scroll to referenced hunk → temporary highlight (fade after 2s) → auto-expand containing section if collapsed

**Toggle modes**: Unified full diff (desktop + mobile), side-by-side (desktop only) as secondary options for power users.

**Engine**: Research and select the simplest effective approach. Evaluate:

- Custom React renderer (~200-300 LOC) for full control over citation linking
- `react-diff-viewer-continued` as a base with citation overlay
- Hybrid: diff library for rendering, custom layer for citations
- Decision: pick the approach with least code that handles citation linking well

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
- Cloudflare Turnstile CAPTCHA on sign-up (Clerk integration)
- No `users` table; Clerk is the user store

**FR-2 Tracking — curated companies only** (MUST)

- Users watch/unwatch companies from curated directory
- Watching creates tracked entity + curated documents (Privacy/ToS/Cookie)
- No custom URL entry in v0.2.0
- Catalog: 30-50 curated companies at launch (see [Appendix D](#appendix-d--catalog-target-list))

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
- Three-tier citation handling (valid / repaired / unverified)
- Export: JSON (tier-gated); CSV deferred

**FR-6 AI summaries with provenance** (MUST)

- "What changed" bullet list with citations
- "Why it matters" bullet list with citations
- Every bullet must cite `hunkId` + exact quote from diff
- Runtime citation validation with fuzzy repair for partial matches
- Failed citations shown with "unverified" indicator (not hidden)
- "Not legal advice" disclaimer on every summary
- Summary language matches source language

**FR-7 In-app notifications** (MUST)

- Notification feed accessible from nav bar (unread badge)
- Dropdown panel showing recent notifications
- Poll every 60s for unread count
- Notification created for each meaningful change event

**FR-8 Notifications — email** (SHOULD, deferred to v0.3)

- Email notifications deferred to v0.3
- Schema supports future email (notification preferences, unsubscribe tokens)

**FR-9 Admin ops** (MUST)

- Clerk admin role (via `publicMetadata`)
- Admin-only FastAPI endpoints: job status/retry, user lookup
- No admin UI; use Railway DB explorer + psql for ad-hoc queries
- No impersonation in v0.2.0

**FR-10 Monetization & quotas** (MUST)

- 3 tiers (Free/Pro/Business) via Clerk Billing (Stripe connected)
- Pricing: Free / Pro $9/mo / Business $29/mo
- Tier enforcement at Server Action middleware layer using Clerk `has()` helper
- Quota display: usage meters on settings page + in-app banner at 80%+

**FR-11 Safety and legal posture** (MUST)

- Public URLs only (http/https)
- Respect robots.txt; block monitoring if disallowed with clear UI explanation
- Takedown/reporting process for site owners
- "Not legal advice" on every summary and watch flow

**FR-12 Product analytics** (MUST)

- PostHog self-hosted on Railway
- Track: sign-up, first watch, change event view, summary view, citation click
- Privacy-first: no third-party data sharing
- Event tracking via PostHog JS SDK (client) and PostHog Python SDK (server)

---

## 4) System Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (Browser)                                    │
│  Next.js App (React + TypeScript)                    │
│  Clerk <SignedIn>/<SignedOut> + Turnstile CAPTCHA     │
│  PostHog JS SDK (analytics)                          │
└────────────────┬────────────────────────────────────┘
                 │ Server Actions (BFF)
                 │ Clerk session verification
                 │ Tier enforcement via has()
                 │ HMAC-signed requests
                 ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare (proxy mode)                             │
│  DDoS protection, edge caching, Turnstile            │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Railway Private Network                             │
│                                                      │
│  ┌──────────────┐    HMAC-signed    ┌──────────────┐ │
│  │  Next.js      │───────────────→│  FastAPI       │ │
│  │  (public)     │                  │  (internal)    │ │
│  └──────────────┘                  └──────┬────────┘ │
│                                           │          │
│  ┌──────────────┐                  ┌──────▼────────┐ │
│  │  Worker       │◄──── polls ────│  Postgres      │ │
│  │  (scheduler + │──── writes ──→│  (DB + queue)  │ │
│  │   jobs)       │                  └───────────────┘ │
│  └──────┬────────┘                                   │
│         │                           ┌───────────────┐ │
│         └──── cache ──────────────→│  Redis         │ │
│                                     │  (cache only)  │ │
│  ┌──────────────┐                  └───────────────┘ │
│  │  Renderer     │◄──── polls ────┐                   │
│  │  (Playwright) │──── writes ──→│                   │
│  └──────────────┘                 │                   │
│                                                      │
│  ┌──────────────┐                                    │
│  │  PostHog      │ (self-hosted analytics)            │
│  └──────────────┘                                    │
└──────────────────────────────────────────────────────┘
                 │
                 ▼ External (outbound HTTPS)
    ┌────────┐ ┌────────────┐ ┌──────────┐
    │ Clerk  │ │ OpenRouter  │ │ Target   │
    │ Auth   │ │ LLM API    │ │ Websites │
    └────────┘ └────────────┘ └──────────┘
```

**Railway services** (6 services + 2 add-ons):

1. `web` (public) — Next.js via `next start`
2. `api` (internal, private network) — FastAPI + Uvicorn
3. `worker` (internal) — Python process: scheduler loop + job executor (fetch, diff, summarize, notify, cleanup)
4. `renderer` (internal) — Python process: render queue only (Playwright)
5. `posthog` (internal) — PostHog self-hosted instance
6. `postgres` — Railway Postgres (DB + job queue + snapshot storage)
7. `redis` — Railway Redis (caching + robots.txt decisions; NOT for queue)

Key simplifications from v0.1.0 (legacy `main`):

- No Celery/Beat/Flower → Postgres `SELECT FOR UPDATE SKIP LOCKED` queue
- No S3/R2 or Vercel KV/Blob → Postgres TOAST compression for snapshot text
- No Vercel Edge Functions → FastAPI on Railway private network
- No Scrapy → httpx + trafilatura in-process
- Renderer runs as a separate service (Railway) to isolate Playwright deps
- FastAPI is internal-only (private network); clients never hit it directly

### 4.2 Data model (7 tables)

No `users` table — Clerk manages identity. `clerk_user_id` is the foreign key across all user-scoped tables.

#### `entities`

Curated catalog items (companies/services).

| Column        | Type        | Notes                                                                       |
| ------------- | ----------- | --------------------------------------------------------------------------- |
| `id`          | uuid        | PK                                                                          |
| `slug`        | text        | Unique, URL-friendly                                                        |
| `name`        | text        | Display name                                                                |
| `website_url` | text        | Company website                                                             |
| `category`    | text        | e.g., "social_media", "cloud", "finance"                                    |
| `policy_urls` | jsonb       | `{"privacy": "https://...", "tos": "https://...", "cookie": "https://..."}` |
| `created_at`  | timestamptz |                                                                             |
| `updated_at`  | timestamptz |                                                                             |

Indexes: unique(`slug`)

Seeded from `catalog.json` in repo via Alembic migration (upsert by slug). Community contributes new entities via GitHub PRs.

#### `documents`

A tracked URL for a specific user + entity combination.

| Column              | Type        | Notes                                                        |
| ------------------- | ----------- | ------------------------------------------------------------ |
| `id`                | uuid        | PK                                                           |
| `clerk_user_id`     | text        | NOT NULL                                                     |
| `entity_id`         | uuid        | FK → entities                                                |
| `url`               | text        |                                                              |
| `doc_type`          | text        | `privacy` / `tos` / `cookie` / `other`                       |
| `status`            | text        | `active` / `paused` / `blocked_robots` / `error`             |
| `schedule_tier`     | text        | `daily` / `6h` / `1h`                                        |
| `next_check_at`     | timestamptz | Used by scheduler                                            |
| `last_checked_at`   | timestamptz |                                                              |
| `last_snapshot_id`  | uuid        | Nullable                                                     |
| `etag`              | text        | Nullable, for conditional GET                                |
| `last_modified`     | text        | Nullable, for conditional GET                                |
| `robots_checked_at` | timestamptz | Nullable                                                     |
| `robots_status`     | text        | `unknown` / `allowed` / `disallowed`                         |
| `robots_rule`       | text        | Nullable, specific blocking rule (e.g. `Disallow: /privacy`) |
| `pause_reason`      | text        | Nullable: `url_inaccessible` (404/410), `doc_limit` (tier auto-pause) |
| `created_at`        | timestamptz |                                                              |
| `deleted_at`        | timestamptz | Nullable, soft-delete                                        |

Indexes:

- `(clerk_user_id, entity_id, doc_type)` unique where `deleted_at IS NULL`
- `(next_check_at)` where `status IN ('active','blocked_robots','error') AND deleted_at IS NULL` (scheduler)
- `(clerk_user_id, status)`

#### `snapshots`

Fetched + extracted text for a document at a point in time.

| Column                | Type        | Notes                       |
| --------------------- | ----------- | --------------------------- |
| `id`                  | uuid        | PK                          |
| `document_id`         | uuid        | FK → documents              |
| `fetched_at`          | timestamptz |                             |
| `fetch_method`        | text        | `http` / `render`           |
| `http_status`         | int         |                             |
| `content_type`        | text        | Nullable                    |
| `extracted_text`      | text        | Stored via TOAST + LZ4      |
| `extracted_sha256`    | text        |                             |
| `extract_version`     | int         | Bump when extractor changes |
| `byte_size_extracted` | int         |                             |
| `retention_delete_at` | timestamptz | Tier-based                  |
| `created_at`          | timestamptz |                             |

Indexes:

- `(document_id, fetched_at DESC)`
- `(retention_delete_at)` (cleanup job)

#### `diffs`

Pre-computed diff between two consecutive snapshots.

| Column                  | Type        | Notes                                                            |
| ----------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                    | uuid        | PK                                                               |
| `document_id`           | uuid        | FK → documents                                                   |
| `from_snapshot_id`      | uuid        | FK → snapshots                                                   |
| `to_snapshot_id`        | uuid        | FK → snapshots                                                   |
| `diff_hunks`            | jsonb       | Structured: `[{hunkId, context, added[], removed[], positions}]` |
| `change_score`          | numeric     | 0..1                                                             |
| `change_classification` | text        | `cosmetic` / `meaningful` / `major`                              |
| `created_at`            | timestamptz |                                                                  |

Indexes:

- unique(`from_snapshot_id`, `to_snapshot_id`)
- `(document_id, created_at DESC)`

#### `change_events`

User-facing change record tying diff + AI summary.

| Column                   | Type        | Notes                                                |
| ------------------------ | ----------- | ---------------------------------------------------- |
| `id`                     | uuid        | PK                                                   |
| `document_id`            | uuid        | FK → documents                                       |
| `diff_id`                | uuid        | FK → diffs                                           |
| `title`                  | text        | Generated, e.g., "Privacy Policy updated"            |
| `summary_status`         | text        | `pending` / `completed` / `failed` / `skipped_quota` |
| `summary_what_changed`   | jsonb       | Bullets with citations                               |
| `summary_why_matters`    | jsonb       | Bullets with citations                               |
| `summary_model`          | text        | Nullable                                             |
| `summary_prompt_version` | int         | Nullable                                             |
| `summary_error`          | text        | Nullable                                             |
| `created_at`             | timestamptz |                                                      |

Indexes:

- `(document_id, created_at DESC)`

#### `jobs`

Postgres-based job queue. Workers poll with `SELECT FOR UPDATE SKIP LOCKED`.

| Column          | Type        | Notes                                                            |
| --------------- | ----------- | ---------------------------------------------------------------- |
| `id`            | uuid        | PK                                                               |
| `queue`         | text        | `fetch` / `render` / `diff` / `summarize` / `notify` / `cleanup` |
| `clerk_user_id` | text        | Nullable                                                         |
| `document_id`   | uuid        | Nullable FK → documents                                          |
| `status`        | text        | `queued` / `running` / `succeeded` / `failed` / `dead`           |
| `payload`       | jsonb       | Job-specific data                                                |
| `attempt`       | int         | Default 0                                                        |
| `max_attempts`  | int         | Default 5                                                        |
| `error`         | text        | Nullable                                                         |
| `run_at`        | timestamptz | For delayed execution                                            |
| `locked_at`     | timestamptz | Nullable, set when claimed                                       |
| `started_at`    | timestamptz | Nullable                                                         |
| `finished_at`   | timestamptz | Nullable                                                         |
| `created_at`    | timestamptz |                                                                  |

Indexes:

- `(queue, status, run_at)` where `status = 'queued'` (worker polling)
- `(document_id, created_at DESC)`
- `(status, created_at)`

See [Appendix B](#appendix-b--job-queue-schema-skip-locked) for the polling query.

#### `notifications`

In-app notification feed.

| Column          | Type        | Notes                                         |
| --------------- | ----------- | --------------------------------------------- |
| `id`            | uuid        | PK                                            |
| `clerk_user_id` | text        | NOT NULL                                      |
| `type`          | text        | `change_detected` / `check_failed` / `system` |
| `title`         | text        |                                               |
| `body`          | text        | Short description                             |
| `payload`       | jsonb       | Links, entity info, change event ID           |
| `read_at`       | timestamptz | Nullable                                      |
| `created_at`    | timestamptz |                                               |

Indexes:

- `(clerk_user_id, created_at DESC)`
- `(clerk_user_id, read_at)` where `read_at IS NULL` (unread count)

### 4.3 API layer

**Pattern**: Next.js Server Actions (BFF) → FastAPI (internal)

- FastAPI generates OpenAPI spec
- `hey-api/openapi-ts` generates type-safe TypeScript client from spec
- Server Actions call FastAPI via Railway private networking (e.g., `http://api.railway.internal:8000`)
- Client-side code never calls FastAPI directly
- Auth: Server Actions verify Clerk session server-side. Calls to FastAPI use HMAC-signed requests (see §5.1) + pass `clerk_user_id` as parameter
- FastAPI verifies HMAC signature; enforces row-level access by `clerk_user_id`
- Webhooks: Clerk hits `/internal/webhooks/clerk` directly; endpoint is protected by Svix signature verification

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
POST   /internal/documents/apply-entitlements  (sync schedule + pause over-limit docs)
GET    /internal/snapshots/{id}              (snapshot detail)
GET    /internal/change-events               (user's change events)
GET    /internal/change-events/{id}          (detail with summary + diff)
POST   /internal/change-events/{id}/retry-summary (requeue summarize if failed)
GET    /internal/notifications               (user's notifications)
POST   /internal/notifications/mark-read     (mark notifications read)
GET    /internal/notifications/unread-count   (polling endpoint)
GET    /internal/usage                       (user quota usage)
GET    /internal/export                      (JSON export; tier-gated)
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
     - If minimal text: enqueue render job (Playwright, separate service)
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
     - Runtime citation validation with fuzzy repair
     - Store in change_events

  6. NOTIFY
     - Create in-app notification
     - (Future: email notification in v0.3)
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

**Target**: 30-50 curated companies at launch across categories: Technology, Social Media, E-commerce, Finance, AI/ML, Streaming, Gaming, Productivity, Health, Education.

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

**Validation requirements for catalog entries**:

- URL must be publicly accessible (HTTP 200)
- URL must not be blocked by robots.txt for `inplain.ai` user agent
- URL must yield ≥500 chars of extracted text via trafilatura
- Category must be from the allowed enum

### 4.7 Performance targets

- API (Server Actions) p95 latency: < 300ms for reads, < 600ms for writes
- Pipeline p95 latency: < 15 min (fetch → summary available)
- Background monitoring: 95% of scheduled checks start within 10 min of due time
- Diff viewer render: < 200ms (pre-computed diffs, no on-demand computation)
- Pipeline throughput: sized for ~50k checks/day at launch (1 worker instance)

---

## 5) Security, Privacy, Compliance

### 5.1 Auth model

```
Browser → Clerk JS → Session cookie (+ Turnstile CAPTCHA on sign-up)
Server Actions → Clerk server SDK → verify session → extract clerk_user_id
Server Actions → FastAPI (private network) → HMAC-signed request + clerk_user_id
FastAPI → verify HMAC signature → row-level access check by clerk_user_id
```

- Clerk is the identity provider (no password storage)
- Server Actions verify Clerk session server-side
- **HMAC request signing** (upgrade from shared secret):
    - Each request from Next.js to FastAPI is signed with `HMAC-SHA256(service_secret, timestamp + method + path + body_hash)`
    - `X-Request-Signature` header carries the HMAC
    - `X-Request-Timestamp` header carries the timestamp (reject if >5 min stale)
    - Prevents replay attacks even if service secret is leaked
    - FastAPI verifies HMAC before processing
- No JWT verification in Python — HMAC is simpler and equally secure over private network

### 5.2 Tier enforcement

Server Action middleware checks Clerk session's plan metadata using `has()` helper before calling FastAPI.

Enforced for:

- Document creation (document limit)
- On-demand "Check now" (daily quota)
- JS rendering (monthly quota)
- AI summary generation (monthly quota)
- Export (tier-gated)

FastAPI does NOT duplicate tier checks — it trusts the BFF after HMAC verification.

### 5.3 Admin

- Admin users identified via Clerk `publicMetadata.role = "admin"`
- Admin-only FastAPI endpoints check role from HMAC-signed payload
- No admin UI in v0.2.0 — use Railway DB explorer, psql, admin API endpoints
- No impersonation in v0.2.0

### 5.4 Rate limiting & abuse prevention

**Authentication layer**:

- Cloudflare Turnstile CAPTCHA on sign-up (via Clerk integration)
- Clerk auth gates all API access (no anonymous API)

**Tier-based entitlements**:

- Document limits, check quotas, summary quotas enforced per tier
- Per-host politeness: 2 concurrent fetches per host, 2s delay between requests

**Infrastructure layer**:

- Cloudflare proxy mode: DDoS protection, bot mitigation
- No IP-based rate limiting in v0.2.0 (add if abuse observed post-launch)
- No Redis rate limiter (add if needed)

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
- Account deletion → immediate purge of all user-scoped data (documents, notifications, jobs)
- US-only data residency (Railway US regions); documented in privacy policy

### 5.7 Webhook verification

- Clerk webhook: Svix signature verification using `CLERK_WEBHOOK_SECRET`
- Replay protection: check timestamp freshness (5 min window)
- No separate `webhook_events` table in v0.2.0 (add if idempotency issues arise)

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

| Threat                                   | Risk   | Mitigation                                                            |
| ---------------------------------------- | ------ | --------------------------------------------------------------------- |
| SSRF via URL tracking                    | High   | Strict URL validation, DNS blocklist, redirect re-validation          |
| Renderer exploited by malicious page     | High   | Isolated context, timeouts, no secrets, request interception          |
| Webhook spoofing (Clerk)                 | High   | Svix signature verification                                           |
| Prompt injection from policy text        | Medium | Only summarize provided hunks; strict JSON schema; citations required |
| Data exfiltration via logs               | Medium | Never log fetched content; structured logging                         |
| Unauthorized access to other users' data | High   | Row-level authz by clerk_user_id + HMAC verification                  |
| Secret leakage                           | High   | Env vars only; no secrets in client; private network; HMAC signing    |
| XSS in diff viewer                       | Medium | Plain text rendering; no raw HTML                                     |
| Automated sign-up abuse                  | Medium | Cloudflare Turnstile CAPTCHA; curated catalog limits value of abuse   |
| DDoS during PH/HN launch                 | Medium | Cloudflare proxy mode; Railway auto-restart                           |
| Service token replay attack              | Medium | HMAC signing with timestamp; 5-min freshness window                   |

---

## 6) Reliability & Failure Modes

### 6.1 Failure modes table

| Failure                      | Detection                     | User impact                                 | System behavior                                 | Recovery                                       | Blast radius        |
| ---------------------------- | ----------------------------- | ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------- |
| Fetch timeout                | Job fails after 20s           | "Last check failed" in UI                   | Job retried (max 5 attempts)                    | Auto-retry with backoff; user can "Check now"  | Single document     |
| Robots.txt blocks            | Pre-fetch check               | "Blocked by robots.txt" with specific rule  | Document status → `blocked_robots`              | Re-check robots daily; auto-unblock if allowed | Single document     |
| URL 404/410                  | HTTP status check             | "Document paused: URL no longer accessible" | Document status → `paused`                      | Manual re-enable by user                       | Single document     |
| Trafilatura extraction fails | Empty/minimal text            | "Content extraction failed"                 | Job marked failed; retry with render fallback   | Playwright render attempt                      | Single document     |
| PDF OCR fails                | Tesseract returns < 500 chars | "Image-based PDF could not be extracted"    | Job marked failed with specific error           | None (manual review)                           | Single document     |
| OpenRouter API down          | HTTP error / timeout          | "AI summary unavailable"                    | Summary status → `failed`; diff still available | Circuit breaker; retry next cycle              | All summaries       |
| Postgres connection lost     | Connection pool error         | API returns 503                             | All services degrade                            | Railway auto-restart; connection pool retry    | All services        |
| Worker crash                 | Process exit                  | Delayed checks                              | Railway auto-restart; locked jobs expire        | Stale lock cleanup (jobs locked > 10 min)      | All background work |
| Clerk outage                 | Auth verification fails       | Cannot sign in                              | Cached sessions may still work                  | Wait for Clerk recovery                        | All auth            |
| Citation validation fails    | Quote not found in hunk       | Summary shows "unverified" indicator        | Attempt fuzzy repair; fall back to unverified   | Improve prompt engineering                     | Single summary      |

### 6.2 Job failure handling

- Job marked `status=dead` after max retries (5 for fetch/render, 3 for summarize)
- Document shows "Last check failed" with error category
- User can retry via "Check now"
- Auto-resume on next scheduled cycle (scheduler re-enqueues regardless of previous failure)
- Stale job cleanup: jobs with `status='running'` AND `locked_at < now() - interval '10 minutes'` reset to `queued`

### 6.3 Retry policy

| Queue     | Max attempts | Backoff                                           | Hard timeout |
| --------- | ------------ | ------------------------------------------------- | ------------ |
| fetch     | 5            | Exponential + jitter (30s, 60s, 120s, 240s, 480s) | 60s          |
| render    | 5            | Exponential + jitter                              | 90s          |
| diff      | 3            | Fixed 10s                                         | 30s          |
| summarize | 3            | Exponential (30s, 60s, 120s)                      | 60s          |
| notify    | 3            | Fixed 5s                                          | 10s          |
| cleanup   | 1            | None                                              | 300s         |

---

## 7) Observability & Ops

### 7.1 Structured logging

- Python: `structlog` (JSON output)
- Next.js: `pino` (JSON output)
- Included fields: `request_id`, `clerk_user_id`, `document_id`, `job_id`, `status`, `latency_ms`
- **Never log**: fetched page content, user tokens, service token, HMAC secret
- Log sampling: errors always logged; success sampled at 10%

### 7.2 Health endpoint

`GET /healthz` — checks Postgres connectivity, returns `{"ok": true}` or 503.

Used by Railway health checks for auto-restart.

### 7.3 Product analytics (PostHog)

Self-hosted PostHog on Railway for privacy-first analytics.

**Tracked events**:

- `sign_up` — user creates account
- `first_watch` — user watches first company
- `change_event_viewed` — user opens a change event
- `summary_viewed` — user views AI summary
- `citation_clicked` — user clicks a citation link
- `check_now_triggered` — user triggers on-demand check
- `upgrade_cta_shown` — user sees upgrade prompt
- `upgrade_completed` — user upgrades tier

**Privacy boundaries**:

- No third-party data sharing
- No tracking of page content
- PostHog hosted on same Railway project (US data residency)
- Opt-out mechanism in settings (deferred to v0.3)

### 7.4 Railway log drain

Railway's built-in log search for debugging. No external log aggregation in v0.2.0.

### 7.5 Error tracking

Add Sentry for both Python (FastAPI + worker) and Next.js before launch:

- Capture unhandled exceptions
- Performance monitoring (transaction traces)
- Source maps for Next.js client errors
- Environment-tagged (dev/staging/prod)

### 7.6 Smoke test (post-deploy)

Automated smoke test script that runs after every deploy:

1. `GET /healthz` → 200
2. `GET /` → 200 (marketing page loads)
3. `GET /companies` → 200 (directory loads with entities)
4. `GET /internal/entities` → 200 (API responds with catalog)
5. Verify Postgres connectivity
6. Verify Redis connectivity (if configured)

---

## 8) Rollout, Migration, Compatibility

### 8.1 Rollout strategy

**Public launch immediately.** No invite-only beta. Full PH/HN launch.

Pre-launch checklist:

- [ ] 30-50 catalog companies validated (URLs + robots.txt + extraction)
- [ ] UI polished for desktop + mobile
- [ ] PostHog tracking verified
- [ ] Cloudflare proxy mode enabled
- [ ] Turnstile CAPTCHA configured
- [ ] Sentry configured
- [ ] Smoke test passing
- [ ] Blue-green deploy tested
- [ ] At least 1 real change event visible in the system (for demo)

### 8.2 Blue-green deployment

Railway environment-based blue-green deploys:

- **Blue**: current production environment
- **Green**: staging environment with new version
- Deploy to green → run smoke tests → swap DNS/routing → monitor → roll back if needed
- Alembic migrations designed to be backward-compatible (additive-first)

### 8.3 Data retention

| Tier     | Snapshot retention | Change events |
| -------- | ------------------ | ------------- |
| Free     | 90 days            | 90 days       |
| Pro      | 1 year             | 1 year        |
| Business | 2 years            | 2 years       |

Daily cleanup job: delete snapshots where `retention_delete_at <= now()` in batches of 500. Cascade-delete associated diffs + change events.

### 8.4 Backup strategy

- Railway Postgres automatic backups (platform-managed)
- Nightly `pg_dump` via GitHub Actions scheduled workflow → stored as artifact (30-day retention)
- Restore tested: `pg_restore --clean --if-exists` → run migrations → verify `/healthz`

### 8.5 Environments

- `dev`: Local Docker Compose (Postgres, Redis); local API/workers; Clerk test instance
- `staging` (green): Railway project environment; Clerk test instance; Stripe test mode
- `prod` (blue): Railway prod environment

### 8.6 CI/CD

- GitHub → Railway deploy on merge to `main`
- Release phase: Alembic `upgrade head` before starting `api`
- GitHub Actions checks: lint (ruff, eslint), typecheck (TypeScript), integration tests (pytest, vitest), `pip-audit`, `npm audit`
- Post-deploy: automated smoke test

### 8.7 Repo structure

```
/
  apps/
    web/          # Next.js (App Router) + Clerk + Server Actions + PostHog
    api/          # FastAPI (internal) + SQLAlchemy + Alembic
    worker/       # Python: scheduler + job executor + pipeline
  catalog.json    # Curated entity catalog (community-maintained)
  SPEC.md
  PLAN.md
  README.md
```

---

## 9) Billing & Entitlements

### 9.1 Tiers

| Feature / Quota       | Free           | Pro ($9/mo) | Business ($29/mo) |
| --------------------- | -------------- | ----------- | ----------------- |
| Tracked documents     | 3              | 25          | 200               |
| Schedule frequency    | daily          | every 6h    | every 1h          |
| On-demand "Check now" | 10/day         | 100/day     | 500/day           |
| JS-render fetches     | 0/mo           | 200/mo      | 2,000/mo          |
| AI summaries          | 10/mo          | 500/mo      | 5,000/mo          |
| In-app notifications  | Unlimited      | Unlimited   | Unlimited         |
| History retention     | 90 days        | 1 year      | 2 years           |
| Export (JSON)         | Last 10 events | Full        | Full              |

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

v0.1.0 internal review milestone: **AC-1** through **AC-7**. Launch-readiness items start at **AC-8**.

**AC-1**: Given a signed-out user on `/companies/google`, when they click "Watch changes" and complete Clerk auth, then Google's privacy policy and ToS documents are tracked and an initial snapshot job is enqueued.

**AC-2**: Given a tracked document with a new snapshot that has meaningful changes, when the pipeline completes, then a change event exists with a diff, an AI summary with ≥1 citation per bullet, and an in-app notification.

**AC-3**: Given a change event summary, when the user clicks a citation, then the diff viewer scrolls to the referenced hunk and highlights it.

**AC-4**: Given a Free tier user with 3 tracked documents, when they try to watch a 4th company, then they see an upgrade CTA and the action is blocked.

**AC-5**: Given a document URL that returns 404, when the fetch job runs, then the document status is set to `paused` and the user sees "URL no longer accessible."

**AC-6**: Given a document blocked by robots.txt, then the UI shows the specific blocking rule and the document status is `blocked_robots`.

**AC-7**: Given a fetch job that fails 5 times, then `jobs.status = 'dead'` and the document shows "Last check failed" with the ability to retry.

**AC-8**: Given a summary with a citation whose quote doesn't exactly match hunk text, the system attempts fuzzy repair. If repair succeeds, the citation displays normally. If repair fails, the citation shows an "unverified" indicator.

**AC-9**: Given a new user sign-up, Cloudflare Turnstile CAPTCHA is presented and must pass before account creation.

**AC-10**: PostHog tracks `sign_up`, `first_watch`, and `change_event_viewed` events correctly in the self-hosted instance.

### 10.2 Test plan

**Integration tests (primary focus)**:

- FastAPI endpoint tests via `TestClient` — all CRUD operations, auth enforcement, error responses
- HMAC signature verification tests
- Pipeline integration tests with fixtures: fetch → extract → diff → summarize (mocked OpenRouter)
- Clerk webhook handling with signature verification
- Job queue tests: enqueue → claim → complete/fail cycle
- Scheduler loop: verify correct documents selected, deduplication works
- Citation validation + fuzzy repair tests

**Unit tests (pure logic only)**:

- Change detection scoring algorithm
- Cosmetic pattern strip
- SSRF URL validation
- Diff hunk structuring
- Citation validation and fuzzy repair
- HMAC signature generation and verification

**Smoke tests (post-deploy)**:

- Health check endpoints
- Marketing page loads
- Catalog API responds
- PostHog event ingestion

**Skipped in v0.2.0**:

- E2E browser tests (Playwright)
- Performance/load tests
- Accessibility automated tests (manual review instead)

**Coverage target**: ~70% on critical paths (pipeline, auth, job queue).

---

## 11) Dependencies & Integrations

### 11.1 External services

| Service    | Purpose                                | Failure behavior                                                    |
| ---------- | -------------------------------------- | ------------------------------------------------------------------- |
| Clerk      | Auth, identity, billing                | Cannot sign in; cached sessions may work                            |
| OpenRouter | AI summaries + LLM classification      | Summaries marked `failed`; diffs still work                         |
| Railway    | Hosting, Postgres, Redis               | Full outage                                                         |
| Cloudflare | DNS, proxy, DDoS protection, Turnstile | Site unreachable if DNS fails; Turnstile degradation allows sign-up |
| PostHog    | Product analytics                      | Analytics lost; product still works                                 |

### 11.2 Python libraries (key)

| Library                  | Purpose                    | License    |
| ------------------------ | -------------------------- | ---------- |
| `fastapi` + `uvicorn`    | API server                 | MIT        |
| `httpx`                  | HTTP fetching              | BSD        |
| `trafilatura`            | HTML text extraction       | Apache 2.0 |
| `pypdf`                  | PDF text extraction        | BSD        |
| `pytesseract`            | OCR fallback               | Apache 2.0 |
| `playwright`             | JS rendering               | Apache 2.0 |
| `structlog`              | Structured logging         | MIT        |
| `alembic` + `sqlalchemy` | DB migrations + ORM        | MIT        |
| `psycopg`                | Postgres driver (async)    | LGPL       |
| `sentry-sdk`             | Error tracking             | MIT        |
| `posthog`                | Product analytics (server) | MIT        |

### 11.3 JavaScript libraries (key)

| Library               | Purpose                    | License    |
| --------------------- | -------------------------- | ---------- |
| `next`                | React framework            | MIT        |
| `@clerk/nextjs`       | Auth + billing components  | MIT        |
| `diff-match-patch`    | Diff engine for prose      | Apache 2.0 |
| `@hey-api/openapi-ts` | Type-safe API client gen   | MIT        |
| `pino`                | Structured logging         | MIT        |
| `posthog-js`          | Product analytics (client) | MIT        |
| `@sentry/nextjs`      | Error tracking             | MIT        |

---

## 12) Decision Log

All decisions from the 9-round interview + launch-readiness audit, organized by domain.

### Architecture & Stack

| Date       | Decision                            | Alternatives Considered                    | Rationale                                                                  |
| ---------- | ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 2026-02-07 | MIT open-source license             | BSL, AGPL, custom source-available         | HN-friendly; no licensing debates; monetize via hosted service             |
| 2026-02-07 | Python (FastAPI) + Next.js          | Go + Next.js, Python + SvelteKit           | Aligns with Python scraping ecosystem; team familiarity                    |
| 2026-02-07 | Clerk-only auth                     | Auth0, Supabase Auth, roll-own             | Already integrated; Billing built-in; reduces surface                      |
| 2026-02-07 | Railway deployment                  | Fly.io, Render, Vercel + Railway           | Single platform; private networking; managed Postgres                      |
| 2026-02-07 | Postgres job queue (SKIP LOCKED)    | Celery + Redis, BullMQ, SQS                | Eliminates Redis-as-queue dependency; jobs table IS the queue; simpler ops |
| 2026-02-08 | Separate renderer service (Railway) | Same worker process for render             | Isolates Playwright/browser deps; enables independent scaling              |
| 2026-02-07 | Server Actions + hey-api client     | Direct client → FastAPI, tRPC              | Type-safe; FastAPI stays internal; single auth boundary                    |
| 2026-02-07 | Progressive auth (single app)       | Separate /app route group, subdomain split | GitHub-style; less boilerplate; shared layout/nav                          |
| 2026-02-08 | PostHog self-hosted on Railway      | Plausible, no analytics, DB queries only   | Full funnel visibility; privacy-first; self-hosted                         |
| 2026-02-08 | Cloudflare proxy mode               | Railway direct, Cloudflare DNS-only        | DDoS protection for PH/HN launch; edge caching; Turnstile                  |

### Security

| Date       | Decision                                             | Alternatives Considered                       | Rationale                                                             |
| ---------- | ---------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| 2026-02-08 | HMAC request signing (Next.js → FastAPI)             | Shared secret only, JWT pass-through, mTLS    | Prevents replay attacks; simple; no external deps; MIT source visible |
| 2026-02-08 | Cloudflare Turnstile CAPTCHA on sign-up              | Clerk built-in CAPTCHA, reCAPTCHA, no CAPTCHA | Prevents automated sign-ups; privacy-friendly; Clerk integration      |
| 2026-02-07 | Tier-based entitlements only (no Redis rate limiter) | Redis sliding window, Cloudflare WAF          | Clerk auth + Turnstile + curated tracking limits abuse surface        |
| 2026-02-08 | Sentry error tracking                                | No tracking, Rollbar, Bugsnag                 | Industry standard; good Next.js + Python support                      |

### Data & Storage

| Date       | Decision                            | Alternatives Considered                 | Rationale                                                         |
| ---------- | ----------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| 2026-02-07 | 7-table minimal schema              | 9 tables + audit, 11+ tables            | Lean; no users table (Clerk manages); covers all flows            |
| 2026-02-07 | Postgres TOAST for snapshots        | S3/R2 object storage                    | 2-5 GB/year realistic; no external storage dep; migrate at ~20 GB |
| 2026-02-07 | Pre-compute + store diffs           | Compute on-the-fly, hybrid              | Instant reads; ~10-20% more storage, eliminates read latency      |
| 2026-02-07 | Repo JSON seed for catalog          | Admin API, Git-triggered sync           | Version-controlled, idempotent, standard OSS contribution flow    |
| 2026-02-08 | 30-50 curated companies at launch   | Port 100+ from main, 3 companies, 10-15 | Fresh curation; validate URLs/robots; quality over quantity       |
| 2026-02-08 | Immediate account purge on deletion | 30-day grace, purge + email             | Privacy-first; no grace period complexity; GDPR-friendly          |

### Pipeline & Extraction

| Date       | Decision                              | Alternatives Considered                 | Rationale                                                              |
| ---------- | ------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| 2026-02-07 | Trafilatura-only extraction           | readability-lxml fallback, custom rules | F1 0.958; replaces ~80% of canonicalization pipeline                   |
| 2026-02-07 | pypdf + Tesseract OCR fallback        | pdfplumber, pdfminer                    | BSD license; zero deps; OCR covers image-based PDFs                    |
| 2026-02-07 | Tiered change detection with LLM gate | Simple threshold, diff-only             | SHA256 → ratio → cosmetic strip → LLM classify; ~$3/year               |
| 2026-02-07 | diff-match-patch engine               | jsdiff, Python difflib                  | Google's library; semantic cleanup superior for prose                  |
| 2026-02-07 | Curated-only tracking                 | Custom URLs, hybrid                     | Limits abuse surface; community contributes via PRs                    |
| 2026-02-08 | Three-tier citation handling          | Show all, hide failed, block summary    | Transparent UX; fuzzy repair for partial matches; unverified indicator |

### AI & UX

| Date       | Decision                                           | Alternatives Considered                 | Rationale                                                                  |
| ---------- | -------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| 2026-02-07 | OpenRouter (Sonnet 4.5 → GPT-5.2 → Gemini 3 Flash) | Direct API calls, single provider       | Provider abstraction; fallback chain; model flexibility                    |
| 2026-02-07 | In-app notifications only                          | Email (Postmark/Resend), email + in-app | No external email dep for v0.2.0; add email in v0.3                        |
| 2026-02-07 | Postgres feed + polling (60s)                      | SSE, WebSocket, Novu                    | Simplest; no connection management; upgrade to SSE later                   |
| 2026-02-08 | Diff viewer: research KISS approach                | Custom only, react-diff-viewer only     | Evaluate simplest effective option; citation linking is primary constraint |
| 2026-02-08 | Friendly + technical brand voice                   | Serious, casual, pure technical         | Friendly for marketing (PH), technical for product (HN)                    |
| 2026-02-08 | Static homepage (no live feed)                     | Live feed, featured change + feed       | Simpler; less operational risk at launch; users discover post-signup       |

### Ops & Launch

| Date       | Decision                               | Alternatives Considered                      | Rationale                                                 |
| ---------- | -------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 2026-02-08 | Full PH/HN launch                      | Soft deploy, targeted announce, private beta | Curated tracking limits blast radius; no users to migrate |
| 2026-02-08 | Blue-green deploys on Railway          | Railway rollback, fix-forward only, manual   | Safety net for launch day; tested rollback path           |
| 2026-02-08 | GitHub Issues for support              | Discord, email, in-app feedback              | Lean; dev audience; aligns with MIT OSS project           |
| 2026-02-08 | Railway Hobby plan (upgrade if needed) | Pro, Team                                    | Cost-efficient for launch; upgrade based on real usage    |
| 2026-02-08 | Pro $9/mo, Business $29/mo             | $12/$49, $19/$79, Free-only                  | Accessible indie pricing; low barrier to conversion       |

---

## 13) Assumptions, Open Questions, Risks

### Assumptions

1. Trafilatura 2.0 maintains its F1 0.958 on legal/policy text in production
2. Postgres TOAST handles 2-5 GB/year of snapshot text without performance degradation
3. Clerk Billing covers all billing flows needed (subscription, downgrade, plan changes)
4. Railway private networking is reliable for internal service communication
5. diff-match-patch's semantic cleanup is sufficient for legal prose diffs
6. 60s polling interval for notifications is acceptable UX (no real-time requirement)
7. Curated catalog of 30-50 entities is sufficient for initial user demand
8. OpenRouter provides reliable access to Sonnet 4.5 / GPT-5.2 / Gemini 3 Flash
9. Railway Hobby plan supports 6 services + 2 add-ons (postgres + redis)
10. PostHog self-hosted fits within Railway Hobby resource constraints
11. Clerk supports Cloudflare Turnstile integration natively
12. Cloudflare proxy mode works with Railway's custom domains

### Open questions

1. **Catalog list**: Exact 30-50 companies to include (must validate URLs + robots.txt + extraction quality)
2. **PostHog sizing**: Resource requirements for self-hosted PostHog on Railway Hobby plan
3. **Blue-green specifics**: Railway environment promotion vs service duplication approach
4. **Diff viewer**: Final decision on custom vs library-based approach (pending research)

### Risks + mitigations

| Risk                                          | Impact                                    | Likelihood | Mitigation                                                                          |
| --------------------------------------------- | ----------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| Trafilatura fails on specific site structures | False negatives; missed changes           | Medium     | Monitor extraction quality; add site-specific post-processing if needed             |
| Postgres TOAST performance degrades at scale  | Slow reads, high I/O                      | Low        | Migrate to S3/R2 when DB > 20 GB; already architected for this                      |
| Clerk Billing API changes / limitations       | Billing flow breaks                       | Low        | Clerk is stable; fallback to direct Stripe if needed                                |
| OpenRouter rate limits or downtime            | No AI summaries                           | Medium     | Fallback chain (3 models); circuit breaker; diffs still work                        |
| robots.txt blocks major target sites          | Key entities un-trackable                 | Medium     | Document clearly in UI; curated catalog vetted before inclusion                     |
| Single worker bottleneck at scale             | Delayed checks, queue backlog             | Medium     | Horizontal scale: add worker replicas; queue-based distribution                     |
| PH/HN traffic spike overwhelms Railway Hobby  | Slow responses, 503s                      | Medium     | Cloudflare caching for static; queue backpressure; upgrade to Pro if needed         |
| PostHog resource consumption on Hobby plan    | PostHog crashes or starves other services | Medium     | Monitor resource usage; consider external PostHog Cloud if self-hosted is too heavy |
| HMAC secret rotation gap                      | Brief auth failures during rotation       | Low        | Deploy with new+old secret acceptance window; rotate quarterly                      |
| UI polish insufficient for PH/HN scrutiny     | Poor first impressions, negative launch   | High       | Invest in UI polish as P0 before launch; get feedback from test users               |

---

## 14) Legal/Safety UX Copy

Required on every summary view:

> "This summary is generated by AI from the detected text changes and is provided for informational purposes only. It is not legal advice."

Required on "Watch changes" flow:

> "We only monitor public policy URLs from our curated directory. We respect robots.txt and apply rate limits."

Required in footer / about:

> "Inplain.ai is an independent tool for informational purposes. We are not affiliated with any of the companies we monitor."

Required on sign-up (alongside Turnstile):

> "By signing up, you agree to our Terms of Service and Privacy Policy."

---

## 15) UI & Brand

### 15.1 Brand voice

- **Marketing pages**: Friendly, approachable, accessible. "We make privacy policies readable."
- **Product UI**: Technical precision, minimal, data-focused. No fluff.
- **Error messages**: Helpful and actionable. Tell the user what happened and what to do next.
- **Legal disclaimers**: Clear, prominent, not hidden. Transparency builds trust.

### 15.2 Visual design requirements

**Typography**: Custom font pairing (currently Fraunces + Space Grotesk). Distinctive, not generic.

**Responsive**: Full desktop + mobile support. Diff viewer adapts (unified diff on mobile, side-by-side option on desktop).

**Color**: Commit to a palette with CSS variables. Diff viewer: green for additions, red for removals, yellow for unverified citations.

**Polish checklist (P0 for launch)**:

- [ ] Landing page hero is compelling and sharp
- [ ] Company directory is clean and searchable
- [ ] Company page clearly communicates value
- [ ] Diff viewer is readable and citation links work smoothly
- [ ] Dashboard is functional and not bare
- [ ] Settings page shows usage clearly
- [ ] Pricing page is clean with clear tier comparison
- [ ] Mobile layout works on all pages
- [ ] Loading/skeleton states for all async content
- [ ] Error states are helpful, not scary
- [ ] Empty states guide users to take action

### 15.3 Accessibility baseline

- Semantic HTML (headings, landmarks, lists)
- ARIA labels on interactive elements (diff viewer, notification bell, citation links)
- Keyboard navigation for all flows
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- Focus indicators visible
- No content conveyed by color alone (especially in diffs — use icons/text alongside color)

---

## 16) Launch Plan

### 16.1 Pre-launch milestones

| #   | Milestone                                          | Status                | Depends on                           |
| --- | -------------------------------------------------- | --------------------- | ------------------------------------ |
| L1  | Catalog: 30-50 companies validated                 | Done                  | URL + robots + extraction validation |
| L2  | UI polish pass (all pages, desktop + mobile)       | Done                  | Design decisions                     |
| L3  | HMAC request signing                               | Done                  | —                                    |
| L4  | Cloudflare proxy mode enabled                      | Blocked (external)    | DNS configuration                    |
| L5  | Cloudflare Turnstile CAPTCHA                       | Blocked (external)    | Clerk configuration                  |
| L6  | Renderer service deployed on Railway               | Done                  | —                                    |
| L7  | PostHog self-hosted on Railway                     | Partial (provisioned) | Resource sizing                      |
| L8  | Sentry integration (Python + Next.js)              | Done                  | —                                    |
| L9  | Blue-green deploy tested                           | Done                  | Staging environment                  |
| L10 | Smoke test script                                  | Done                  | —                                    |
| L11 | Citation fuzzy repair + unverified indicator       | Done                  | —                                    |
| L12 | Diff viewer finalized (KISS research)              | Done                  | Research                             |
| L13 | Marketing copy finalized                           | Done                  | —                                    |
| L14 | README + LICENSE file updated for MIT              | Done                  | —                                    |
| L15 | At least 1 real change event in system (demo data) | Done                  | Pipeline running                     |

Notes:

- L4 + L5 require Cloudflare/Clerk dashboard access and cannot be completed from repository-only automation.
- L7 template services are provisioned in Railway; final PostHog service activation and env value wiring are still required.

### 16.2 Launch day checklist

- [ ] All L1-L15 milestones complete
- [ ] CI green on `refresh` branch
- [ ] `refresh` merged to `main`
- [ ] Production deploy via blue-green
- [ ] Smoke test passing on production
- [ ] PostHog receiving events
- [ ] Sentry configured and capturing
- [ ] Cloudflare proxy mode verified
- [ ] Clerk Billing configured (Stripe connected, plans created)
- [ ] Product Hunt listing prepared
- [ ] HN post drafted
- [ ] GitHub repo public with MIT license

### 16.3 Post-launch monitoring (first 48h)

- Watch Railway resource usage (CPU, memory, connections)
- Monitor Sentry for new errors
- Check PostHog for activation funnel (sign-up → first watch)
- Review pipeline latency (p95 < 15 min target)
- Monitor Postgres connection count and query latency
- Check Cloudflare analytics for traffic patterns
- Respond to GitHub Issues

### 16.4 v0.3 roadmap (post-launch)

1. Email notifications (Resend integration)
2. RSS/JSON feed of changes
3. CSV export
4. PostHog opt-out mechanism
5. Analytics dashboard (trends, change frequency)
6. Risk scoring (keyword-based)
7. Browser extension (if demand exists)
8. Custom URL tracking (beyond curated catalog)
9. SSE for real-time notifications (replace polling)

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
				"enum": [
					"social_media",
					"search",
					"cloud",
					"finance",
					"ecommerce",
					"streaming",
					"gaming",
					"productivity",
					"health",
					"education",
					"ai",
					"communication",
					"other"
				]
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
- Ambiguous LLM gate model chain: `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview` (max_tokens=220)

**Summaries**:

- Max hunks passed to LLM: 20
- Prompt version: 2
- OpenRouter attribution headers: `HTTP-Referer`, `X-Title`
- Structured outputs: JSON schema when supported (retry without on 400)
- Tier-aware model policy (by `schedule_tier`):
  - `daily`: `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview` (max_tokens=650, max_bullets=8)
  - `6h`: `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview` → `openai/gpt-5.2` (max_tokens=850, max_bullets=10)
  - `1h`: `deepseek/deepseek-v3.2` → `openai/gpt-5.2` → `anthropic/claude-sonnet-4.5` (max_tokens=1100, max_bullets=12)

**Scheduler**:

- Polling interval: 60s
- Batch size: 200 documents per cycle

**Notifications**:

- Polling interval: 60s (client-side)
- Max feed items: 50 (paginated)

**Retention cleanup**:

- Batch size: 500 snapshots per run
- Run frequency: daily

**HMAC**:

- Algorithm: SHA256
- Timestamp freshness: 5 minutes
- Headers: `X-Request-Signature`, `X-Request-Timestamp`

---

## Appendix D — Catalog Target List

Target: 30-50 companies across categories. Each entry must pass validation:

- URL returns HTTP 200
- Not blocked by robots.txt for `inplain.ai` user agent
- trafilatura extracts ≥500 chars

**Priority categories and candidate companies**:

| Category          | Candidates                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Search / Tech** | Google, Microsoft, Apple, Amazon                                                    |
| **Social Media**  | Meta (Facebook/Instagram), X (Twitter), TikTok, Reddit, LinkedIn, Discord, Snapchat |
| **AI / ML**       | OpenAI, Anthropic, Mistral, Stability AI, Midjourney                                |
| **Cloud**         | AWS, Google Cloud, Microsoft Azure, Cloudflare, DigitalOcean                        |
| **Streaming**     | Netflix, Spotify, YouTube, Disney+, Twitch                                          |
| **Finance**       | PayPal, Stripe, Coinbase, Robinhood, Plaid                                          |
| **E-commerce**    | Amazon, Shopify, eBay, Etsy                                                         |
| **Communication** | Zoom, Slack, Signal, WhatsApp, Telegram                                             |
| **Productivity**  | Notion, GitHub, Figma, Canva, Dropbox                                               |
| **Gaming**        | Steam (Valve), Epic Games, Nintendo, PlayStation                                    |
| **Health**        | Fitbit, MyFitnessPal, Headspace                                                     |
| **Education**     | Coursera, Duolingo, Khan Academy                                                    |

Final list determined by URL validation + extraction testing before launch.
