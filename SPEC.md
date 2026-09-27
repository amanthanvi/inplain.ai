# inplain.ai — SPEC v0.3

> A public, permanent record of how the privacy policies and terms of service of
> well-known companies change over time.

**Status:** rebuild, decided 2026-08-03. Supersedes v0.2.0 on the `refresh`
branch, which was assessed subsystem-by-subsystem and largely superseded — see
`docs/refresh-salvage-plan.md` on that branch. This document is written from
scratch, not ported, because the previous frame is what produced the defects.

---

## 1. What this is

A crawler watches a curated set of public policy documents. When one changes, the
site publishes the changed passages, an AI summary that cites those passages, and
a link to the source. Anyone can read it. Nobody logs in.

**The whole product is one sentence:** *what changed, why it matters, and the
evidence.*

## 2. What it is not

Each of these was in v0.2.0 and is deliberately gone. The reason is the same in
every case: it existed to serve a user model that no longer exists.

| Not | Why |
|---|---|
| **Accounts, auth, Clerk** | With no email and no billing, an account bought a watchlist and a notification you'd only see if you already came back. Circular. |
| **Email** | Owner decision. No email, ever — no digests, no alerts, no transactional mail. |
| **Billing, tiers, quotas, entitlements** | No revenue timeline. Tiers existed to ration duplicated work that §4 eliminates. |
| **An HTTP API / BFF** | The worker never called it. ~1,100 lines existed to move rows into a server component. |
| **A database** | See §4. Git is the datastore. |
| **A headless-browser renderer** | 52/52 catalog URLs pass over plain HTTP. The pages that fail do so via anti-bot IP blocking, which a browser does not fix. |
| **PDF extraction and OCR** | Zero PDFs in the catalog. Never executed in production. |
| **Self-hosted PostHog, Redis, a proxy service** | Analytics infrastructure for a product with no users. |
| **In-app notifications** | Nothing to notify, nobody to notify. |
| **Full-text republication** | We link to the source. See §5. |

## 3. The one thing that must be true

**A citation must point at text that actually appears in the diff, on the side
the claim asserts.** Everything else here is a preference. This is the product.

v0.2.0 failed this: its fuzzy "repair" tier assigned a *different line* to the
model's claim, and merged added and removed text into one haystack, so a quote
could validate against the very text it replaced. A confidently wrong citation is
worse than no product.

Rules:
- Exact match, or whitespace/case-tolerant match. Nothing else.
- Every citation carries `side: added | removed` and validates against that side
  only.
- A claim whose citation does not validate is **dropped**, not downgraded.
- No fuzzy substitution, at any threshold. There is no similarity score that
  separates a dropped comma from a negation flip.

## 4. Architecture

```
catalog.json ──> crawler (Python) ──> documents/<company>/<doc>.txt
                                              │
                                         git commit
                                              │
                    ┌─────────────────────────┴──────────────────────┐
                    │                                                │
              change detection                                 site generator
              (git diff, hunks)                                (static HTML + RSS)
                    │                                                │
              AI summary (cited) ──────> changes/<id>.json ──────────┘
```

**Git is the datastore.** Each tracked document is a text file. The crawler
rewrites it; a change is a commit; the history of a policy *is* the git history of
its file. No Postgres, no SQLite, no service. The archive is auditable by anyone
with `git log`, which is the correct trust property for this product.

**The site is static.** Generated on change, served from a CDN. No server
runtime, no request-time code, nothing to attack, near-zero cost.

**Everything runs in CI on a schedule.** The crawl, the diff, the summary, the
build, the deploy. There is no always-on process.

### Why this shape
It collapses six services to zero, deletes the entire class of bugs the salvage
plan found (transaction-scoped network calls, at-least-once duplicate LLM spend,
entitlement writes during GET renders, an unsigned service boundary), and makes
the product's own history inspectable with the same tool it is built on.

## 5. Content policy

We publish: **changed passages, the cited summary, and a link to the source.**

We do not mirror full policy text. Republishing 24k–210k characters × 52
documents is wholesale reproduction of copyrighted works; publishing the changed
passages with commentary is not the same act and is a far smaller surface.

Full snapshots are retained in the repository as the diffing substrate — they are
the input, not the publication.

## 6. Catalog

`catalog.json`, 30 companies / 52 URLs, all validated 200 + robots-allow +
≥500 extracted characters. Contributions by pull request against that file.

A document is dropped, not tracked-and-broken, when it cannot be fetched
lawfully or reliably — see the reddit and coinbase/etsy precedents in the git
history of that file.

## 7. Change detection

- **Materiality is measured in absolute changed content, not similarity ratio.**
  A whole-document ratio cannot express "one clause got materially worse": a
  67-character "we now sell your personal information" insert into a 65k policy
  scores ~0.003. The ratio is a display badge, nothing more.
- The threshold is *one full sentence* of added or removed prose. Below that,
  and matching a small set of known-cosmetic patterns, it is suppressed.
- **Effective-date and "last updated" lines are a signal, not noise.** v0.2.0
  stripped them before hashing, which made the single most legally meaningful
  line in a policy structurally invisible. They are tracked and surfaced.
- Every suppression records its reason. A change hidden without a recorded
  rationale is unacceptable in a trust product.

## 8. Crawling conduct

- One honest crawler identity, sent to origins *and* evaluated against robots.
  v0.2.0 sent a spoofed Chrome UA while evaluating robots as `inplain.ai`, so
  sites were structurally unable to apply rules to it. On a privacy-transparency
  product that is indefensible.
- robots.txt via `protego`, not a hand-rolled parser. Re-checked on every
  redirect hop, not just the initial URL.
- Conditional GET (ETag / Last-Modified), per-host politeness delay, streaming
  size cap, SSRF validation with per-hop revalidation.
- Daily is sufficient. Policies change a few times a year.

## 9. Design

Direction is chosen from prototypes in `prototypes/` — see `prototypes/README.md`.
Non-negotiable floor, from measured failures in v0.2.0:

- Colour is never the only cue on a diff. `+`/`−` gutter and text labels always.
- Visible `:focus-visible` on every interactive element, ≥3:1.
- Citation controls meet AA. In v0.2.0 the primary summary→evidence control was
  the smallest, lowest-contrast element on the page at 3.08:1.
- Light and dark designed separately, not swapped by token.
- A spacing scale, a type scale, and no raw hex or px outside the token layer,
  enforced by lint in CI.
- `@media print` exists. This is an evidence tool.
- Reduced-motion covers everything, including smooth scroll.

## 10. Acceptance criteria

- **AC-1** A crawl of the full catalog completes and commits only genuinely
  changed documents.
- **AC-2** A changed document produces a change record with hunks, a summary, and
  ≥1 validated citation per claim.
- **AC-3** Every published citation's quote appears verbatim in the hunk it names,
  on the side it names. Enforced by test, not by review.
- **AC-4** A claim whose citation does not validate never reaches the site.
- **AC-5** An effective-date-only change produces a change record.
- **AC-6** A robots-disallowed URL is never fetched, including after a redirect.
- **AC-7** The site builds to static files and is fully readable with JavaScript
  disabled.
- **AC-8** RSS feeds — global and per company — validate.

## 11. Open

- ~~Hosting target for the static site and the scheduled crawl~~ — **resolved
  2026-08-19: GitHub Actions + GitHub Pages** (`docs/hosting.md`; Pages deploy
  gated behind the repo going public, which is itself gated on the credential
  rotation in issue #8; its history rewrite was executed on 2026-08-03).
- ~~Model and provider for summaries~~ — **provisionally resolved 2026-08-19:
  `claude-sonnet-5` via Anthropic direct, one outage-only fallback**
  (`docs/model-eval.md`). The 17-entry golden set and `eval/run_eval.py` are
  committed; the pick is confirmed by the measured exact-quote citation
  validity rate once an API key lands in repo secrets.
- ~~Design direction~~ — **re-decided 2026-09-27: direction D, "register"**,
  with Literata self-hosted as the one typeface (`prototypes/README.md`,
  issue #37). Provisional under the owner's delegation.
- ~~Whether word-level intra-line highlighting ships in v1~~ — **resolved
  2026-08-19: no.** Line-level marks in v1; the hunk schema reserves
  `word_spans` so it can ship later without a format change. See
  `docs/decisions/G1-word-level-highlighting.md`.

## 12. Decisions

| Decision | Choice | Reversed from v0.2.0? |
|---|---|---|
| Accounts | None | **Reversed** — was Clerk auth |
| Email | Never | Upheld (was already a non-goal) |
| Billing | None | **Reversed** — was 3 paid tiers |
| Datastore | Git | **Reversed** — was Postgres |
| API | None | **Reversed** — was FastAPI + HMAC BFF |
| Site | Static | **Reversed** — was server-rendered Next |
| Renderer | None | **Reversed** — was a Playwright service |
| Content | Hunks + link | **Reversed** — was full-text republication |
| Return trigger | RSS | **Reversed** — was in-app notifications |
| Citations | Exact/tolerant only | **Reversed** — was three-tier with fuzzy repair |
| Materiality | Absolute content | **Reversed** — was similarity ratio |
| Effective dates | Tracked | **Reversed** — were stripped as noise |
| Crawler identity | Honest | **Reversed** — was a spoofed Chrome UA |
| Postgres-as-queue | N/A | Dropped with the database |
| Curated catalog only | Upheld | — |
| trafilatura-only extraction | Upheld | — |
| Conditional GET, politeness, SSRF checks | Upheld | — |
