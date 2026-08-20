# CI is the runtime (T6)

There is no always-on process (SPEC §4). Two workflows run everything;
`docs/hosting.md` is the verified spec for their mechanics.

## `crawl.yml` — scheduled daily (04:17 UTC) + `workflow_dispatch`

crawl → detect → summarize → build `_site/` → push → deploy, in one job so a
failure at any step stops the run before anything ships. A **partial** crawl
(some documents unreachable) is a success by design; per-document problems are
surfaced in the run's step summary, never swallowed.

## `ci.yml` — every push and pull request

pytest (full suite) · stylelint (`npm run lint:css`) · site build from the
repo's real `changes/` (an empty archive must build) · axe against the built
pages. On a push to `main` with `DEPLOY_PAGES=true`, the checked site deploys.

## Where each guarantee is enforced

| Guarantee (issue #26 / SPEC) | Enforced by |
|---|---|
| Crawl commits back without retriggering CI (no loop) | `crawl.yml` pushes with `GITHUB_TOKEN` (its events start no workflow runs — hosting.md §1; **never** replace it with a PAT), identity `github-actions[bot]`; belt-and-braces: `ci.yml` `paths-ignore: documents/**, changes/**` |
| Two crawls never overlap | `crawl.yml` `concurrency: group: crawl, cancel-in-progress: false` |
| A failed crawl must not publish a broken site | deploy artifact is produced only after crawl, detect, summarize, and the all-or-nothing site build all succeed (single job, sequential steps); `--strict` is deliberately absent so a partial crawl still publishes the other 55 documents |
| Failures make noise a human sees | `alert-on-failure` job creates-or-updates (and pins) the issue **"Scheduled crawl failing"** with the run link; close it once a scheduled run is green |
| Citation integrity — AC-3/AC-4 (quote verbatim, on the named side) | pytest in `ci.yml` runs the full suite, citation-integrity tests included, on every push and PR |
| Token boundary — no raw hex/px outside `static/tokens.css` (D1, SPEC §9) | `npm run lint:css` (stylelint) in `ci.yml` |
| Accessibility floor (SPEC §9) | axe at `--tags wcag2a,wcag2aa` with `--exit` against the built pages (fixed pages + company pages + up to 10 change pages, one per template class) in `ci.yml` |
| Model spend / fork safety — summarize never runs in CI | summarize exists only in `crawl.yml`; secrets are absent on fork PRs anyway (hosting.md §5) |
| Same workflows private and public | deploy gated on the `DEPLOY_PAGES` repo variable; while unset/false, `_site/` is uploaded as a plain build artifact instead |

## Owner setup (nothing here is enabled by the agent)

1. **`MODEL_API_KEY`** — Settings → Secrets and variables → Actions →
   *Secrets* → New repository secret. Until it exists, the summarize step
   logs a skip and exits 0; records stay retryable and are summarized by the
   first run that has the key.
2. **`DEPLOY_PAGES`** — same page, *Variables* tab → New repository variable,
   value `true`. Set it only after the repo is public and Settings → Pages →
   Source is **GitHub Actions** (hosting.md §7 runbook, steps 5–13; the
   history rewrite in #8 is the hard gate before going public).
3. Note: the generated site uses root-absolute URLs (`/changes/…`), so Pages
   must serve at a domain root — the custom domain `inplain.ai` per
   hosting.md §6, not the `/inplain.ai/` project subpath.
4. `ci.yml`'s deploy gate names the `main` branch; update it if the default
   branch is ever renamed.
