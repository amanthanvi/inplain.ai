# R1 — Hosting recommendation and cutover

**Date:** 2026-08-19. Resolves the hosting question in SPEC §11 and
[#29](https://github.com/amanthanvi/inplain.ai/issues/29). Supersedes the
Railway brief in #19 (written for a six-service topology that no longer
exists). All prices, quotas, and limits below were verified against the linked
sources on **2026-08-19**; none are from memory.

**Recommendation in one line:** GitHub Actions for the daily crawl and the
build, GitHub Pages for the site, one repository secret for the model API key,
zero new accounts — with the public deploy gated on the repo going public
(which is itself gated on #8's key rotation; its history rewrite was executed
on 2026-08-03).

Facts observed 2026-08-19 that frame everything below:

- The repo is **private** (`gh api repos/amanthanvi/inplain.ai` →
  `visibility: private`).
- The owner's plan class could not be read via API (`gh api user` returns
  `plan: null` with the current token scopes); treat it as **GitHub Free**
  until the owner confirms otherwise. Nothing in the recommendation depends on
  it being Pro.
- `inplain.ai` resolves to Vercel (`216.198.79.65`, `64.29.17.65`;
  `www` is a CNAME to `671942f11af8d056.vercel-dns-017.com`), serving the old
  app.
- The domain's nameservers are **already Cloudflare**
  (`nikon.ns.cloudflare.com`, `rihana.ns.cloudflare.com`). DNS cutover is a
  record edit in an existing Cloudflare dashboard, not a registrar change.

---

## 1. The commit→deploy loop (the one fiddly part)

The crawl workflow commits changed `documents/` files and `changes/` records,
then must produce a deploy — without re-triggering the on-push CI workflow or
itself.

**Primary answer — this is a non-problem by design.** GitHub documents that
pushes made with the workflow's default `GITHUB_TOKEN` do not start new
workflow runs:

> "When you use the repository's `GITHUB_TOKEN` to perform tasks, events
> triggered by the `GITHUB_TOKEN` … will not create a new workflow run. …
> if a workflow run pushes code using the repository's `GITHUB_TOKEN`, a new
> workflow will not run even when the repository contains a workflow
> configured to run when `push` events occur."
> — [Triggering a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow)
> (accessed 2026-08-19)

So: `crawl.yml` checks out, crawls, commits with `GITHUB_TOKEN`, then **builds
and deploys the site in the same run** (via `actions/upload-pages-artifact` +
`actions/deploy-pages`). No second workflow needs to fire, and `ci.yml`'s
`push` trigger stays silent. The documented exceptions to the rule are
`workflow_dispatch`, `repository_dispatch`, and `pull_request` events on a
`GITHUB_TOKEN`-created branch (opened/synchronize/reopened) — none of which
the crawl uses (it pushes to the default branch and opens no PRs). Corollary for T6: **never** swap the crawl's push credential for a PAT
or GitHub App token, or the loop protection disappears (same doc).

**Belt and braces**, both documented in
[Workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
(accessed 2026-08-19):

1. `ci.yml` uses `on.push.paths-ignore: ["documents/**", "changes/**"]` so
   that even a credentialed push of crawler output could not trigger CI.
2. Both workflows set `concurrency` (e.g.
   `group: crawl, cancel-in-progress: false`) so a delayed scheduled run can
   never overlap a manual `workflow_dispatch` run and race on the push.

## 2. Schedule reliability vs a daily crawl

GitHub's own docs on the `schedule` event
([Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows),
accessed 2026-08-19):

> "The `schedule` event can be delayed during periods of high loads of GitHub
> Actions workflow runs. High load times include the start of every hour. If
> the load is sufficiently high enough, some queued jobs may be dropped."
> Shortest interval: every 5 minutes. And: "In a public repository, scheduled
> workflows are automatically disabled when no repository activity has
> occurred in 60 days."

Assessment against this product: delays of minutes-to-hours and the occasional
dropped day are **acceptable** — SPEC §8 already concludes "Daily is
sufficient. Policies change a few times a year." A missed crawl is caught by
the next day's run because change detection diffs against the last committed
snapshot, not against "yesterday". Mitigations T6 should encode:

- Schedule at an off-hour minute (e.g. `17 4 * * *`), per the docs' advice to
  avoid top-of-hour load.
- Add `workflow_dispatch` so a dropped run can be re-fired by hand.
- The 60-day auto-disable applies once public. The crawl's own commits count
  as repository activity only unreliably (they are bot-attributed); treat
  "GitHub emailed that the schedule was disabled" as an open risk (§7) and
  re-enable from the Actions tab if it ever fires.

## 3. Cost and limits: private now, public later

### Actions minutes

- **Private repo (current state):** GitHub Free includes **2,000
  minutes/month** (Pro: 3,000)
  ([About billing for GitHub Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions),
  accessed 2026-08-19).
- **Public repo (endgame):** "The use of standard GitHub-hosted runners is
  free: In public repositories." (same page) — i.e. **$0, no minute
  metering**.

Sizing: a daily crawl of 52 URLs with per-host politeness delays, plus pip
install, diff, summarize, and a static build of tens of pages, is realistically
5–10 minutes/run → **~150–300 minutes/month**, plus CI pushes. Comfortably
inside the private-repo Free allowance, and free outright once public.

### Pages availability

- **GitHub Free: Pages in public repositories only.** GitHub Pro adds Pages in
  private repositories
  ([GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans),
  accessed 2026-08-19).
- Consequence: **while the repo is private on a Free plan, GitHub Pages cannot
  serve the site at all.** This is fine: the site must not go live before the
  repo goes public anyway, because publishing requires the datastore-is-git
  trust story and, more bluntly, the live Clerk `sk_live` key is not yet
  rotated (#8): the 2026-08-03 history rewrite removed it from every branch,
  but GitHub's `refs/pull/1..6/head` still reach pre-rewrite commits.
  Private-phase runs upload `_site/` as a workflow artifact for inspection
  instead of deploying.

### Pages limits vs this site's scale

From [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
(accessed 2026-08-19):

| Limit | Value | This site |
|---|---|---|
| Published site size | ≤ 1 GB | tens of text pages; well under 10 MB |
| Bandwidth | *soft* 100 GB/month | text/HTML at this readership: orders of magnitude of headroom |
| Builds | *soft* 10/hour | ≤ ~2/day (daily crawl + occasional CI deploy) |
| Deployment timeout | 10 minutes | static copy of a small tree; seconds |

Also relevant from the same page: Pages may not be used as free hosting for a
primarily commercial/SaaS site — inplain.ai has no billing and no accounts
(SPEC §2), so this is a public-interest content site and compliant.

## 4. Cloudflare Pages, honestly assessed

Free-plan limits
([Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/),
accessed 2026-08-19): 500 builds/month, 1 concurrent build, 100 custom domains
per project, 20,000 files/site, 25 MiB/file. Static asset requests are "free
and unlimited" on both free and paid plans
([Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/),
accessed 2026-08-19).

What it would add here:

- **Genuinely better:** no bandwidth ceiling at all (vs the 100 GB soft
  limit), and it can deploy from a **private** repo on the free plan — the one
  scenario GitHub Pages on Free cannot serve.
- **Not actually a new account:** the domain's DNS is already on Cloudflare,
  so the account exists.
- **What it costs anyway:** a second deploy target and credential surface
  (a Cloudflare API token or the git integration's repo access) for a site
  whose builder, scheduler, datastore, and issue tracker are already GitHub.
  The 500 builds/month cap is a non-issue but the extra moving part is real.

Verdict: **not chosen.** At tens of text pages, GitHub Pages' soft limits are
not a constraint, and keeping crawl→commit→deploy inside one platform with one
token is worth more than unlimited bandwidth we will not use. Cloudflare Pages
is the documented **fallback** if either (a) the owner wants the site live
*before* the repo flips public without paying for Pro, or (b) Pages bandwidth
ever becomes real. Switching later is a rebuild-free re-point: the artifact is
a static `_site/` directory either way.

## 5. The single secret

The model API key (OpenRouter or whichever provider R2's eval selects) lives
as a **GitHub Actions repository secret**, e.g. `MODEL_API_KEY`, injected only
into the summarize step's environment. Repository secrets are redacted from
logs ([Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions),
accessed 2026-08-19); limits are 100 secrets/repository, 48 KB each
([Understanding GitHub secret types](https://docs.github.com/en/code-security/getting-started/understanding-github-secret-types),
accessed 2026-08-19) — we need one. It is never written to `documents/`,
`changes/`, or `_site/`, so the public-repo flip does not expose it. No other
secret exists in the target architecture: the site is static and the crawler
authenticates to nothing.

Fork-safety note for T6, since the endgame is public: "With the exception of
`GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is
triggered from a forked repository"
([using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions),
accessed 2026-08-19) — so a fork PR can never see `MODEL_API_KEY`; keep the
summarize step out of any `pull_request`-triggered workflow regardless, so it
never even attempts to run without it.

## 6. Custom-domain cutover (owner-access-required throughout)

Current state (observed 2026-08-19): apex `inplain.ai` → A `216.198.79.65`,
`64.29.17.65` (Vercel); `www` → CNAME `671942f11af8d056.vercel-dns-017.com`;
nameservers already Cloudflare. Target records, from
[Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
(accessed 2026-08-19):

- Apex A: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
  `185.199.111.153`
- Apex AAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`,
  `2606:50c0:8002::153`, `2606:50c0:8003::153`
- `www` CNAME: `amanthanvi.github.io`

The same doc recommends **verifying the custom domain before adding it** (to
prevent takeover) and notes **Enforce HTTPS** can take up to 24 h to become
available. Because the zone is Cloudflare-managed: set the new records to
**DNS-only (grey cloud)** at least until GitHub has issued the certificate and
Enforce HTTPS is on. (Operational guidance, no single primary source: GitHub's
custom-domain doc specifies records pointing directly at the Pages IPs and
does not cover proxied setups; Cloudflare's proxy answers with its own
certificate, which is exactly the condition that stalls issuance.)

Vercel teardown (owner dashboard): remove `inplain.ai` and `www.inplain.ai`
from the Vercel project's Domains, then delete the project (and the Clerk
integration with it). Do this *after* DNS has flipped and the Pages site is
confirmed serving, so the old app — not an error page — covers propagation.

---

## 7. Recommendation and runbook

**Recommendation:** GitHub Actions (scheduled crawl + build, one repo secret)
+ GitHub Pages (site + Atom feeds) on the custom domain, deployed from the crawl
workflow via `actions/deploy-pages`. Cloudflare Pages held as fallback only.
No new accounts, no new platforms, $0/month in the public endgame.

### Agent can do now (repo private)

1. T6 writes `.github/workflows/ci.yml` (on `push`, with
   `paths-ignore: ["documents/**", "changes/**"]` and a `concurrency` group)
   and `crawl.yml` (`schedule: "17 4 * * *"` + `workflow_dispatch`, its own
   `concurrency` group; permissions `contents: write`, `pages: write`,
   `id-token: write`).
2. `crawl.yml` sequence: checkout → crawl → commit with `GITHUB_TOKEN` →
   detect → summarize (`MODEL_API_KEY` env) → build `_site/` → **while
   private:** `actions/upload-pages-artifact` only (deploy step gated on
   repo visibility or a `DEPLOY_PAGES` repo variable, so the same workflow
   works in both states).
3. Verify in a run's logs that the crawl's push starts no new workflow run
   (the §1 guarantee, observed rather than trusted).
4. Keep `_site/` gitignored (already in CONVENTIONS).

### Owner must do

5. Create the `MODEL_API_KEY` repository secret (Settings → Secrets and
   variables → Actions) once R2 picks the provider.
6. Complete #8: rotate/revoke the live Clerk `sk_live` key (and any other
   credential in history). The git-history rewrite was already executed on
   2026-08-03; rotation also makes harmless the six pre-rewrite
   `refs/pull/1..6/head` refs GitHub keeps. **Hard gate for step 8.**
7. Verify `inplain.ai` as a custom domain on the GitHub account
   (Settings → Pages → verified domains) *before* any DNS change, per §6.
8. Flip the repository to **public** (Settings → General → Change visibility)
   — only after step 6.

### After going public

9. (owner — repo admin) Enable Pages: Settings → Pages → Source: **GitHub Actions**; set the
   `DEPLOY_PAGES` variable (or equivalent gate) so `crawl.yml`'s deploy step
   runs; trigger `workflow_dispatch` and confirm the site serves at
   `amanthanvi.github.io/…`.
10. Set the custom domain `inplain.ai` in Pages settings (writes the CNAME
    association), then in Cloudflare DNS (owner): replace the Vercel A records
    with the four Pages A + four AAAA records, repoint `www` to
    `amanthanvi.github.io`, DNS-only. (Owner access required.)
11. (owner — repo admin) Once the cert is issued, tick **Enforce HTTPS** (may take up to 24 h to
    be offered).
12. Confirm the site, Atom feeds, and old deep links; then (owner) remove the
    domains from the Vercel project and delete the project.
13. Watch the next two scheduled runs end-to-end: crawl → commit → deploy,
    no CI re-trigger, no overlap.

## 8. Open risks

- **Schedule drift/drops:** documented best-effort behavior (§2). Accepted at
  daily cadence; `workflow_dispatch` is the manual override. If a run is
  dropped, nothing is lost — the next diff spans both days.
- **60-day auto-disable of schedules in public repos:** bot commits may not
  reset the inactivity clock. Cheap insurance: any human commit/issue activity
  does; failing that, re-enable from the Actions tab when GitHub emails.
- **Pages soft limits are discretionary:** 100 GB/month bandwidth and
  10 builds/hour are "soft" — GitHub may throttle rather than hard-fail. At
  this scale the margin is ~1000×, but a traffic spike (e.g. a viral change
  record) is the one scenario to watch; Cloudflare Pages is the pressure
  valve.
- **Plan class unverified:** the API would not disclose the owner's plan. If
  the owner is on Free (assumed), the private phase simply cannot deploy
  Pages — the runbook already accounts for that; nothing breaks if it turns
  out to be Pro.
- **Secret in history:** no branch reaches the live Clerk key since the
  2026-08-03 rewrite (re-verified 2026-09-27), but GitHub's six
  `refs/pull/1..6/head` refs still reach pre-rewrite commits, so until step 6's
  rotation completes, flipping public exposes the live key. The runbook
  hard-gates on it; the risk is sequencing error, not design.
- **Proxied-DNS vs Pages TLS:** the zone being on Cloudflare means an
  accidental orange-cloud on the new records can stall GitHub's certificate
  issuance. Runbook specifies DNS-only.
