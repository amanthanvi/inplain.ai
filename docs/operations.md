# Operations

There is no server. The daily `crawl` workflow is the whole runtime
(`.github/workflows/README.md`), so there are exactly two signals a human
ever has to act on.

## 1. The pinned issue "Scheduled crawl failing" opens

The `alert-on-failure` job creates or updates it whenever a `crawl` run goes
red, or when the summarize step reports `summarize_failed=true`. A partial
crawl (some Documents unreachable) is a success by design and does not open
it, so a red run means something systemic.

1. Open the run link in the issue. `gh run view <id> --log-failed` shows the
   failing step.
2. Read the step:
   - **Install, crawl or detect failed:** the archive was not pushed. Nothing
     was lost; the next run diffs across both days. Fix the cause on a
     `ticket/*` branch through a pull request, then re-run with
     `gh workflow run crawl --ref main`.
   - **Push failed:** usually a concurrent human push to `main`. Just re-run.
   - **Build failed on a record:** `python -m inplain.site` refuses a whole
     build over one invalid Change record (all-or-nothing). Fix or remove
     the record through a pull request; the archive is already safe.
   - **Summarize warning only:** the archive and site are fine, and the
     records are published honestly summary-less and retried next run.
     Check the `MODEL_API_KEY` secret and the provider's status and credit.
3. The issue is not closed automatically. Close it once the next scheduled
   run is green.

## 2. GitHub says the schedule was disabled

In a public repository GitHub disables scheduled workflows after 60 days
without repository activity, and emails the owner. Bot commits do not
reliably count as activity.

1. Actions tab → `crawl` → **Enable workflow**.
2. Run it once by hand (`gh workflow run crawl --ref main`) to catch up.
3. Any human commit, issue or pull request resets the clock; there is no
   other cure.

## Things that never need a human

- Two runs cannot overlap: the `crawl` concurrency group queues a delayed
  scheduled run behind a manual one.
- A hung run is killed after 30 minutes and the next one proceeds.
- The crawl's push uses `GITHUB_TOKEN`, so it starts no workflow run and can
  never loop. Do not replace it with a personal access token.
