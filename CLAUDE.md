# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this is

Inplain.AI tracks changes to privacy policies and terms of service for a curated
set of companies, and shows a diff plus an AI summary of what changed.

**The project is mid-revival.** It was built across 2025 by AI agents working in
"phase" sprints and accumulated a lot of duplicated, dead, and non-functional
code. Work is being driven by a wayfinder map on GitHub Issues — see the issue
labelled `wayfinder:map`. Read it before making architectural changes; the open
child issues are the decisions that have not been made yet.

## Known broken things

Do not assume these work. They are tracked on the map.

- **`apps/web/src/app/api/lib/kv-wrapper.ts` never returns a real KV client.** It
  falls through to an in-memory `MockKVClient` that dies with each request. 31
  modules import it; 29 other files import `@vercel/kv` directly and do persist.
  The datastore is split-brain.
- **`apps/web/src/components/ui/tabs.tsx` is a non-functional stub** used by 27
  files. Panels render stacked, triggers do nothing. `@radix-ui/react-tabs` is
  installed and unused.
- **Dark mode is dead code.** `applyTheme()` is never called, yet 208 `dark:`
  usages ship and the dashboard theme toggle writes to local state.
- Several pages render fabricated data (`/watchlist` is entirely `Math.random()`).
- The test suite fails (was 79 failed / 84 passed before cleanup started).
- ESLint is disabled during builds (`next.config.mjs`).
- Sentry is installed but disabled by renaming its three configs to `.disabled`.

## Guiding principles

KISS and YAGNI. **Delete by default** — git history is the backup, so removing
unused code is cheap and keeping it is not. When two implementations of the same
thing exist, the job is to pick one and delete the other, not to add a third.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind **v3** (not v4) ·
shadcn/ui + Radix · Clerk auth · Vercel KV (Upstash Redis) · Vercel Blob ·
OpenRouter for AI · Vitest + Playwright · npm workspaces + Turborepo.

There is **no database** — Redis is the only datastore. `api/health/detailed`
claims `type: 'postgresql'`; that is a lie in the code, not a real dependency.

## Layout

```
apps/web/           Next.js app - almost everything lives here
  src/app/          routes (pages + API) - note: two competing company-detail
                    stacks, /[slug] and /companies/[slug]
  src/components/   feature components; ui/ holds the shadcn primitives
  src/lib/          services. Expect duplicates; check for an existing one first
packages/shared/    WATCHED_COMPANIES catalog, Zod schemas, small utils.
                    Load-bearing - imported by ~50 files in apps/web
packages/scraper/   Python Scrapy service. Probably not running; its future is
                    a map decision
apps/browser-extension/  complete MV3 UI calling endpoints that do not exist
```

## Commands

Run from the repo root unless noted. **npm**, not pnpm — the Makefile and
devcontainer disagree and are wrong.

```bash
npm install
npm run dev          # turbo run dev
npm run build        # turbo run build
npm run typecheck    # currently 0 errors - keep it that way
npm run test         # currently failing; see above
npm run lint
```

Single test: `npm test -- path/to/file.test.ts` (from `apps/web`).
E2E: `npm run e2e` (from `apps/web`).

### Environment

`apps/web` needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to
build at all. Without them `clerk-provider.tsx` silently drops `<ClerkProvider>`
and prerender dies with `useUser can only be used within the <ClerkProvider />`.
Copy `.env.example` to `apps/web/.env.local`. Note Next reads env from
`apps/web/`, not the repo root.

Never commit a filled-in env file. A live Clerk key was previously committed and
had to be rotated.

## Conventions

- 2-space indent, single quotes. Note `.prettierrc` currently says otherwise
  (tabs, 4-wide, double quotes) and disagrees with essentially every file — do
  not run `npm run format` until that is fixed.
- Path alias `@/*` maps to `apps/web/src/*`.
- Validate API input with Zod schemas from `@inplain.ai/shared`.
- Prefer editing an existing module over adding a parallel one. If you find
  yourself naming something `enhanced-`, `unified-`, `advanced-`, or `-v2`, that
  is the signal you are about to make the original problem worse.
