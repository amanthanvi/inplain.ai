# Inplain.ai — SPEC (v0.1.0-rev1)

"Track, diff, and understand privacy policy changes with AI-powered summaries."

> **Revision Note (v0.1.0-rev1)**: This revision incorporates interview-driven decisions on PDF/iframe handling, URL canonicalization, UI/UX patterns, AI opinion style, crawler identity, and quota management. See Section 9.5 (UI/UX), Section 10.1 (fetch pipeline), Section 11.3-11.6 (AI behavior), and Section 16.3 (crawler identity).

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-goals](#2-goals--non-goals)
3. [Personas & Primary User Journeys](#3-personas--primary-user-journeys)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-functional Requirements](#5-non-functional-requirements)
6. [Proposed Architecture](#6-proposed-architecture)
7. [Railway Hosting Topology](#7-railway-hosting-topology)
8. [Data Model (Postgres)](#8-data-model-postgres)
9. [API Design (REST)](#9-api-design-rest)
    - 9.5 [UI/UX Design Decisions](#95-uiux-design-decisions)
10. [Scraping + Normalization + Diff System](#10-scraping--normalization--diff-system)
11. [AI Summarization via OpenRouter](#11-ai-summarization-via-openrouter)
12. [Notifications (Email)](#12-notifications-email)
13. [Monetization + Entitlements + Metering](#13-monetization--entitlements--metering)
14. [Observability & Operations](#14-observability--operations)
15. [CI/CD + Environments + Migrations](#15-cicd--environments--migrations)
16. [Security Deep Dive](#16-security-deep-dive)
17. [Performance & Scaling Plan](#17-performance--scaling-plan)
18. [Runbooks](#18-runbooks)
19. [Rollout Plan](#19-rollout-plan)
20. [Launch Readiness Checklists](#20-launch-readiness-checklists)
21. [Open Questions / Future Work](#21-open-questions--future-work)

---

## 1) Overview

Inplain.ai continuously monitors _public_ Privacy Policy and Terms of Service pages, detects meaningful changes, produces a readable diff, and generates an AI summary that explains:

-   **What changed**
-   **Why it matters**
-   **With provenance**: citations pointing to specific changed passages (quotes + diff locations) to reduce hallucination risk.

v0.1.0 is **production-ready**, public internet-facing, hosted on **Railway**, with:

-   Clerk-based auth and entitlement enforcement
-   tier-based scheduling and quotas
-   job queue + retries + dead-letter handling
-   observability (logs/metrics/traces + error tracking)
-   security baseline (SSRF defenses, webhook verification, rate limits)
-   backups + restore procedures
-   operational runbooks

---

## 2) Goals / Non-goals

### 2.1 Goals (v0.1.0)

1. **Track pages over time**: scheduled monitoring + on-demand checks.
2. **Reliable change detection**: reduce false positives from dynamic content (cookie banners, timestamps, nav).
3. **Human-readable diff**: view changes clearly in the app.
4. **AI-powered summaries with citations**: summaries must reference exact changed text.
5. **Multi-entity support**: many companies/entities, each with multiple documents (Privacy, ToS, Cookie, etc.).
6. **Notifications**: email alerts on meaningful changes (tier-gated).
7. **Admin tooling**: job status, retries, failure inspection, user management.
8. **Monetization**: free + at least two paid tiers; enforceable quotas and abuse prevention.
9. **Legally safer posture**: public pages only, robots.txt-aware, rate-limited crawling, takedown process, “not legal advice”.

### 2.2 Non-goals (v0.1.0)

1. **Not a legal compliance product** (no legal opinions, no guarantees).
2. **No authenticated/behind-login document monitoring** (public URLs only).
3. **No browser extension**.
4. **No Slack/MS Teams native notifications** (email only; webhook export is future work).
5. **No full-text search across all snapshots** (store data for later; basic per-document history view only).
6. **No enterprise SSO / SCIM** (future).

---

## 3) Personas & Primary User Journeys

### 3.1 Personas

1. **Founder / PM**: tracks competitors’ privacy/ToS changes; wants quick “why it matters” alerts.
2. **Privacy-conscious user**: tracks apps/services they use; wants plain-language summaries.
3. **Developer / Security engineer**: needs diffs and citations; may export data.
4. **Admin (internal)**: monitors system health, jobs, abuse, billing/entitlements.

### 3.2 Primary user journeys

#### Journey A — Sign up and track first company

1. User lands on marketing site, clicks “Get started”.
2. Clerk auth (email magic link) → redirected to app.
3. Creates an Entity (e.g., “Acme Corp”).
4. Adds a Document URL (Privacy Policy).
5. System validates URL + robots posture + runs initial snapshot.
6. UI shows current extracted text + baseline snapshot metadata.

#### Journey B — Change detected → diff + summary + email

1. Scheduled job fetches URL; content normalized; change detected.
2. System generates diff and AI summary with citations.
3. Change event created; email notification sent per preferences.
4. User opens app → views “What changed” + diff sections; citations link to exact added/removed passages.

#### Journey C — On-demand check

1. User clicks “Check now”.
2. If within tier quota, job enqueued; UI shows “running”.
3. Results appear; if no meaningful changes, event stored as “no-op” (optional) or only job log (config).

#### Journey D — Admin triage

1. Admin dashboard shows queue backlog, top failing hosts, LLM spend, scraper errors.
2. Admin retries job, disables a document, bans an abusive user, or applies a plan override.

---

## 4) Functional Requirements

**FR-1 Authentication & sessions**

1. Use **Clerk** for authentication (identity source of truth).
2. Auth method: **email magic link** (passwordless). Optional OAuth (Google) can be enabled later.
3. Require verified email to add documents.

**FR-2 Entities and documents** 4. Users can create/update/delete **Entities** (company/group). 5. Users can add/update/pause/delete **Documents** (tracked pages) under an Entity. 6. Each Document stores: URL, type (privacy/tos/cookie/other), fetch mode (auto), schedule tier, status.

**FR-3 Fetching & snapshots** 7. System fetches snapshots on a schedule (tier-based) and on-demand. 8. Fetch pipeline must support:

-   conditional GET (ETag/Last-Modified)
-   redirects with strict limits
-   content-type validation
-   **PDF extraction** with OCR fallback for image-based PDFs
-   **iframe resolution** (detect iframe src first, fall back to full render if content minimal)

9. Store raw HTML/PDF (compressed) + normalized extracted text for each snapshot.

**FR-4 Change detection** 10. Detect meaningful changes with low false positives:

-   remove boilerplate/nav/cookie banners/timestamps
-   similarity thresholds + minimum-change heuristics

11. If change is meaningful, generate a diff artifact and a ChangeEvent.

**FR-5 Diff viewing** 12. UI shows:

-   timeline of ChangeEvents per Document
-   diff viewer (inline by default; toggle split)
-   added/removed sections with anchors

13. Allow exporting diff + summary (JSON) for a change event (tier-gated).

**FR-6 AI summaries with provenance** 14. Generate:

-   “What changed” bullet list
-   “Why it matters” bullet list
-   “Not legal advice” disclaimer

15. Every bullet must cite one or more **diff citations** (quotes + pointers to hunks).

**FR-7 Notifications** 16. Send email notifications for meaningful changes (tier-gated). 17. User controls:

-   per-document enable/disable
-   immediate vs daily digest (tier-gated)

18. Include unsubscribe links and compliance-friendly headers.

**FR-8 Admin** 19. Admin role can:

-   view jobs, failures, retries
-   view per-host failure rates
-   inspect fetch artifacts (sanitized)
-   manage users (ban, plan override)

20. Admin audit log for sensitive actions.

**FR-9 Monetization & quotas** 21. Free + 2 paid tiers with explicit quotas and feature gates. 22. Enforce:

-   per-user document limits
-   check frequency limits
-   JS-render budget
-   AI summary budget
-   notification limits

23. Abuse controls: rate limiting, add-URL throttles, host-level backoff.

**FR-10 Safety and legal posture** 24. Only monitor public URLs (http/https). 25. Respect robots.txt by default; if disallowed, block monitoring and explain why. 26. Provide takedown/reporting process for site owners.

---

## 5) Non-functional Requirements

### 5.1 Reliability & latency targets

**Assumptions for v0.1.0 SLOs**

-   API availability: **99.9%** monthly (excluding planned maintenance).
-   Background monitoring: **95%** of scheduled checks start within **10 minutes** of due time.
-   UI/API p95 latency:
    -   read endpoints p95 **< 300 ms**
    -   write endpoints p95 **< 600 ms**
-   Email notifications: **95% delivered within 10 minutes** of ChangeEvent creation (provider-dependent).

### 5.2 Scalability assumptions (explicit for v0.1.0)

> These are sizing assumptions; see [Scaling Plan](#17-performance--scaling-plan) for adjustments.

-   Active users: **5,000**
-   Tracked documents: **50,000**
-   Checks/day: **200,000**
-   JS-render required: **20%** of checks (**40,000/day**)
-   Avg normalized text size: **35 KB**
-   Avg compressed raw HTML: **80 KB**
-   Retention:
    -   Free: 30 days
    -   Pro: 180 days
    -   Business: 730 days

### 5.3 Security requirements (OWASP baseline + platform concerns)

1. TLS everywhere (Railway managed HTTPS); HSTS on web.
2. Strict input validation for URLs and IDs.
3. AuthN via Clerk JWT verification; AuthZ enforced server-side for every request.
4. Rate limiting per user + per IP + per endpoint group.
5. SSRF mitigations (see [16.2](#162-ssrf-defenses-for-url-fetching)).
6. Secret management: Railway environment variables; no secrets in repo.
7. Webhook verification for Clerk and Stripe; replay protection.
8. Encryption:
    - in transit via TLS
    - at rest: Postgres managed encryption (Railway) + object storage encryption
    - additional app-level encryption for highly sensitive fields (minimal use in v0.1.0)
9. Audit logging for: user bans, plan overrides, webhook processing, doc add/remove.

### 5.4 Privacy requirements (data minimization & retention)

1. Store only what's needed:
    - URLs, snapshots, diffs, summaries, notification settings.
2. Do **not** store:
    - user passwords (Clerk handles)
    - third-party page form submissions (we don't submit forms)
3. Retention by tier; deletion workflows:
    - user can delete a document → delete associated snapshots/diffs (async job)
    - user can delete account → purge user data (except billing records required for finance, if applicable)
4. Redact secrets accidentally present in fetched pages where feasible (basic patterns: API keys, emails) **only in logs**; snapshots remain as-fetched.

### 5.4.1 Data residency

-   **v0.1.0**: US-only data residency (Railway US regions).
-   Privacy policy clearly states: "Your data is stored in the United States."
-   EU compliance via Standard Contractual Clauses if needed.
-   **Future**: Monitor EU demand; build region infrastructure when there's signal.

### 5.5 Compliance considerations

**Robots posture**

-   v0.1.0: **Respect robots.txt**; do not fetch disallowed paths.
-   Maintain a `robots_checked_at` and `robots_decision` for transparency.

**Takedown**

-   Provide “Report/Request removal” contact and workflow:
    -   verify requester controls domain (email to domain or DNS token) for prioritized action
    -   allow permanent blocklist of domains/paths

**Disclaimers**

-   Clearly display: “AI summaries are informational and not legal advice.”

---

## 6) Proposed Architecture

### 6.1 Key technology decisions (decisive)

**Monorepo:** Yes. Single repo with separate apps/services.

**Frontend:** Next.js (App Router) + React + TypeScript + TanStack Query.

**API:** **Python FastAPI**

-   Rationale: aligns with Python scraping ecosystem, shared models/validation, one primary backend language.
-   Clerk integration: verify JWT via JWKS; webhook verification; entitlement checks from JWT claims/DB.

**Workers & queue:** **Celery + Redis**

-   Rationale: mature retries/scheduling patterns, multi-queue support, strong Python ecosystem.
-   Separate queues: `fetch`, `render`, `diff`, `summarize`, `notify`, `maintenance`.

**Scraping:** HTTP-first fetcher (httpx) + extraction (trafilatura/readability), with an isolated Playwright renderer service.

-   Rationale: keep the core fetch pipeline simple and observable; use Playwright only when needed and quota-allowed.
-   JS rendering is selectively triggered (cost control + quota enforcement) and isolated for safety.

**Database:** **Postgres** (Railway managed)

-   Rationale: relational integrity for entities/docs/snapshots/events; good indexing; robust backups.

**Object storage:** **S3-compatible (Cloudflare R2 or AWS S3)** for raw HTML and large artifacts

-   Rationale: avoid bloating Postgres with large blobs; cheaper retention and lifecycle policies.
-   Hosted compute remains Railway; external storage is acceptable and standard for production.

**Caching/rate limiting:** Redis (Railway managed).

**Observability:**

-   **Sentry** (errors/perf)
-   **OpenTelemetry** traces + metrics exported to **Grafana Cloud OTLP** (or Honeycomb; choose one for implementation—see [14](#14-observability--operations))
-   Structured JSON logs to stdout (Railway log drain optional later)

**Email:** **Postmark**

-   Rationale: deliverability-first, simple templates, good API.

**AI:** OpenRouter

-   Model strings configurable; default + fallback set (see [11](#11-ai-summarization-via-openrouter)).

**Billing:** Stripe for payments; Clerk remains identity + entitlement source of truth (see [13](#13-monetization--entitlements--metering)).

### 6.2 Component-level architecture

```mermaid
flowchart LR
  subgraph Client
    WEB[React Web App]
  end

  subgraph External
    Clerk[Clerk Auth]
    OR[OpenRouter LLM]
    PM[Postmark Email]
    Stripe[Stripe Billing]
    S3[S3/R2 Object Storage]
    Obs[Sentry + Grafana Cloud OTLP]
  end

  subgraph Railway
    API[FastAPI API Service]
    W1[Celery Worker: fetch/diff/summarize/notify]
    REND[Celery Worker: render (Playwright)]
    SCH[Scheduler (Celery Beat / due-enqueuer)]
    PG[(Postgres)]
    RD[(Redis)]
  end

  WEB -->|JWT| API
  API --> PG
  API --> RD
  API --> Clerk
  API --> Stripe
  API --> Obs

  SCH --> RD
  W1 --> RD
  REND --> RD

  W1 --> PG
  W1 --> S3
  W1 --> OR
  W1 --> PM
  W1 --> Obs

  REND --> S3
  REND --> Obs

  Stripe -->|webhook| API
  Clerk -->|webhook| API
```

### 6.3 Trust zones & network boundaries

1. **Public zone**: Web + API endpoints exposed to internet.
2. **Private app zone**: Workers, scheduler (no public ingress). Communicate via Redis + Postgres.
3. **Data zone**: Postgres + Redis (Railway private networking).
4. **External services**: Clerk/Stripe/OpenRouter/Postmark/S3. Access via outbound HTTPS only.

Principles:

-   Workers have **least privilege** DB roles (read/write specific tables).
-   Renderer worker has **minimal secrets** (no Stripe keys, no Clerk admin key).
-   Separate env vars per service; no shared “god” credentials.

---

## 7) Railway Hosting Topology

### 7.1 Services to create (Railway)

1. `web` (public)
    - Build Vite React app
    - Serve via a small Node static server or Caddy
2. `api` (public)
    - FastAPI + Uvicorn
3. `worker` (private)
    - Celery worker (queues: `fetch`, `diff`, `summarize`, `notify`, `maintenance`)
4. `renderer` (private)
    - Celery worker (queue: `render`) with Playwright/Chromium dependencies
5. `scheduler` (private)
    - Celery Beat or a custom “due enqueuer” loop (recommended: custom enqueuer to avoid Beat single-point quirks)
6. Add-ons:
    - `postgres` (Railway Postgres)
    - `redis` (Railway Redis)

### 7.2 Deployment model

-   GitHub → Railway deploy on merge to `main`.
-   Staging environment: separate Railway project or Railway “environment” (preferred).
-   Release phase:
    -   run DB migrations (Alembic) before starting `api`.

---

## 8) Data Model (Postgres)

### 8.1 Conventions

-   IDs: `uuid` (generated server-side).
-   Timestamps: `timestamptz`, stored in UTC.
-   Soft-delete where needed: `deleted_at` nullable.
-   JSON columns: `jsonb` for structured artifacts (diff hunks, citations).
-   Partitioning: optional later; v0.1.0 uses indexes + retention jobs.

### 8.2 Tables (core)

#### `users`

Maps Clerk identity → internal user row.

-   `id` uuid pk
-   `clerk_user_id` text unique not null
-   `email` text not null
-   `stripe_customer_id` text unique null
-   `role` text not null default `user` (`user`|`admin`)
-   `status` text not null default `active` (`active`|`banned`)
-   `created_at`, `updated_at`

Indexes:

-   unique(`clerk_user_id`)
-   index(`email`)
-   unique(`stripe_customer_id`)

#### `entitlements`

Local mirror for enforcement + auditing (Clerk remains source of truth).

-   `user_id` uuid pk fk -> users(id)
-   `plan` text not null (`free`|`pro`|`business`)
-   `limits` jsonb not null (computed quotas; see [13.2](#132-tiers-quotas-and-feature-gates))
-   `period_start_at` timestamptz
-   `period_end_at` timestamptz
-   `updated_at`

Indexes:

-   pk(`user_id`)
-   index(`plan`)

#### `entities`

-   `id` uuid pk
-   `user_id` uuid fk -> users(id) not null
-   `name` text not null
-   `website_url` text null
-   `created_at`, `updated_at`, `deleted_at`

Indexes:

-   index(`user_id`)
-   unique(`user_id`, `name`) where `deleted_at is null`

#### `documents`

A tracked public URL.

-   `id` uuid pk
-   `user_id` uuid fk -> users(id) not null
-   `entity_id` uuid fk -> entities(id) not null
-   `url` text not null
-   `url_canonical` text not null (normalized)
-   `doc_type` text not null (`privacy`|`tos`|`cookie`|`other`)
-   `status` text not null (`active`|`paused`|`blocked_robots`|`error`)
-   `fetch_mode` text not null default `auto` (`auto`|`http_only`|`force_render`)
-   `schedule_tier` text not null (`daily`|`6h`|`1h`)
-   `next_due_at` timestamptz not null
-   `last_checked_at` timestamptz
-   `last_snapshot_id` uuid null
-   `last_change_event_id` uuid null
-   `etag` text null
-   `last_modified` text null
-   `robots_checked_at` timestamptz null
-   `robots_status` text not null default `unknown` (`unknown`|`allowed`|`disallowed`)
-   `created_at`, `updated_at`, `deleted_at`

Indexes:

-   index(`user_id`, `status`)
-   index(`entity_id`)
-   unique(`user_id`, `url_canonical`) where `deleted_at is null`
-   index(`next_due_at`) where `status = 'active' and deleted_at is null`

#### `snapshots`

One fetched version (raw + extracted).

-   `id` uuid pk
-   `document_id` uuid fk -> documents(id) not null
-   `fetched_at` timestamptz not null
-   `fetch_method` text not null (`http`|`render`)
-   `http_status` int not null
-   `final_url` text not null
-   `content_type` text null
-   `raw_storage_key` text null (S3 key); null if not stored due to size/error
-   `raw_sha256` bytea not null
-   `extracted_text` text not null (normalized markdown-ish)
-   `extracted_sha256` bytea not null
-   `extract_version` int not null (bump when extractor changes)
-   `language` text null (optional detection)
-   `byte_size_raw` int null
-   `byte_size_extracted` int not null
-   `retention_delete_at` timestamptz not null
-   `created_at` timestamptz not null

Indexes:

-   index(`document_id`, `fetched_at` desc)
-   index(`extracted_sha256`)
-   index(`retention_delete_at`)

#### `diffs`

Diff artifact between two snapshots.

-   `id` uuid pk
-   `document_id` uuid fk -> documents(id) not null
-   `from_snapshot_id` uuid fk -> snapshots(id) not null
-   `to_snapshot_id` uuid fk -> snapshots(id) not null
-   `diff_format` text not null (`unified`|`segments_v1`)
-   `unified_diff` text not null
-   `diff_hunks` jsonb not null (structured, for citations)
-   `change_score` numeric not null (0..1)
-   `created_at`

Indexes:

-   unique(`from_snapshot_id`, `to_snapshot_id`)
-   index(`document_id`, `created_at` desc)

#### `change_events`

One meaningful change (ties diff + summary + notifications).

-   `id` uuid pk
-   `document_id` uuid fk -> documents(id) not null
-   `diff_id` uuid fk -> diffs(id) not null
-   `event_type` text not null (`meaningful_change`)
-   `title` text not null (generated, e.g., “Privacy Policy updated”)
-   `summary_status` text not null (`pending`|`completed`|`failed`|`skipped_quota`)
-   `summary_what_changed` jsonb null (bullets with citations)
-   `summary_why_matters` jsonb null (bullets with citations)
-   `summary_disclaimer` text not null
-   `summary_model` text null
-   `summary_prompt_version` int null
-   `summary_error` text null
-   `created_at`

Indexes:

-   index(`document_id`, `created_at` desc)
-   index(`summary_status`)

#### `notification_preferences`

-   `id` uuid pk
-   `user_id` uuid fk -> users(id) not null
-   `document_id` uuid fk -> documents(id) null (null means default)
-   `email_enabled` bool not null default true
-   `email_mode` text not null default `immediate` (`immediate`|`daily_digest`)
-   `created_at`, `updated_at`

Indexes:

-   unique(`user_id`, `document_id`)

#### `notifications`

-   `id` uuid pk
-   `user_id` uuid fk -> users(id) not null
-   `change_event_id` uuid fk -> change_events(id) not null
-   `channel` text not null (`email`)
-   `status` text not null (`queued`|`sent`|`failed`|`suppressed_unsubscribed`)
-   `to_email` text not null
-   `provider` text not null (`postmark`)
-   `provider_message_id` text null
-   `error` text null
-   `created_at`, `sent_at`

Indexes:

-   index(`user_id`, `created_at` desc)
-   index(`status`, `created_at`)

#### `jobs`

App-level job record for audit/visibility (Celery is execution; DB is visibility).

-   `id` uuid pk
-   `user_id` uuid null fk -> users(id)
-   `document_id` uuid null fk -> documents(id)
-   `job_type` text not null (`fetch`|`render`|`diff`|`summarize`|`notify`|`cleanup`)
-   `status` text not null (`queued`|`running`|`succeeded`|`failed`|`dead`)
-   `attempt` int not null default 0
-   `max_attempts` int not null default 5
-   `celery_task_id` text null
-   `error` text null
-   `started_at` timestamptz null
-   `finished_at` timestamptz null
-   `created_at`

Indexes:

-   index(`status`, `created_at`)
-   index(`document_id`, `created_at` desc)
-   index(`celery_task_id`)

#### `provider_usage`

Metering and cost controls (LLM, rendering, fetches).

-   `id` uuid pk
-   `user_id` uuid fk -> users(id) not null
-   `document_id` uuid fk -> documents(id) null
-   `provider` text not null (`openrouter`|`playwright`|`http_fetch`|`postmark`)
-   `action` text not null (`summary`|`render_fetch`|`http_fetch`|`email_send`)
-   `quantity` int not null default 1
-   `tokens_in` int null
-   `tokens_out` int null
-   `cost_usd_micros` bigint null
-   `period_key` text not null (e.g., `2026-01`)
-   `created_at`

Indexes:

-   index(`user_id`, `period_key`, `provider`, `action`)
-   index(`created_at`)

#### `audit_logs`

-   `id` uuid pk
-   `actor_user_id` uuid fk -> users(id) not null
-   `action` text not null
-   `target_type` text not null
-   `target_id` text not null
-   `metadata` jsonb not null default `{}`
-   `ip` inet null
-   `user_agent` text null
-   `created_at`

Indexes:

-   index(`actor_user_id`, `created_at` desc)
-   index(`action`, `created_at` desc)

#### `webhook_events`

Idempotency + replay defense.

-   `id` uuid pk
-   `source` text not null (`clerk`|`stripe`|`postmark`)
-   `external_id` text not null
-   `received_at` timestamptz not null
-   `processed_at` timestamptz null
-   `status` text not null (`received`|`processed`|`failed`)
-   `payload` jsonb not null
-   `error` text null

Indexes:

-   unique(`source`, `external_id`)
-   index(`status`, `received_at`)

---

## 9) API Design (REST)

### 9.1 API principles

-   JSON over HTTPS.
-   Versioned under `/v1`.
-   Cursor pagination where lists can grow.
-   All endpoints require auth except `/healthz` and marketing content.

**API versioning strategy**

-   **Short overlap period**: When `/v2` is introduced, `/v1` and `/v2` coexist for 3-6 months.
-   Deprecation warnings included in responses (`X-API-Deprecated: true`).
-   Aggressive migration push via email and dashboard banners.

**Error response format**

All errors return both machine-readable code and human-readable message:

```json
{
	"error": {
		"code": "DOCUMENT_LIMIT_EXCEEDED",
		"message": "You've reached your document limit. Upgrade to Pro for 25 documents.",
		"details": {
			"current": 3,
			"limit": 3,
			"tier": "free"
		}
	}
}
```

-   `code`: Machine-readable, screaming snake case (e.g., `RATE_LIMIT_EXCEEDED`, `INVALID_URL`, `ROBOTS_BLOCKED`).
-   `message`: User-friendly, suitable for direct display.
-   `details`: Optional structured context for debugging.

### 9.2 Authentication (Clerk)

**Client → API**

-   Web app obtains a Clerk session token (JWT).
-   Send `Authorization: Bearer <token>` to API.

**API verification**

-   Verify JWT signature via Clerk JWKS.
-   Validate:
    -   `iss`, `aud` (configured)
    -   `sub` (Clerk user id)
    -   expiration
-   Extract entitlement claims (see [13.4](#134-entitlement-enforcement-flow)).

**Backend configuration (env)**

-   `CLERK_ISSUER` (e.g. `https://clerk.<your-domain>`)
-   `CLERK_JWKS_URL` (e.g. `https://clerk.<your-domain>/.well-known/jwks.json`)
-   `CLERK_JWT_AUDIENCE` (your configured JWT template audience)
-   Optional: `CLERK_SECRET_KEY` for server→Clerk API calls (e.g. resolving email on first request)
-   Local dev only: `DEV_AUTH_BYPASS=1` + `X-Dev-Email` header (never enabled in prod)

**Admin role**

-   `role` comes from Clerk public metadata (mirrored to JWT custom claims).
-   API must still check DB `users.role` to allow emergency admin revocation.

### 9.3 Authorization model

-   Every resource is owned by `user_id`.
-   Access rule: `resource.user_id == current_user.id` OR `current_user.role == admin`.
-   Admin endpoints under `/v1/admin/*`.

### 9.4 Rate limiting (tier-based)

-   Use Redis sliding window.
-   Keys:
    -   `rl:user:{user_id}:{bucket}` and `rl:ip:{ip}:{bucket}`
-   Default buckets:
    -   `api_read`: 120 req/min (free), 300 req/min (pro), 600 req/min (business)
    -   `api_write`: 30 req/min, 60 req/min, 120 req/min
    -   `check_now`: 5/min, 20/min, 60/min (plus monthly quotas)
-   Return `429` with `Retry-After`.

### 9.5 UI/UX Design Decisions

#### 9.5.1 Platform & framework

-   **Web**: Single Next.js app (App Router) serving both marketing pages and the authenticated app.
-   **Mobile**: Responsive web only (no PWA/native in v0.1.0).

#### 9.5.2 Diff viewer (section-first)

-   **Default view**: Section-first collapsed view.
    -   Group changes by detected section/heading.
    -   Show section name + change indicator (additions/removals count).
    -   Click to expand section and see inline diff.
-   **Section detection (hybrid)**:
    -   Primary: Heuristic detection via H1-H6 tags, bold/strong first lines, numbered sections (1., 2., I., II.), ALL CAPS lines.
    -   Secondary: LLM semantic chunking to identify section boundaries.
    -   Cross-reference both methods for accuracy.
    -   Fallback: Paragraph-level grouping if no clear sections detected.
-   **Toggle**: User can switch to traditional unified or split diff view.

#### 9.5.3 Citation navigation

-   When user clicks a citation in the summary:
    -   Smooth scroll to the referenced hunk.
    -   Apply temporary highlight (fade after 2s).
    -   If in section view, auto-expand the containing section.

#### 9.5.4 Document history

-   **Recent-only in UI**: Show last 10 change events by default.
-   **Full history via export**: Complete history available via JSON/CSV export (tier-gated).
-   **Progressive disclosure**: "Show all history" link reveals full paginated list.

#### 9.5.5 Onboarding UX (add document flow)

-   **Inline URL validation**: When user enters URL in add-document form:
    1. Immediately validate URL format.
    2. Check robots.txt status.
    3. Show preview of extracted content (title, first paragraph).
    4. Display warnings if any (e.g., "This site uses heavy JavaScript, rendering may be required").
-   **Hybrid timeout**: Attempt synchronous validation for 10 seconds. If not complete, switch to async with "Processing..." placeholder.

#### 9.5.6 Error states

-   **Failed summary**: Show diff with banner: "AI summary unavailable for this change. [Learn why](link to docs)". No retry button in v0.1.0.
-   **Blocked by robots.txt**: Show specific blocking rule: "Disallow: /privacy matched by User-Agent: *". Link to view full robots.txt.
-   **URL gone (404/410)**: Auto-pause document silently. Show "Document paused: URL no longer accessible" status in dashboard. No email notification for this.
-   **PDF extraction failed**: "Image-based PDF could not be extracted. Text-based PDFs are supported."

#### 9.5.7 Entity lifecycle

-   **Rename**: Always allowed, no restrictions.
-   **Delete**: Soft-delete cascades to all documents under the entity.
    -   Confirmation modal: "Delete [Entity Name]? This will also delete X tracked documents and their history."
    -   Documents are soft-deleted; data retained per retention policy.

#### 9.5.8 Admin impersonation

-   Admins can enter read-only impersonation mode to see a user's dashboard as they see it.
-   **Audit trail**: Every impersonation session logged to `audit_logs` with start/end time, admin user, target user.
-   **Visual indicator**: Clear banner in impersonation mode: "Viewing as [user@email.com] (read-only)".

### 9.6 Endpoints (examples)

#### Health

`GET /healthz`

```json
{ "ok": true }
```

#### Entities

`POST /v1/entities`

```json
{
	"name": "Acme Corp",
	"websiteUrl": "https://acme.com"
}
```

Response:

```json
{
	"id": "0f5d0c7e-...-f2b",
	"name": "Acme Corp",
	"websiteUrl": "https://acme.com",
	"createdAt": "2026-01-09T19:00:00Z"
}
```

`GET /v1/entities?cursor=...&limit=20`

#### Documents

`POST /v1/entities/{entityId}/documents`

```json
{
	"url": "https://acme.com/privacy",
	"docType": "privacy",
	"scheduleTier": "daily",
	"fetchMode": "auto"
}
```

Response includes robots status and initial job:

```json
{
	"id": "b2d1...9a",
	"url": "https://acme.com/privacy",
	"status": "active",
	"robotsStatus": "allowed",
	"nextDueAt": "2026-01-10T00:00:00Z",
	"initialJob": { "jobId": "c91a...e2", "status": "queued" }
}
```

`POST /v1/documents/{documentId}/pause`

```json
{ "paused": true }
```

`POST /v1/documents/{documentId}/check-now`
Response:

```json
{ "jobId": "7b0c...12", "status": "queued" }
```

#### Document history

`GET /v1/documents/{documentId}/change-events?cursor=...&limit=20`

Response:

```json
{
	"items": [
		{
			"id": "ce1...",
			"createdAt": "2026-01-09T19:05:00Z",
			"title": "Privacy Policy updated",
			"summaryStatus": "completed"
		}
	],
	"nextCursor": null
}
```

#### Diff + summary

`GET /v1/change-events/{changeEventId}`
Response:

```json
{
	"id": "ce1...",
	"documentId": "b2d1...9a",
	"title": "Privacy Policy updated",
	"createdAt": "2026-01-09T19:05:00Z",
	"summary": {
		"whatChanged": [
			{
				"text": "Added language about sharing data with service providers for analytics.",
				"citations": [
					{
						"hunkId": "h3",
						"quote": "We may share information with analytics providers...",
						"side": "added"
					}
				]
			}
		],
		"whyItMatters": [
			{
				"text": "Your data may be used for broader tracking/measurement; consider opting out if available.",
				"citations": [
					{
						"hunkId": "h3",
						"quote": "analytics providers",
						"side": "added"
					}
				]
			}
		],
		"disclaimer": "This summary is informational and not legal advice."
	},
	"diff": {
		"format": "unified",
		"unified": "@@ ...",
		"hunks": [
			{
				"hunkId": "h3",
				"context": "Sharing of Information",
				"added": [
					"We may share information with analytics providers..."
				],
				"removed": []
			}
		]
	}
}
```

#### Admin

`GET /v1/admin/jobs?status=failed&limit=50`
`POST /v1/admin/jobs/{jobId}/retry`

### 9.7 Webhooks

#### Clerk webhook (user created/updated)

`POST /v1/webhooks/clerk`

-   Verify signature (Svix) using `CLERK_WEBHOOK_SECRET` (Clerk signing secret).
-   Upsert `users` row.
-   Initialize entitlements to `free` if not present.

#### Stripe webhook (subscription changes)

`POST /v1/webhooks/stripe`

-   Verify signature (Stripe signing secret).
-   Idempotency via `webhook_events`.
-   Update entitlements in **Clerk public metadata** and mirror to `entitlements` table.

**Webhook ordering**: UI ensures Clerk session is confirmed before triggering Stripe Checkout. This guarantees `user.created` webhook arrives before `checkout.session.completed`. If race occurs (user row missing), Stripe webhook returns 202 and logs warning.

---

## 10) Scraping + Normalization + Diff System

### 10.1 Fetch strategy (step-by-step)

**Race condition handling (scheduler vs check-now)**

Before enqueueing any fetch job, check `last_checked_at`:
- If `last_checked_at` is within the last 5 minutes, skip enqueue (dedupe by recency).
- This prevents scheduler and "check now" from racing on the same document.

**Pipeline (scheduled or on-demand)**

1. **Preflight**
    1. Validate URL (scheme, host, no credentials, no private IP).
    2. **URL canonicalization** (aggressive):
        - Strip `www.` prefix
        - Remove trailing slashes
        - Remove all query parameters (except known-meaningful like `locale`, `lang`)
        - Normalize to lowercase host
        - Store as `url_canonical` for deduplication
    3. Check robots decision:
        - if `robots_status != allowed`: block job and set `documents.status = blocked_robots`.
        - **Robots refresh**: Re-validate robots.txt daily (cache decision for 24h per host).
2. **HTTP fetch attempt**
    1. Use `httpx` with timeouts and size limits.
    2. Send conditional headers if present:
        - `If-None-Match: <etag>`
        - `If-Modified-Since: <last_modified>`
    3. Follow redirects up to 5, re-run SSRF checks per redirect hop.
    4. If `304 Not Modified`: store lightweight snapshot record (optional) OR record job success with no snapshot (v0.1.0: **no new snapshot**, just update `last_checked_at`).
3. **Decide JS rendering**
   Trigger render if any of:
    - document `fetch_mode == force_render`
    - content-type is HTML but extracted text is below minimum (e.g., < 500 chars)
    - page appears to be a JS shell (heuristics: `<div id="app">`, heavy scripts, very low text)
    - prior successful fetch_method was `render` and current http fetch differs drastically
4. **Render fetch (if triggered and quota allows)**
    1. Enqueue `render` job to renderer queue.
    2. Renderer uses Playwright Chromium to load the page, wait for network idle (bounded), then serialize DOM HTML.
5. **Store raw snapshot**
    1. Compress HTML/PDF (zstd or gzip) and upload to S3/R2.
    2. Compute `raw_sha256`.
6. **Extract & normalize text**
    1. **For HTML**: Parse HTML → remove scripts/styles.
    2. **For PDF**:
        - Use `pdfplumber` or `pdfminer` for text extraction.
        - If extracted text < 500 chars, apply OCR fallback via `Tesseract`.
        - If still minimal, mark as `error_unsupported_pdf` with message "Image-based PDF could not be extracted".
    3. **For iframe-embedded content** (e.g., Termly, iubenda):
        - First, parse HTML for iframes with policy-like URLs.
        - Attempt to fetch iframe `src` directly.
        - If content minimal (< 500 chars), fall back to full Playwright render of parent page.
    4. Main-content extraction: `trafilatura` (preferred) or `readability-lxml` fallback.
    5. Canonicalization rules (see [10.3](#103-canonicalization-rules-to-reduce-noise)).
    6. Compute `extracted_sha256`.
7. **Change detection**
    1. Compare extracted hash to previous snapshot:
        - if identical: no-op; update `last_checked_at`.
    2. If different: compute `change_score` and apply thresholds.
8. **Diff generation**
    1. Create unified diff.
    2. Create structured hunks for citations.
9. **AI summary (if within quota)**
10. **Persist ChangeEvent and notify**

### 10.2 Conditional GET and caching

-   Store `etag` and `last_modified` in `documents` from last 200 response.
-   Prefer HTTP fetch first (cheap). Rendering is a fallback (expensive).
-   Cache host-level DNS resolutions briefly (in-memory per worker) but re-check for SSRF on each job.

### 10.3 Canonicalization rules to reduce noise

Applied to extracted text and (where possible) DOM pre-extraction:

1. **Remove cookie/modals/banners** (DOM heuristics)
    - Drop nodes where id/class contains: `cookie`, `consent`, `banner`, `modal`, `popup`, `subscribe`, `newsletter`, `gdpr`.
2. **Remove navigation/footer boilerplate**
    - Drop common tags: `nav`, `footer`, `header` if extractor fails.
3. **Normalize whitespace**
    - collapse multiple spaces
    - normalize line endings to `\n`
4. **Timestamp normalization**
    - remove lines matching patterns:
        - `Last updated: ...`
        - `Effective date: ...`
        - dates in common formats when preceded by keywords
5. **Dynamic counters**
    - remove “© 2026” lines; remove “X users” counters.
6. **Stable ordering**
    - ensure consistent heading formatting, bullet normalization.
7. **Language hints**
    - keep original language; do not translate automatically in v0.1.0.

All rules are versioned via `extract_version` so changes are traceable.

**Extractor version migration**: When extractor is updated, new version only applies to future fetches. Existing snapshots keep their original extraction. No background re-extraction in v0.1.0.

### 10.4 Snapshot hashing and change detection thresholds

Compute:

-   `extracted_sha256`
-   `simhash` (optional v0.1.0; recommended for future)
-   `change_score` (0..1) using normalized Levenshtein ratio or token-based similarity.

**Meaningful change criteria (v0.1.0):**

-   extracted hash differs AND
-   either:
    -   added/removed characters >= 500, OR
    -   change_score >= 0.02 (2% change), OR
    -   added/removed contains keywords (configurable list: “share”, “sell”, “third-party”, “advertising”, “arbitration”, “jurisdiction”, “retention”, “opt out”)

Record the computed metrics in `diffs`.

### 10.5 Diff method and storage/display

-   Diff basis: **normalized extracted text**, split into lines by:
    -   headings and paragraphs (double newline boundaries)
    -   long paragraphs further split at sentence boundaries (simple regex)
-   Generate:
    -   `unified_diff` using `difflib.unified_diff`
    -   `diff_hunks` JSON with:
        -   `hunkId`
        -   context heading if detectable
        -   arrays of `added` and `removed` lines
        -   line ranges (for UI anchors)

UI renders:

-   “Summary” first (with citations)
-   Diff viewer with anchors for each `hunkId`
-   Clicking a citation scrolls and highlights its hunk.

---

## 11) AI Summarization via OpenRouter

### 11.1 Model strategy (configurable + fallback)

-   Primary model (default): `anthropic/claude-3.5-sonnet` (via OpenRouter)
-   Fallback model: `openai/gpt-4o-mini`
-   Emergency fallback: `google/gemini-1.5-pro`

Implementation:

-   Model list in config; choose first available within per-user budget.
-   Record selected model in `change_events.summary_model`.

**Backend configuration (env)**

-   `OPENROUTER_API_KEY`
-   Optional: `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)
-   Optional: `OPENROUTER_PRIMARY_MODEL`, `OPENROUTER_FALLBACK_MODEL`

### 11.2 Prompt strategy (grounded + citations)

**Hard requirements**

-   Summaries must be derived only from provided diff hunks.
-   Every bullet must include citations referencing `hunkId` + exact quote.
-   Must include “not legal advice”.

**Prompt outline (v1)**
System:

-   You are summarizing changes to a privacy policy / terms.
-   Use only provided hunks; do not speculate.
-   Produce JSON strictly matching schema.

User payload:

-   Document metadata (name, url, type)
-   Diff hunks structured:
    -   `hunkId`
    -   `context`
    -   `added[]`
    -   `removed[]`

Output JSON schema:

```json
{
	"what_changed": [
		{
			"text": "...",
			"citations": [{ "hunkId": "h3", "quote": "...", "side": "added" }]
		}
	],
	"why_it_matters": [
		{
			"text": "...",
			"citations": [{ "hunkId": "h3", "quote": "...", "side": "added" }]
		}
	],
	"disclaimer": "..."
}
```

### 11.3 Language handling

-   **Summary language matches source language**: If the policy is in French, the summary is in French.
-   No automatic translation in v0.1.0.
-   Language detection stored in `snapshots.language` for future use.

### 11.4 Citation validation (runtime)

After receiving LLM response, validate each citation:
1. For each `citation.quote`, verify it exists as a substring in the referenced `hunkId`.
2. If any citation fails validation:
    - Mark the specific bullet as `citation_invalid`.
    - Include the summary but flag: "Some citations could not be verified."
    - Log for model quality monitoring.
3. Never display fabricated quotes to users.

### 11.5 AI opinion and tone

-   **Clear opinion with caveats**: The AI may flag concerning patterns.
-   Acceptable: "This language typically indicates data sharing with third parties, which many users find concerning."
-   Acceptable: "This change appears to broaden the definition of 'business purposes'."
-   Not acceptable: "You must opt out immediately" or "This violates GDPR."
-   Always include disclaimer.

### 11.6 Safety constraints (user-facing)

-   Always include: "This summary is informational and not legal advice."
-   Disallow:
    -   telling the user what they "must" do legally
    -   claiming compliance/noncompliance
-   If diff is ambiguous, say so ("The policy text changed, but intent is unclear…").

### 11.7 Cost controls

1. Only run summary on meaningful changes.
2. Per-tier monthly summary quotas (see [13.2](#132-tiers-quotas-and-feature-gates)).
3. Token limits:
    - cap hunks passed to model: top N hunks by size/keyword score (default N=20)
    - cap per-hunk lines: truncate with indicator
4. Caching:
    - key: `(diff_id, model, prompt_version)` → reuse output
5. Metering:
    - record tokens/cost in `provider_usage`
6. Circuit breakers:
    - if OpenRouter error rate > threshold, mark summaries as `failed` and continue diff+notifications with "summary unavailable".

### 11.8 Evaluation & regression tests

-   Maintain a small golden dataset in repo:
    -   input: structured hunks
    -   expected: JSON shape + citations refer to existing hunks
-   Automated tests:
    1. schema validation
    2. citation validity (quote must be substring of specified hunk line)
    3. “no legal advice” present
-   Manual QA rubric for beta:
    -   correctness, non-hallucination, usefulness, readability.

---

## 12) Notifications (Email)

### 12.1 Provider choice

**Postmark** for transactional email.

**Backend configuration (env)**

-   `POSTMARK_SERVER_TOKEN`
-   `POSTMARK_FROM_EMAIL` (e.g. `Inplain <noreply@inplain.ai>`)

### 12.2 Email templates (v0.1.0)

1. "Change detected" (immediate)
    - Subject: `[Inplain] {Entity}: {Document type} updated`
    - Body:
        - 2–5 bullets "What changed" with citations
        - link to change event in app
        - disclaimer
2. "Daily digest" (Pro+ only)
    - **Timing**: Fixed 9:00 AM UTC for all users.
    - List of changes grouped by entity.
    - Summary counts: "3 policies changed across 2 companies".

Templates must include:

-   Unsubscribe link (per user)
-   Company address/footer as required by provider policy

### 12.3 Unsubscribe & preferences

-   Maintain a per-user email unsubscribe token:
    -   signed token (HMAC) or stored token in DB
-   Endpoint:
    -   `GET /v1/unsubscribe?token=...`
-   If unsubscribed:
    -   set a flag (store in `notification_preferences` with `document_id = null`)

### 12.4 Deliverability basics

-   Configure domain SPF/DKIM with Postmark.
-   Use a dedicated sender domain: `mail.inplain.ai`.
-   **IP strategy**: Start with Postmark's shared IP pool (good inherited reputation).
-   Monitor bounce/spam complaints via Postmark webhooks (future); for v0.1.0 log delivery failures and suppress repeated bounces.
-   **Future**: If sending volume exceeds ~10k/month, switch to dedicated IP for reputation isolation.

---

## 13) Monetization + Entitlements + Metering

### 13.1 Monetization model (v0.1.0)

Subscription SaaS with 3 tiers:

-   **Free**
-   **Pro** (individuals)
-   **Business** (teams-lite; still single-user in v0.1.0, higher limits)

Billing implemented in v0.1.0 using **Stripe Checkout + Customer Portal**, while **Clerk remains identity + entitlement source of truth**.

### 13.2 Tiers, quotas, and feature gates

| Feature / Quota       |                     Free |                      Pro |                 Business |
| --------------------- | -----------------------: | -----------------------: | -----------------------: |
| Tracked documents     |                        3 |                       25 |                      200 |
| Schedule frequency    |                    daily |                 every 6h |                 every 1h |
| On-demand "check now" |                   10/day |                  100/day |                  500/day |
| JS-render fetches     |                     0/mo |                   200/mo |                 2,000/mo |
| AI summaries          |               **10/mo**  |                   500/mo |                 5,000/mo |
| Email notifications   |    immediate (max 20/mo) | immediate + daily digest | immediate + daily digest |
| History retention     |                  30 days |                 180 days |                 730 days |
| Export (JSON/CSV)     | limited (last 10 events) |                     full |                     full |
| Custom ignore rules   |                       no |              no (future) |   yes (future, text patterns) |

Notes:

-   **Conservative free tier**: 10 AI summaries/mo (reduced from 30) to control LLM costs.
-   "Immediate (max 20/mo)" for Free prevents notification abuse and cost spikes.
-   Free still gets value: tracking + diff + some summaries.
-   **Export formats**: JSON and CSV supported for paid tiers.

### 13.3 Metering strategy (what we measure)

Record in `provider_usage`:

-   `http_fetch` quantity
-   `render_fetch` quantity
-   `summary` tokens and quantity
-   `email_send` quantity

Additionally enforce DB counters (fast to query per period):

-   monthly usage rollups (materialized in DB or computed with indexed queries on `provider_usage` for v0.1.0)

### 13.4 Entitlement enforcement flow

**Source of truth:** Clerk user identity + `publicMetadata` entitlements (plan, limits).

**Flow**

1. Stripe subscription changes (webhook) → API verifies signature → maps Stripe customer to Clerk user.
2. API updates Clerk `publicMetadata`:
    - `plan: free|pro|business`
    - `limits: {...}`
    - `period_end_at`
3. API mirrors to `entitlements` table (audit + internal joins).
4. Client UI reads plan via Clerk (and/or `/v1/me`).
5. API enforces on:
    - document creation
    - schedule tier changes
    - enqueueing on-demand checks
    - JS rendering triggers
    - LLM summary calls
    - notification sends

**Implementation detail**

-   Configure Clerk JWT template to include:
    -   `plan`
    -   `limits`
    -   `role`
-   API uses JWT claims first; optionally refresh from DB if missing.

### 13.5 Stripe integration details (v0.1.0)

-   Stripe objects:
    -   Product + Price per plan (monthly)
    -   Customer per Clerk user
-   Checkout:
    -   API endpoint `POST /v1/billing/checkout-session`
    -   requires authenticated user
    -   returns Stripe Checkout URL
-   Customer Portal:
    -   `POST /v1/billing/portal-session`
-   Webhooks handled at `/v1/webhooks/stripe`:
    -   `checkout.session.completed`
    -   `customer.subscription.created|updated|deleted`
    -   `invoice.payment_failed` (downgrade after grace period policy)

**Downgrade policy**

-   On non-payment:
    -   mark plan "past_due" internally (optional) for 7 days
    -   then downgrade to Free in Clerk metadata
-   On downgrade, jobs beyond limits are paused (documents set to `paused` with reason).
-   **User-controlled document selection on downgrade**:
    -   When downgrading from higher tier (e.g., Business 200 → Free 3), show UI: "Select 3 documents to keep active."
    -   User chooses which documents to keep; others are automatically paused.
    -   If user doesn't act within 7 days, auto-pause the oldest documents by `created_at`.

**Quota display UX**

-   **Passive dashboard display**: Show usage meters on settings/billing page (e.g., "8/10 AI summaries used this month").
-   **In-app banner**: When approaching limits (e.g., 80%+), display non-blocking banner: "You've used 8/10 AI summaries this month."
-   **Limit block UX**: When at limit and attempting action, show clear upgrade CTA: "You've reached your document limit. Upgrade to Pro for 25 documents."

### 13.6 Abuse prevention aligned with monetization

1. Rate limits per tier (API + job enqueue).
2. URL add throttling:
    - Free: max 5 new URLs/day
    - Paid: 50/day
3. Host-level politeness:
    - per-host concurrency limit (default 2)
    - per-host minimum delay (default 2s; adjustable)
4. Renderer quotas and backpressure:
    - renderer queue limited concurrency; reject render if user over quota
5. Email suppression:
    - if repeated bounces, suppress sends

---

## 14) Observability & Operations

### 14.1 Logging

-   Structured JSON logs for API and workers:
    -   `request_id`, `user_id`, `document_id`, `job_id`, `host`, `status`, `latency_ms`
-   Do not log full fetched content.
-   Log sampling:
    -   info for successful jobs sampled (e.g., 10%)
    -   errors always logged

### 14.2 Metrics (OpenTelemetry)

Collect:

-   API:
    -   request count/latency by endpoint and status
    -   rate-limit rejections
-   Workers:
    -   job durations by type
    -   queue depth (Celery/Redis)
    -   fetch success rate by host
    -   render success rate
    -   change detection rate
-   LLM:
    -   tokens/cost, failures, cache hit rate
-   Email:
    -   sent/failed counts

Export:

-   OTLP exporter to **Grafana Cloud** (metrics + traces) using env vars.

### 14.3 Tracing

-   Propagate `traceparent` from API → job enqueue → worker execution.
-   Trace spans:
    -   `fetch_http`, `fetch_render`, `extract`, `diff`, `summarize`, `notify_send`

### 14.4 Error tracking (Sentry)

-   Sentry for:
    -   frontend (React)
    -   API (FastAPI)
    -   workers (Celery)
-   Include release version `v0.1.0+gitsha`.

### 14.5 Alerting (initial thresholds)

-   Queue backlog:
    -   `fetch` queue depth > 10,000 for 10 min → warn
    -   renderer queue depth > 2,000 for 10 min → warn
-   Fetch failures:
    -   > 20% failures over 15 min globally → warn
    -   host-specific failures > 50% for top host → warn
-   LLM costs:
    -   daily cost > configured budget → warn
-   API errors:
    -   5xx rate > 2% for 5 min → page

---

## 15) CI/CD + Environments + Migrations

### 15.1 Repo structure (monorepo)

```text
/
  apps/
    web/                # Next.js (App Router) + Clerk
    api/                # FastAPI
    worker/             # Celery tasks + scraping pipeline
  packages/
    shared/             # shared schemas/constants (optional; keep minimal in v0.1.0)
  infra/
    railway/            # service docs, env var templates
  scripts/
    migrate/
    backup/
    restore/
  SPEC.md
```

### 15.2 Environments

-   `dev`: local docker compose (postgres, redis), local API/workers
-   `staging`: Railway project env, real Clerk test instance, Stripe test mode
-   `prod`: Railway prod env

### 15.3 Branch strategy

-   `main` always deployable.
-   Feature branches → PR → required checks.

### 15.4 GitHub Actions (required)

Checks:

1. Lint (Python: ruff; JS: eslint)
2. Typecheck (TS)
3. Unit tests (pytest, vitest)
4. Migrations check (Alembic autogenerate is clean or reviewed)
5. Security:
    - `pip-audit`
    - `npm audit` (non-blocking initially, but produce report)
6. Build images/artifacts

### 15.5 Migrations

-   Alembic for Postgres schema.
-   Railway deploy should run:
    -   `alembic upgrade head`
-   Backward compatibility:
    -   additive changes first; destructive changes require two-phase deploy.

### 15.6 Feature flags (v0.1.0)

-   Simple env-based flags:
    -   `ENABLE_BILLING`
    -   `ENABLE_RENDERING`
    -   `ENABLE_DAILY_DIGEST`
-   Optional DB-based flags post v0.1.0.

---

## 16) Security Deep Dive

### 16.1 Threat model

| Threat                                   |   Risk | Mitigation                                                                                                                            |
| ---------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| SSRF via URL tracking                    |   High | strict URL validation, DNS/IP blocklist, redirect re-validation, deny private ranges, timeouts, no credentials, port restrictions     |
| Renderer exploited by malicious page     |   High | isolate renderer worker, least secrets, timeouts, resource caps, no local file access, disable downloads, new browser context per job |
| Webhook spoofing (Clerk/Stripe)          |   High | verify signatures, idempotency keys, replay detection, store webhook events                                                           |
| Prompt injection from policy text        | Medium | do not allow free-form browsing; only summarize provided hunks; strict JSON schema; citations required                                |
| Data exfiltration via logs               | Medium | never log fetched content; redact tokens; structured logging                                                                          |
| Abuse: mass URL additions / DDoS         | Medium | per-tier quotas, rate limits, email verification required, host backoff                                                               |
| Unauthorized access to other users’ data |   High | row-level authz checks everywhere; admin endpoints restricted; tests for authz                                                        |
| Secret leakage                           |   High | env vars only; no secrets in client; rotate keys; separate service envs                                                               |
| SQL injection                            | Medium | ORM parameterization; no string concatenation                                                                                         |
| XSS in diff viewer                       | Medium | sanitize HTML; render extracted text as plain text; never inject raw HTML                                                             |

### 16.2 SSRF defenses for URL fetching

**Rules (enforced on add URL and before each fetch)**

1. Allow only `http://` and `https://`.
2. Disallow:
    - usernames/passwords in URL
    - non-standard ports (allow 80, 443 only)
    - IP literal URLs (IPv4/IPv6) unless explicitly allowed (v0.1.0: **disallow**)
3. DNS resolution:
    - resolve hostname
    - for each A/AAAA record, block if in:
        - RFC1918 private ranges
        - loopback
        - link-local
        - multicast
        - carrier-grade NAT
        - `169.254.169.254` (cloud metadata)
4. Redirects:
    - max 5
    - re-run full SSRF validation on each redirect target
5. Timeouts and size limits:
    - connect timeout 5s, read timeout 20s
    - max response size 5 MB (hard stop)
6. Content-type allowlist:
    - primarily `text/html`, `text/plain`
    - reject binaries

### 16.3 Crawler identity and User-Agent

**User-Agent strategy**: Use generic browser-like User-Agent to avoid blocking.

-   Default UA mimics Chrome: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
-   Rationale: Many sites aggressively block identified bots; generic UA provides better coverage.
-   Trade-off accepted: Less transparent, but aligned with product goal of reliable monitoring.

**Robots.txt handling**:
-   Use `*` as the effective User-Agent for robots.txt parsing.
-   Respect `Disallow` rules for all paths.
-   Cache robots.txt decisions for 24 hours per host.

### 16.4 Sandboxing/headless browser safety (Playwright)

Renderer worker hardening:

-   **Use playwright-stealth** plugin to bypass common headless detection:
    -   Mask WebGL vendor/renderer
    -   Add missing plugins
    -   Fix navigator properties
    -   Randomize canvas fingerprint
-   Use Playwright with:
    -   downloads disabled
    -   new incognito context per job
    -   blocked permissions (geolocation, notifications)
    -   block requests to:
        -   `file://`
        -   private IP ranges (request interception with same IP checks)
-   Resource caps:
    -   navigation timeout 30s
    -   total render time budget 45s
-   No access to Stripe/Clerk secrets in renderer env.
-   Renderer only needs:
    -   Redis, object storage write, minimal DB (optional; can return HTML via Redis result instead)

### 16.5 Webhook verification

-   Clerk:
    -   verify with Clerk signing secret
    -   store `external_id` and payload in `webhook_events`
-   Stripe:
    -   verify with Stripe signing secret
    -   idempotency: unique(`source`,`external_id`)
-   Reject payloads that fail verification with 401.

### 16.6 Encryption

-   In transit: HTTPS/TLS.
-   At rest:
    -   Railway Postgres encryption (platform)
    -   S3/R2 server-side encryption
-   Secrets:
    -   Railway env vars; rotate quarterly.

### 16.7 Audit logging

Log these actions to `audit_logs`:

-   create/delete document
-   pause/unpause
-   plan changes (from webhooks)
-   admin ban/unban
-   admin job retry
-   export requests (tier gated)

---

## 17) Performance & Scaling Plan

### 17.1 Expected load handling (v0.1.0 assumptions)

-   200k checks/day ≈ 2.3 checks/sec average, with bursts.
-   Renderer 40k/day ≈ 0.46/sec average; concurrency required for bursts.

### 17.2 Scaling levers

1. **Horizontal scale workers**
    - Increase `worker` replicas for `fetch/diff/summarize/notify`
    - Increase `renderer` replicas for JS-heavy
2. **Queue separation**
    - Celery routes:
        - `fetch` high throughput
        - `render` isolated and capped
        - `summarize` capped by budget
3. **Host politeness**
    - per-host concurrency and delay to reduce bans/timeouts
4. **Storage**
    - move heavy artifacts to object storage (already planned)
    - retention cleanup job
5. **DB indexing**
    - ensure `documents.next_due_at` index supports scheduler
    - ensure `snapshots(document_id, fetched_at desc)` supports history
6. **Backpressure**
    - if queue depth high, skip “nice-to-have” tasks:
        - summaries can be delayed
        - daily digest can be delayed

### 17.3 Scheduler design (recommended)

Avoid relying solely on Celery Beat for correctness. Use a dedicated scheduler service:

**Algorithm (every 30 seconds):**

1. Query:
    - `SELECT id FROM documents WHERE status='active' AND next_due_at <= now() LIMIT 500 FOR UPDATE SKIP LOCKED`
2. For each doc:
    - enqueue `fetch` job
    - set `next_due_at = now() + interval(schedule_tier)`
3. Commit.

This is horizontally scalable (multiple scheduler instances) due to `SKIP LOCKED`.

---

## 18) Runbooks

### 18.1 Scrape failures spike

**Symptoms**

-   alert: fetch failure rate > 20%
-   many jobs failing with timeouts/403/429

**Steps**

1. Check dashboards: failures by host, status codes.
2. Identify top failing hosts.
3. Apply mitigations:
    - increase per-host delay
    - reduce concurrency temporarily
    - honor `Retry-After` for 429
4. Verify robots decisions aren’t newly disallowing (robots fetch may be failing).
5. If a specific host blocks:
    - mark documents `paused` with reason
    - notify affected users in-app banner (future; v0.1.0: email only if enabled)
6. Postmortem: add host-specific rules if needed.

### 18.2 LLM costs spike

**Symptoms**

-   daily cost > budget
-   summary volume high

**Steps**

1. Check `provider_usage` breakdown by user and model.
2. Verify change detection thresholds (too sensitive?).
3. Apply immediate controls:
    - reduce summary generation to paid tiers only (feature flag)
    - switch to cheaper fallback model
    - cap hunks passed to LLM
4. Identify abuse:
    - users triggering frequent checks → rate-limit `check-now`
5. Follow-up:
    - improve canonicalization rules and thresholds.

### 18.3 DB CPU high / slow queries

**Symptoms**

-   API latency increases; Postgres CPU high

**Steps**

1. Inspect slow query logs (if enabled) or use `pg_stat_statements`.
2. Common culprits:
    - missing index on `documents.next_due_at`
    - large scans of `provider_usage`
3. Mitigation:
    - add/adjust indexes
    - add monthly rollup table for usage
    - reduce dashboard query frequency
4. If retention cleanup causes spikes:
    - batch deletes
    - run cleanup off-peak
    - consider partitioning snapshots later

### 18.4 Queue backlog

**Symptoms**

-   queue depth alert
-   scheduler enqueuing faster than workers can process

**Steps**

1. Check which queue is backed up (`fetch` vs `render` vs `summarize`).
2. Scale the corresponding worker service replicas.
3. Enable backpressure:
    - reduce schedule frequencies for free tier temporarily (feature flag)
    - pause renderer for free/pro if needed
4. Investigate external dependencies (S3 latency, OpenRouter errors).

### 18.5 Clerk auth incident / webhook failures

**Symptoms**

-   API returning 401 for valid sessions
-   users missing entitlements after payment

**Steps**

1. Check Clerk status dashboard.
2. Verify JWKS fetch caching:
    - ensure API caches JWKS with TTL and retries.
3. Webhook triage:
    - inspect `webhook_events` with status `failed`
    - retry processing (admin endpoint)
4. If entitlements missing:
    - use DB mirror `entitlements` as temporary fallback for enforcement
    - re-sync: query Stripe subscriptions and reapply to Clerk (admin script)

---

## 19) Rollout Plan

1. **Internal alpha (week 1)**
    - Enable only Free tier entitlements, billing disabled.
    - Focus: fetch/diff correctness, SSRF hardening, observability.
2. **Closed beta (week 2–3)**
    - Invite users, enable Pro/Business test mode billing (Stripe test).
    - Validate notifications and quotas.
3. **Public launch (v0.1.0)**
    - Enable Stripe live mode
    - Enable paid tiers
    - Publish status page (future; at minimum a `/status` page with uptime provider link)

---

## 20) Launch Readiness Checklists

### 20.1 Product checklist

-   [ ] Landing page with clear value prop + disclaimers
-   [ ] App onboarding: create entity + add document within 2 minutes
-   [ ] Diff viewer usable and readable
-   [ ] Summaries include citations and “not legal advice”
-   [ ] Email notifications working with unsubscribe
-   [ ] Tier gating visible in UI (limits displayed)
-   [ ] Export works per tier

### 20.2 Engineering / Ops checklist

-   [ ] Railway services provisioned: web, api, worker, renderer, scheduler, postgres, redis
-   [ ] DB migrations automated on deploy
-   [ ] Backups configured:
    -   [ ] Railway Postgres backups enabled
    -   [ ] nightly `pg_dump` to S3/R2 configured (script + cron job service if needed)
-   [ ] Object storage bucket with lifecycle policies
-   [ ] Sentry configured for all services
-   [ ] OTLP export configured and dashboards created
-   [ ] Alerts configured (queue, 5xx rate, fetch failure rate, LLM cost budget)
-   [ ] Robots.txt fetch + caching working; disallowed URLs blocked with clear UI copy
-   [ ] Scheduler correctness validated (no duplicate enqueues; `SKIP LOCKED` works)
-   [ ] Celery retry policies validated; dead-letter semantics implemented (mark `jobs.status=dead`)
-   [ ] Renderer hardening validated (timeouts, request interception, no private IP access)
-   [ ] Rate limiting enabled (user + IP); 429 responses include `Retry-After`
-   [ ] Abuse controls enabled (URL add throttles, per-tier quotas)
-   [ ] Admin dashboard working (jobs, failures, retries, user bans, plan overrides)
-   [ ] Data retention cleanup job running daily; tier-based retention enforced
-   [ ] Incident response contacts documented (internal)

### 20.3 Security checklist (must-pass)

**AppSec**

-   [ ] SSRF protections implemented for:
    -   [ ] URL validation on add
    -   [ ] re-validation on every fetch
    -   [ ] redirect hop checks
    -   [ ] renderer request interception checks
-   [ ] No fetched page content is logged (verify logs)
-   [ ] XSS protections:
    -   [ ] diff viewer renders as plain text (no raw HTML injection)
    -   [ ] sanitize any user-provided display fields (entity name) before render
-   [ ] CORS configured: allow only web origin(s)
-   [ ] Security headers on web:
    -   [ ] `Content-Security-Policy` (at minimum disallow `object-src`; restrict `frame-ancestors`)
    -   [ ] `X-Content-Type-Options: nosniff`
    -   [ ] `Referrer-Policy: strict-origin-when-cross-origin`
    -   [ ] `Permissions-Policy` (disable unnecessary APIs)
    -   [ ] HSTS enabled on apex + app subdomain
-   [ ] Secrets:
    -   [ ] no secrets shipped to client
    -   [ ] all secrets stored in Railway env vars
    -   [ ] Stripe/Clerk webhook secrets set and verified in staging/prod
-   [ ] Webhooks:
    -   [ ] signature verification implemented (Clerk + Stripe)
    -   [ ] idempotency implemented via `webhook_events`
-   [ ] AuthZ tests:
    -   [ ] user cannot access another user’s entities/documents/events
    -   [ ] admin-only endpoints blocked for non-admin
-   [ ] Dependency scanning passing (pip-audit; npm audit report reviewed)
-   [ ] Backups encrypted at rest (S3/R2 SSE enabled)

### 20.4 Billing & entitlement checklist (v0.1.0)

-   [ ] Stripe products/prices created (Free handled in-app; Pro/Business paid)
-   [ ] Checkout flow works end-to-end
-   [ ] Customer portal link works
-   [ ] Stripe webhooks update Clerk `publicMetadata.plan` and `limits`
-   [ ] API enforces entitlements for:
    -   [ ] document limits
    -   [ ] schedule tier limits
    -   [ ] JS render quotas
    -   [ ] AI summary quotas
    -   [ ] notification quotas
-   [ ] Downgrade policy tested (payment failure → grace → downgrade)
-   [ ] Manual admin override documented (DB + Clerk metadata sync)

### 20.5 Backup/restore checklist (production-safe)

-   [ ] Railway Postgres automatic backups enabled
-   [ ] Nightly logical backup job configured:
    -   `pg_dump` (custom format) + upload to S3/R2
    -   retention: 30 days (or aligned with compliance needs)
-   [ ] Restore run tested in staging:
    -   [ ] restore into empty DB
    -   [ ] run migrations
    -   [ ] validate app boot + can render a known change event
-   [ ] Object storage lifecycle policies set:
    -   raw HTML retention aligned to snapshot retention delete-at
    -   delete orphaned objects job implemented

---

## 21) Open Questions / Future Work

### 21.1 Decisions to revisit post v0.1.0

1. **Robots posture overrides**
    - Current: strict respect. Future: allow user to request monitoring even when disallowed only if legally safe (likely “no”; keep strict).
2. **Organizations / multi-user**
    - v0.1.0 is single-user per account. Add Clerk Organizations later:
        - entity ownership by org
        - roles: owner/admin/member
        - shared billing.
3. **Advanced ignore rules**
    - User-configurable “ignore selectors/phrases” to further reduce noise.
4. **Better semantic diff**
    - Add section-aware diffs (headings) and sentence-level alignment; consider a semantic embedding-based change classifier.
5. **Notification channels**
    - Slack/MS Teams/webhooks.
6. **Search**
    - Full-text search across snapshots and events (Postgres FTS or OpenSearch).
7. **Cost optimization**
    - Model routing by complexity; summarize only high-impact diffs for free tier.
8. **Domain verification for public dashboards**
    - Allow public “watchlists” or public change feeds (careful with abuse).
9. **Renderer isolation**
    - Consider running renderer in a more isolated environment (separate provider) if threat model demands.
10. **Content provenance UX**

-   Inline quote cards and “jump to diff hunk” improvements; “show me the exact sentence”.

### 21.2 Known constraints (accepted for v0.1.0)

1. Extractor is heuristic; some pages will still be noisy.
2. Some JS-heavy pages may block headless browsers; we’ll surface errors transparently.
3. Summaries may occasionally be incomplete; citations enforce grounding but not perfect interpretation.
4. Internationalized policies may be harder to summarize accurately without translation (not in v0.1.0).

### 21.3 Concrete roadmap items (next releases)

**v0.2**

-   Clerk Organizations + team billing
-   Slack notifications (paid)
-   Custom ignore rules (Pro+)
-   Per-host crawl policies and user-visible “politeness” settings
-   Better daily digest UX

**v0.3**

-   Public change feeds (opt-in)
-   Advanced diff modes (semantic sections)
-   Search across history
-   Export formats (PDF, CSV)

---

## Appendix A — Operational Details

### A.1 Retention cleanup job (step-by-step)

Runs daily on `maintenance` queue:

1. Select snapshots where `retention_delete_at <= now()` in batches of 500.
2. For each snapshot:
    1. Delete S3 object if `raw_storage_key` present.
    2. Delete dependent diffs/change events if required by retention policy:
        - v0.1.0: retain change events as long as diff and snapshots exist; delete cascade by FK or explicit deletes.
3. Delete snapshot row.
4. Vacuum strategy:
    - rely on autovacuum; monitor bloat and tune if needed.

### A.2 Backup job (step-by-step)

1. Run `pg_dump` with:
    - custom format (`-Fc`)
    - include schema + data
2. Upload to S3/R2 with key:
    - `backups/postgres/YYYY-MM-DD/backup.dump`
3. Write a small manifest file including:
    - git SHA
    - migration head revision
4. Emit metric `backup_success=1` or `0`.

### A.3 Restore procedure (step-by-step)

1. Create new Postgres instance (staging first; prod only during incident).
2. Download desired backup dump.
3. Restore:
    - `pg_restore --clean --if-exists`
4. Run migrations to current head (if restoring older dump).
5. Verify:
    - API `/healthz`
    - can fetch a known entity/doc/change event
6. Re-enable scheduler/workers.

---

## Appendix B — Celery Task Policies (v0.1.0)

-   Default retries:
    -   fetch/render: max 5 attempts, exponential backoff, jitter
    -   summarize: max 3 attempts, backoff; fail open (no summary)
    -   notify: max 5 attempts
-   Dead-letter behavior:
    -   on max attempts exceeded → `jobs.status = dead`, store `error`
-   Time limits:
    -   fetch: 60s hard
    -   render: 90s hard
    -   summarize: 60s hard

---

## Appendix C — Admin Tooling (minimum scope)

Admin UI pages (behind admin role):

1. **Jobs**
    - filter by status/type
    - view error, attempt count, related doc/user
    - retry button
2. **Users**
    - search by email/clerk id
    - ban/unban
    - plan override (writes Clerk metadata + DB mirror)
3. **Abuse dashboard**
    - top users by checks/day
    - top hosts by failures
4. **LLM usage**
    - daily cost estimate
    - top users by tokens

---

## Appendix D — Legal/Safety UX Copy (required)

-   On every summary view:
    -   “This summary is generated by AI from the detected text changes and is provided for informational purposes only. It is not legal advice.”
-   On add-document:
    -   “Only add publicly accessible URLs you have the right to monitor. We respect robots.txt and apply rate limits.”

---

## Appendix E — Default Config Values (v0.1.0)

-   Fetch:
    -   max redirects: 5
    -   max response size: 5 MB
    -   connect timeout: 5s
    -   read timeout: 20s
-   Renderer:
    -   navigation timeout: 30s
    -   total budget: 45s
-   Politeness:
    -   per-host concurrency: 2
    -   per-host delay: 2s
-   Change detection:
    -   minimum added/removed chars: 500
    -   change_score threshold: 0.02
-   Summaries:
    -   max hunks: 20
    -   prompt_version: 1

---

## Appendix F — Interview Decisions Summary (v0.1.0-rev1)

This appendix documents all decisions made during the product interview process. Each decision is cross-referenced to the relevant spec section.

### Content & Extraction

| Decision | Choice | Section |
|----------|--------|---------|
| PDF support | Handle PDFs + OCR fallback | FR-3, 10.1 |
| Iframe handling | Detect src first, fallback to full render | 10.1 |
| URL canonicalization | Aggressive (strip www, slashes, query params) | 10.1 |
| Extractor migration | Future fetches only (no backfill) | 10.3 |

### AI & Summaries

| Decision | Choice | Section |
|----------|--------|---------|
| Summary language | Match source language | 11.3 |
| Citation validation | Runtime validation (verify quotes exist) | 11.4 |
| AI opinion style | Clear opinion with caveats | 11.5 |
| Free tier AI limit | 10 summaries/month (conservative) | 13.2 |

### UI/UX

| Decision | Choice | Section |
|----------|--------|---------|
| Diff viewer | Section-first (collapsed) | 9.5.2 |
| Section detection | Hybrid (heuristic + semantic) | 9.5.2 |
| Citation navigation | Scroll + highlight + auto-expand | 9.5.3 |
| History display | Recent 10, export for full | 9.5.4 |
| Add document flow | Inline validation with hybrid timeout | 9.5.5 |
| Failed summary UX | Diff only with clear message | 9.5.6 |
| Mobile | Responsive web only | 9.5.1 |
| Marketing site | Next.js hybrid SSR | 9.5.1 |

### Quotas & Limits

| Decision | Choice | Section |
|----------|--------|---------|
| Quota display | Dashboard + in-app banner | 13.5 |
| Limit block | Block with upgrade CTA | 9.5.5 |
| Downgrade handling | User chooses which docs to keep | 13.5 |

### Technical

| Decision | Choice | Section |
|----------|--------|---------|
| Race condition (scheduler vs check-now) | Dedupe by recency (5 min) | 10.1 |
| Webhook ordering | UI ensures Clerk first | 9.7 |
| API versioning | Short overlap (3-6 months) | 9.1 |
| Error format | Code + message + details | 9.1 |
| Robots.txt refresh | Daily cache | 10.1 |
| User-Agent | Generic browser-like | 16.3 |
| Renderer stealth | playwright-stealth enabled | 16.4 |
| Email IP strategy | Shared (Postmark default) | 12.4 |
| Daily digest timing | Fixed 9am UTC | 12.2 |
| Data residency | US-only, documented | 5.4.1 |

### Admin

| Decision | Choice | Section |
|----------|--------|---------|
| Admin impersonation | Allow with audit trail | 9.5.8 |

### Crawling Posture

| Decision | Choice | Section |
|----------|--------|---------|
| Adversarial response | Committed to transparency/scrutiny | 21 |
| URL gone (404) | Auto-pause silently | 9.5.6 |
| Robots blocked | Show specific rule | 9.5.6 |

### Future (text patterns for ignore rules)

| Decision | Choice | Section |
|----------|--------|---------|
| Custom ignore rules | Text patterns (not CSS selectors) | 13.2 |
| Export formats | JSON + CSV | 13.2 |
