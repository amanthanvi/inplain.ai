# Hosting the inplain.ai capture pipeline — research findings

**Date:** 2026-08-03. All limits/prices verified against primary sources on this date; citations inline.

---

## TL;DR

**Yes — the whole thing can run on Vercel alone, and you should delete the Python scraper.**

The premise that you need a headless browser is mostly wrong. I empirically tested 90 real
privacy-policy URLs (the 19 in your `companies.csv` plus 71 more matching your curated-set
profile) with a plain HTTP GET and no JavaScript execution. **76% returned the complete policy
text; ~80% with URL cleanup.** All five of the companies you named — Google, Meta, Apple,
Microsoft, Amazon — are fully server-rendered.

More importantly: **the ~15 pages that fail are failing on bot-blocking (403 from
Akamai/Cloudflare), not client-side rendering.** A headless browser on Vercel would not fix
them, because the block is triggered by datacenter IP reputation before any JavaScript runs.
So "put Playwright somewhere" solves a problem you don't have and fails to solve the one you do.

**Recommendation:** Vercel Cron → one Node function → `fetch` + Readability. ~$0.03/month of
compute on top of your existing plan. Handle the blocked tail separately (or not at all).

---

## 1. Vercel Functions today

Fluid compute is now the default and it did change the numbers. Source:
[Vercel Functions Limits](https://vercel.com/docs/functions/limitations) (doc last updated 2026-07-01).

### Max duration

| Plan | Default | Maximum | Extended maximum |
|---|---|---|---|
| Hobby | 300s | **300s** | — |
| Pro | 300s | **800s** | 1800s (beta) |
| Enterprise | 300s | 800s | 1800s (beta) |

The 800s max is GA for Pro/Enterprise. The 1800s extended max is in beta, requires
function-level config, and is not supported with Secure Compute or Static IPs.

Note this is a real change from the pre-fluid era (Hobby was 10s, Pro 60s default). **Hobby now
gets a full 5 minutes**, which turns out to be more than enough here.

### Memory

| Plan | Default | Maximum |
|---|---|---|
| Hobby | 2 GB / 1 vCPU | **2 GB / 1 vCPU** |
| Pro / Enterprise | 2 GB / 1 vCPU | **4 GB / 2 vCPU** |

### Bundle size

- **250 MB uncompressed** for Node.js (500 MB for Python) — enforced by AWS Lambda underneath.
- **Large functions** now allow up to **5 GB** uncompressed, on Node.js and Python, requiring
  fluid compute with Active CPU. Enable with `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`. Not supported
  with Secure Compute or Static IPs.

Other limits worth knowing: request/response body cap **4.5 MB**; **1,024 file descriptors**
shared across concurrent executions (relevant if you fan out 85 concurrent HTTP requests —
stay well under this with a concurrency cap).

### Is headless Chromium viable on Vercel?

**Technically yes, and Vercel officially documents it** — but it's the wrong tool here.

- Vercel's own KB guide,
  [Deploying Puppeteer with Next.js on Vercel](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel),
  recommends `puppeteer-core` + **`@sparticuz/chromium-min`**, explicitly citing "the function
  bundle size limitation (250MB)" as the reason you can't use stock `puppeteer`.
- `@sparticuz/chromium` is alive and maintained: **v149.0.0, published 2026-05-27** (npm registry).
  Unpacked size **69.7 MB**. `@sparticuz/chromium-min` is **46 KB** (it downloads the Brotli
  Chromium bundle from a URL you host at runtime). `playwright-core` is **13.4 MB**.
- Arithmetic: full `@sparticuz/chromium` (69.7 MB) + `playwright-core` (13.4 MB) ≈ 83 MB, which
  *does* fit inside 250 MB. Vercel still recommends `-min` because a Next.js app's traced server
  bundle eats into the same budget. With large functions (5 GB) the size question is moot.
- Memory: the Sparticuz README warns Chromium needs **≥512 MB, 1600 MB+ recommended**. Hobby's
  2 GB works; it's tight but workable.

**What breaks in practice:**
1. **Missing shared libraries.** The recurring `libnspr4.so` / `libnss3` errors on newer Node
   runtimes are the single most-reported failure
   ([Vercel Community](https://community.vercel.com/t/puppeteer-on-node-22-x-missing-libnspr4-so/23372)).
   Version-matching `@sparticuz/chromium` to the runtime is a permanent maintenance tax.
2. **Cold starts.** With `-min`, every cold start downloads ~50-100 MB of compressed Chromium
   and decompresses it to `/tmp`. That's 5-15s before you fetch a single page.
3. **Bundler config.** The package must be marked external (`serverExternalPackages` in Next).
4. **It doesn't solve your actual problem** — see §4.

---

## 2. Vercel Cron

Source: [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
(doc last updated 2026-06-16).

| | Cron jobs per project | Minimum interval | Scheduling precision |
|---|---|---|---|
| **Hobby** | 100 | **Once per day** | **Per-hour (±59 min)** |
| **Pro** | 100 | Once per minute | Per-minute |
| **Enterprise** | 100 | Once per minute | Per-minute |

Key details:
- On Hobby, a cron expression that would fire more than once a day **fails at deployment time**
  with an explicit error. It is not silently downgraded.
- Hobby timing is genuinely loose: `0 1 * * *` fires anywhere between 01:00 and 01:59.
- **Timeout interaction:** cron jobs simply invoke a Vercel Function, so the function's
  `maxDuration` is the ceiling — 300s on Hobby, 800s on Pro. There is no separate cron timeout.
- Cron jobs are included on all plans; you pay only the underlying function usage.

**For daily policy monitoring, Hobby's "once per day, ±59 min" is exactly the requirement.**
The precision limit is irrelevant when your target changes a few times a year.

⚠️ **The real Hobby blocker is licensing, not limits.** Per
[Vercel's Hobby plan docs](https://vercel.com/docs/plans/hobby): "the Hobby plan restricts users
to non-commercial, personal use only." If inplain.ai is or becomes a product, you need Pro
($20/developer seat/month).

---

## 3. Alternatives for a small scheduled scraper

Included for completeness, but see §4 before choosing any of them.

### Cloudflare Workers + Browser Rendering + Cron Triggers

- **Workers pricing** ([docs](https://developers.cloudflare.com/workers/platform/pricing/)):
  Free = 100,000 req/day, **10 ms CPU per invocation**. Paid = **$5/month min**, 10M requests +
  30M CPU-ms included, then $0.30/M requests and $0.02/M CPU-ms.
- **Cron Triggers** ([limits](https://developers.cloudflare.com/workers/platform/limits/)):
  **5 per account on Free, 250 on Paid** (account-level, not per-Worker). CPU time for a
  cron invocation: **10 ms on Free** — useless — vs **30s (interval <1h) or 15 min (interval ≥1h)
  on Paid**. A daily cron on Paid gets the 15-minute CPU budget.
- **Browser Rendering**
  ([limits](https://developers.cloudflare.com/browser-rendering/platform/limits/),
  [pricing](https://developers.cloudflare.com/browser-rendering/platform/pricing/)):
  Free = **10 minutes of browser time per day**, 3 concurrent browsers, 1 new instance/20s.
  Paid = **10 browser hours/month included, then $0.09/hour**; 10 concurrent averaged monthly,
  then $2.00/browser; 120 concurrent cap. Default browser timeout 60s (extendable to 10 min
  via `keep_alive`).
- **Storage:** R2 ([pricing](https://developers.cloudflare.com/r2/pricing/)) free tier is
  10 GB-month, 1M Class A ops, 10M Class B ops, **zero egress fees**; paid $0.015/GB-month.
- **Scale-to-zero:** inherent. No cold-start problem for the Worker itself; browser sessions
  take a few seconds to acquire.
- **Verdict:** the cheapest credible browser-capable option at **$5/month**. But Cloudflare
  Workers egress from Cloudflare datacenter IPs, which does not solve the blocking problem (§4).

### Render

- **Free tier excludes exactly what you'd need**: per
  [Render's free tier docs](https://render.com/docs/free), free covers web services, Postgres,
  Key Value and static sites — **"Background workers and cron jobs are paid-only services."**
  Free web services also spin down after 15 min idle (~1 min cold start) and are capped at
  750 instance-hours/month.
- **Cron jobs** ([docs](https://render.com/docs/cronjobs)): **$1/month minimum per cron service**,
  then prorated per-second on actual runtime. Hard **12-hour** cap per run. Useful guarantee:
  "at most one run of a given cron job is active at a given time" — no overlapping runs.
- **Instance types** ([docs](https://render.com/docs/compute-plans)): cron jobs can use Starter
  (512 MB, 0.5 CPU) through Pro Plus (8 GB, 4 CPU).
  ⚠️ *Could not verify exact instance dollar prices from a primary page — render.com/pricing did
  not render for me. Search snippets indicate Starter $7/mo and Standard (2 GB) $25/mo; treat
  as unconfirmed. The $1/month cron minimum and per-second proration are confirmed from docs.*
- **Verdict:** a Docker cron job with Playwright preinstalled is genuinely simple here, and
  per-second billing means a daily 60s run costs the $1 minimum. Best "just works with a real
  browser" option if you decide you need one.

### Railway

- **Plans** ([docs](https://docs.railway.com/reference/pricing/plans)): Free $0 with $1 monthly
  credit; **Hobby $5/mo including $5 of usage**; Pro $20/mo including $20 of usage.
- **Rates:** RAM **$10/GB/month**, CPU **$20/vCPU/month**, egress $0.05/GB, volumes
  $0.15/GB/month.
- **Cron** ([docs](https://docs.railway.com/cron-jobs)): standard 5-field crontab on any service;
  **minimum frequency every 5 minutes**. The service is expected to run its task and exit.
- **Scale to zero** ([docs](https://docs.railway.com/deployments/serverless)): Serverless mode
  detects inactivity after **10 minutes** with no outbound packets; "sleeping services don't
  incur resource usage."
- **Verdict:** fine, roughly interchangeable with Render. A daily 60s Playwright run costs
  cents against the $5 Hobby credit.

### Fly.io

- **Pricing** ([docs](https://fly.io/docs/about/pricing/)): cheapest `shared-cpu-1x` with 256 MB
  RAM is **~$2.02/month** (region-dependent); additional RAM **~$5/GB/30 days**.
- **No free allowance for new Pay-As-You-Go customers** — legacy free tiers only apply to orgs
  on deprecated Hobby/Launch/Scale plans from before October 2024. This is a common
  out-of-date belief worth correcting.
- **Scale to zero:** stopped machines bill only rootfs storage, **$0.15 per GB per 30 days**.
  With `auto_stop_machines`, a machine that runs 60s/day is nearly free — but Chromium needs
  ~1-2 GB RAM while running, so size for the running state.
- **Verdict:** cheapest raw compute, most operational overhead. You'd wake a machine from a
  scheduler you host elsewhere, or run a cron inside a always-on 256 MB machine.

### Hosted browser APIs

| Service | Free tier | Cheapest paid | Notes |
|---|---|---|---|
| **Browserbase** ([pricing](https://www.browserbase.com/pricing)) | $0: 1 browser hour, 3 concurrent | **$20/mo Developer**: 100 browser hours, 25 concurrent, then $0.12/hr | Startup $99/mo: 500 hrs, $0.10/hr overage |
| **Browserless** ([pricing](https://www.browserless.io/pricing)) | 1,000 units/mo, 2 concurrent | **$25/mo Prototyping** (billed annually): 20,000 units, 10 concurrent | A "unit" = up to 30s of browser time. Residential proxy 6 units/MB; captcha solve 10 units |
| **ScrapingBee** ([pricing](https://www.scrapingbee.com/#pricing)) | 1,000 credits (one-time trial) | **$49/mo Freelance**: 250,000 credits, 50 concurrent | Credits ([docs](https://www.scrapingbee.com/documentation/)): 1 = no JS, **5 = JS render (default)**, 10 = premium proxy no JS, **25 = premium proxy + JS**, **75 = stealth proxy** |

All three support scheduled use trivially (they're just HTTP APIs you call from any cron).
None has a cold-start problem you manage. **Crucially, these are the only options that bundle
residential/stealth proxies**, which is the actual differentiator for the blocked tail (§4).

At your scale — ~15 hard pages × 30 days = 450 requests/month — ScrapingBee's stealth proxy
(75 credits) needs 33,750 credits/month, comfortably inside the $49 Freelance plan, but $49 is
steep for 15 pages. Browserbase Developer at $20/mo would need ~4 browser hours/month out of
100 included.

---

## 4. KEY FINDING: how many pages actually need a browser?

I tested this directly rather than guessing.

### Method

90 real policy URLs — the 19 in `companies.csv` plus 71 more chosen to match your curated-set
profile (big tech, social, fintech, retail, streaming, telco, SaaS, travel). Plain HTTP GET,
realistic Chrome headers, HTTP/2, follow redirects, **no JavaScript execution**. Then strip
`<script>/<style>/<head>`, strip tags, count visible characters, and count how many of nine
policy-specific phrases ("personal information", "we collect", "retention", …) appear.

Classified `OK-FULL` = ≥8,000 chars **and** ≥4 policy keywords. Scripts:
`render_test.py`, `diagnose.py`, `final_test.sh` in this scratchpad.

### Results (90 URLs)

| Outcome | Count | % |
|---|---|---|
| **OK-FULL** — complete policy text from plain fetch | **67** | **74.4%** |
| OK-PARTIAL | 1 | 1.1% |
| NEEDS-MORE (thin/SPA/bot wall) | 9 | 10.0% |
| BLOCKED 403 | 8 | 8.9% |
| BLOCKED 404 (my URL errors, not real failures) | 3 | 3.3% |
| BLOCKED 401 / 429 | 2 | 2.2% |

**Plain fetch sufficient: 68/90 = 76%.** Excluding the 3 URLs that were my own list-building
mistakes and the 1 transient 429, the realistic rate for a *curated, correct* URL list is
**~80%**.

### The five you asked about — all server-rendered

| Company | Extracted text | Policy keywords | Verdict |
|---|---|---|---|
| Microsoft | 213,996 chars | 11/11 | Fully SSR |
| Google | 55,696 chars | 10 | Fully SSR |
| Meta (Facebook) | 64,079 chars | — * | Fully SSR |
| Amazon | 29,934 chars | 9 | Fully SSR |
| Apple | 29,710 chars | 8 | Fully SSR |

\* Meta scored 0 on my keyword list purely because its policy uses different phrasing; 64 KB of
extracted prose is unambiguously the full document. Meta and Apple initially looked like
failures only because my first-pass URLs were redirect landing pages —
`facebook.com/privacy/policy/` (trailing slash) and `apple.com/legal/privacy/en-ww/` both
return the complete text. **Worth auditing your `companies.csv` URLs for exactly this.**

Median across all passing pages: **~50,000 characters** of extractable policy text.

### The critical insight: the failures are anti-bot, not client-rendering

This is the finding that changes the architecture decision.

Comparing Python `requests` against `curl --http2` on the same URLs, **Cisco and Sony flipped
from 403 to 200** (Cisco 87 KB, Sony 781 KB of HTML) purely from a different TLS fingerprint —
no browser involved. Meanwhile the hard failures returned block pages from named WAFs:

- `server: AkamaiGHost` + 384-byte body → Tesla, Costco
- `server: cloudflare` + `server-timing: chlray;desc=...` (a Cloudflare *challenge* ray) →
  OpenAI, Coinbase

These are **IP-reputation and TLS-fingerprint blocks that fire before any JavaScript executes**.
Industry write-ups on current detection are consistent that datacenter IP ranges (AWS,
DigitalOcean, Hetzner…) are assigned high bot scores pre-emptively, and that Playwright's
bundled Chromium has a JA3 fingerprint matching no real Chrome release
([Scrapfly on Cloudflare](https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping),
[Scrapfly on Akamai](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping)).
⚠️ *These are vendor blogs with a commercial interest in the claim, and I could not verify them
against a neutral primary source — but they're corroborated by my own measurements above:
identical requests differing only in TLS stack got opposite results, and the challenge pages
came back before any JS ran.*

**Consequence:** running Playwright on Vercel, Cloudflare, Render, Railway or Fly.io — all
datacenter IPs — would **not** unblock Tesla, Costco, OpenAI or Coinbase. You would take on
Chromium's cold starts, memory, and version-matching maintenance and still get 403s. The only
things that move the needle on that tail are residential/stealth proxies, i.e. ScrapingBee
stealth or Browserbase with proxies.

### Also: some "client-rendered" pages aren't

Target and HBO Max return `__NEXT_DATA__` payloads whose **raw HTML contains the policy text
in JSON** (Target: 7 of 9 policy keywords present in the raw response despite only 272 chars of
rendered text). A JSON-payload extraction fallback recovers these with no browser.

### Honest estimate for your ~85 pages

- **~80% — plain `fetch` + Readability.** Works today, no browser.
- **~8% — need better HTTP hygiene**, not a browser: correct URL, modern TLS/HTTP2 client
  (Node's undici is fine), realistic headers, `__NEXT_DATA__`/JSON-LD fallback.
- **~10% — genuinely hostile** (Akamai/Cloudflare challenge). A browser alone doesn't fix these;
  they need residential proxies or should be accepted as degraded coverage.
- **~2% — true SPA needing JS execution.** Rounding error.

**The number of pages that need a headless browser and would be fixed by one is close to zero.**

⚠️ *Caveat: I tested from this sandbox's datacenter egress IP through an HTTP proxy. Vercel's
egress IPs may have somewhat different reputation, so your exact block list will vary a little.
The direction of the result — SSR-dominant, failures are anti-bot — is robust.*

---

## 5. Bottom line and cost

### Recommendation: keep everything on Vercel. Delete the Python service.

**Architecture:**
1. `vercel.json` cron → one Node function (`/api/cron/capture`).
2. Inside: `Promise.all` over ~85 URLs with a concurrency cap of ~10-20 and a 15-20s per-URL
   timeout. Use `undici`/native `fetch` with full browser-like headers.
3. Extract with `@mozilla/readability` + `linkedom` (both pure JS, tiny). Add a
   `__NEXT_DATA__`/JSON-LD fallback for the Target/HBO class.
4. Normalize whitespace → SHA-256 → compare against last snapshot hash in Redis → on change,
   write the new snapshot to Blob and enqueue the LLM summary.
5. Record a per-source status so blocked/failed sources are visible rather than silently stale.

**Feasibility is not in question.** My 90-URL fetch at concurrency 10 completed in **7 seconds**
wall-clock (warm connections; a cold run was still well under a minute), yielding 3.7 MB of
extracted text. Against a 300s Hobby / 800s Pro ceiling there is one to two orders of magnitude
of headroom. Watch the 1,024 file-descriptor limit — the concurrency cap handles it.

### Cost

**Compute, per daily run** (iad1: $0.128/CPU-hr, $0.0106/GB-hr,
[fluid pricing](https://vercel.com/docs/functions/usage-and-pricing)). Assume a generous 90s
wall-clock, 2 GB, ~15s active CPU (it's almost all I/O, which doesn't bill CPU):

- Active CPU: 15/3600 × $0.128 = **$0.00053**
- Provisioned memory: 2 GB × 90/3600 hr × $0.0106 = **$0.00053**
- ≈ **$0.0011 per run → ~$0.03/month** for 30 runs.

Against Hobby's included 4 CPU-hrs / 360 GB-hrs / 1M invocations, this uses roughly **0.4%** of
the allowance. Against Pro's $20 monthly credit it is a rounding error.

| Scenario | Monthly cost |
|---|---|
| **Personal/non-commercial on Hobby** | **$0** — daily cron is the Hobby minimum interval anyway; ±59 min precision is irrelevant here |
| **Commercial on Pro (recommended)** | **$20** (1 developer seat) + ~$0.03 compute + LLM tokens |
| Optional: hostile-tail coverage via Browserbase Developer | +$20 (uses ~4 of 100 included browser hours) |
| Optional: hostile-tail coverage via ScrapingBee Freelance | +$49 (450 stealth requests ≈ 34k of 250k credits) |

LLM summarization is demand-driven and tiny: policies change a handful of times a month across
85 companies, so you're summarizing maybe 5-15 diffs/month.

**My advice on the hostile tail: don't pay for it yet.** Ship the 80% that works, surface the
~10 blocked sources as "monitoring unavailable" in the UI, and only buy ScrapingBee/Browserbase
if those specific companies turn out to matter to users. $20-49/month to monitor ~10 pages is a
poor trade before you have that signal.

### Two storage notes

- **Vercel KV no longer exists as a first-party product.** Per
  [Vercel Storage docs](https://vercel.com/docs/storage), first-party storage is now just
  **Blob** and **Global Config**; Redis/Postgres moved to the **Marketplace** (Upstash, Neon,
  Supabase) via `vercel install upstash`. If your project predates that, verify what your
  `KV_*` env vars actually point at — this is a live migration hazard, not a hypothetical.
- Snapshots are compressible text averaging ~50 KB. 85 sources × daily × a year is only a few
  GB even with no dedup, and you should be storing only *changed* snapshots — realistically
  tens of MB/year. Blob's allowance covers it.

### Why not the alternatives

- **Cloudflare Workers** ($5/mo) is the cheapest browser-capable stack, but Free-tier cron gets
  **10 ms CPU**, which is unusable, and the datacenter-IP problem is identical to Vercel's.
- **Render / Railway / Fly** are all fine and cheap ($1-5/mo) for a Dockerized Playwright cron.
  They're the right answer *if* you actually needed a browser. You don't.
- **Splitting the pipeline across two providers** doubles your deploy surface, secrets
  management and failure modes to serve ~10% of sources that the split wouldn't even fix.

### On the five abandoned manifests

`render.yaml`, `fly.toml`, `railway.json`, `koyeb.yaml`, `cloudbuild.yaml` in
`packages/scraper/` are five parallel answers to a question this research says you shouldn't be
asking. Delete the scraper package and its manifests along with it; a ~150-line Vercel function
replaces the whole service. That removes the Python toolchain, the Docker build, the
Scrapy/Playwright dependency tree and five deploy targets from the repo.

---

## Verified vs. unverified

**Verified against primary sources** (vendor docs/registries, all fetched 2026-08-03): all
Vercel Functions/Cron/Sandbox/fluid-pricing/Hobby/storage figures; Cloudflare Workers,
Browser Rendering and R2 limits and pricing; Railway plans, cron and serverless behavior;
Fly.io pricing and stopped-machine billing; Render cron billing/12h cap/free-tier exclusions
and instance type specs; Browserbase, Browserless and ScrapingBee pricing and credit costs;
npm package versions and sizes for `@sparticuz/chromium` (v149.0.0, 2026-05-27),
`@sparticuz/chromium-min` and `playwright-core`.

**My own measurement:** the 90-URL render test, the TLS-stack comparison, and the 7s timing.
Reproducible via the scripts in this directory.

**Not verified — flagged in place:**
- Render's exact instance dollar prices (pricing page wouldn't render; $7/$25 from search
  snippets only). The $1/mo cron minimum and per-second proration *are* from Render's docs.
- That headless browsers are reliably detected on datacenter IPs — supported by my own
  measurements and by scraping-vendor blogs, but no neutral primary source.
- I did **not** deploy Playwright to Vercel and run it. The size/memory arithmetic and Vercel's
  own KB guide say it works; I'm asserting it's unnecessary, not that it's impossible.
- My 90-URL list is a constructed proxy for your ~85 curated companies (the repo's
  `companies.csv` has only 19). Re-run `final_test.sh` against your real list before acting —
  it takes seconds and gives you the exact per-source breakdown.
