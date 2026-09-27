Check `actions/permissions.enabled` before assuming a workflow is merely disabled.

On 2026-09-27 the `ci` workflow showed `disabled_manually` in `gh workflow
list --all`, which matched the known April 2026 hand-disable. But
`gh api repos/<owner>/<repo>/actions/permissions` also returned
`"enabled": false`: GitHub Actions was off for the whole repository, and no
workflow could run regardless of its own state. Enabling the workflow alone
would have changed nothing.

What worked: `PUT repos/<owner>/<repo>/actions/permissions` with
`{"enabled": true, "allowed_actions": "selected"}` and then
`PUT .../actions/permissions/selected-actions` with
`{"github_owned_allowed": true, "verified_allowed": false}`. Both workflows
use only `actions/*`, so the narrowest policy suffices. A new workflow file
that reaches the default branch registers itself as active; `crawl` needed no
separate enable.
