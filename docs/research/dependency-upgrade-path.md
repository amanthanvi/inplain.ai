# inplain.ai — Dependency Revival Research

**Date:** 2026-08-03
**Repo:** `/home/user/inplain.ai` (read-only; nothing was modified)
**Scope:** ~96k lines TS/TSX in `apps/web/src` (172 `.tsx`, 230 `.ts`), Turborepo monorepo, Vercel deploy.

---

## 0. Headline: the urgent item is not an upgrade, it's a patch

Before any migration question, the pinned `next@15.0.0` and `@clerk/nextjs@6.23.0` carry **known, published, exploitable auth-bypass advisories**, and this app performs authorization in middleware.

`npm audit` on the checked-in lockfile: **71 vulnerabilities — 8 critical, 22 high, 35 moderate, 6 low.**

### CVE-2025-29927 — Next.js middleware authorization bypass (CVSS 9.1)

- Affects `>= 15.0.0, < 15.2.3`. **This app is pinned to exactly `15.0.0`.**
- An attacker sets the `x-middleware-subrequest` header; Next.js treats the request as internal and **skips middleware entirely**.
- `apps/web/src/middleware.ts` uses `clerkMiddleware` + `createRouteMatcher` and calls `await auth()` at line 92 — i.e. route protection lives in middleware and is bypassable.
- Advisory: https://github.com/advisories/GHSA-f82v-jwr5-mffw · https://nvd.nist.gov/vuln/detail/CVE-2025-29927
- Vercel postmortem: https://vercel.com/blog/postmortem-on-next-js-middleware-bypass

### Second critical, independent of the first: Clerk

- `@clerk/nextjs` **"Middleware-based route protection bypass"**, critical, vulnerable range `>=6.0.0-snapshot.vb87a27f <6.39.2`. Installed: `6.23.0`.
  https://github.com/advisories/GHSA-vqx2-fgx2-5wq9
- `@clerk/nextjs` authorization bypass combining organization/billing/reverification checks, high, `>=6.0.0 <=6.39.2` — https://github.com/advisories/GHSA-w24r-5266-9c3c
- `@clerk/backend` insufficient verification of data authenticity, high, `>=6.2.10 <6.23.3` — https://github.com/advisories/GHSA-9mp4-77wg-rwx9

So **both layers of the auth stack** — the framework and the auth SDK — have a live middleware-bypass advisory. They are separate bugs; patching one does not fix the other.

### The rest of the `next@15.0.0` advisory set (33 total)

Selected, all with the app in the vulnerable range:

| Severity | Title | Fixed in |
|---|---|---|
| critical | RCE in React flight protocol (GHSA-9qr9-h5gf-34mp) | 15.0.5 |
| critical | Authorization Bypass in Middleware (GHSA-f82v-jwr5-mffw) | 15.2.3 |
| high | DoS with Server Components (GHSA-mwv6-3258-q52c) | 15.0.6 |
| high | HTTP request deserialization DoS via RSC (GHSA-h25m-26qc-wcjf) | 15.0.8 |
| high | SSRF in rewrites via attacker-controlled hostname (GHSA-p9j2-gv94-2wf4) | 15.5.21 |
| high | SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r) | 15.5.16 |
| high | Middleware/Proxy bypass, Pages Router + i18n (GHSA-36qx-fr4f-26g5) | 15.5.16 |
| moderate | Middleware redirect handling → SSRF (GHSA-4342-x723-ch2f) | 15.4.7 |
| moderate | XSS in App Router apps using CSP nonces (GHSA-ffhc-5mcf-pf4q) | 15.5.16 |
| moderate | HTTP request smuggling in rewrites (GHSA-ggv3-7p47-pfv8) | 15.5.13 |

**Root cause of the exposure:** `next` is an *exact* pin (`"next": "15.0.0"`, no caret). Next.js ships security fixes for the 15.x maintenance line as semver-**minor** releases, so an exact pin receives none of them. That single character is why 33 advisories accumulated.

### Other criticals in the tree

- `jspdf <=4.2.0` — HTML injection in new-window paths (critical), path traversal/LFI, PDF object injection. App uses `jspdf@^3.0.1` for report export.
- `vitest <3.2.6` — arbitrary file read/execute when the Vitest **UI server** is listening (GHSA-5xrq-8626-4rwp). Dev-only; the repo's `e2e:ui`/`test:watch` scripts don't launch `--ui`, so real-world exposure is low.
- `form-data 4.0.0–4.0.5`, `handlebars`, `basic-ftp` — transitive.

### The good news: the fix is a semver-minor, not a migration

`npm audit` reports for `next`: `fixAvailable: {"version": "15.5.22", "isSemVerMajor": false}`.

`next@15.5.22` (the `backport` dist-tag) patches the entire 15.x advisory list. **You can be fully patched today without touching Next 16.** Likewise `@clerk/nextjs@6.39.6` patches Clerk while staying on v6. This cleanly decouples "stop being exploitable" from "migrate the framework."

---

## 1. Current versions as of 2026-08-03

Queried directly from the npm registry (`npm view <pkg> version`, i.e. the `latest` dist-tag).

| Package | Pinned here | Current `latest` | Delta |
|---|---|---|---|
| `next` | `15.0.0` (exact) | **16.2.12** | 1 major + 33 advisories |
| `react` / `react-dom` | `^19.0.0` | **19.2.8** | minor |
| `@types/react` | `^18.3.3` (forced) | **19.2.18** | 1 major behind runtime |
| `@types/react-dom` | `^18.3.0` (forced) | **19.2.4** | 1 major |
| `tailwindcss` | `^3.4.4` | **4.3.3** (v3 line: `3.4.19`, tag `v3-lts`) | 1 major |
| `turbo` | `^1.13.0` | **2.10.8** | 1 major |
| `eslint` | `^8.57.0` | **10.8.0** (`maintenance`: 9.39.5) | 2 majors |
| `eslint-config-next` | `15.0.0` | **16.2.12** | 1 major |
| `vitest` / `@vitest/coverage-v8` | `^1.6.0` | **4.1.10** (`V3` tag: 3.2.7) | 3 majors |
| `@testing-library/react` | `^15.0.7` | **16.3.2** | 1 major |
| `jsdom` | `^24` | **30.0.1** | 6 majors |
| `typescript` | `^5.5.0` | **7.0.2** | 2 majors |
| `node` | `20` (`.nvmrc`) | **24 Active LTS** / 22 Active LTS / 26 Current | **20 is EOL** |
| `@clerk/nextjs` | `^6.23.0` | **7.6.4** (v6 line: `6.39.6`) | 1 major |
| `@sentry/nextjs` | `^9.33.0` | **10.69.0** | 1 major |
| `@vercel/kv` | `^1.0.1` | **3.0.0** — **package deprecated** | see §8 |
| `@vercel/blob` | `^0.19.0` | **2.6.1** | 2 majors |
| `zod` | `^3.23.8` | **4.4.3** | 1 major |

Sources: npm registry; https://nodejs.org/en/about/previous-releases and https://raw.githubusercontent.com/nodejs/Release/main/schedule.json

---

## 2. React 19 types — removing the `@types/react` 18 override

### Why the override exists (verified against `package-lock.json`)

I enumerated every package in the lockfile that declares an `@types/react` peer dependency:

| Declared peer range | Packages |
|---|---|
| `*` | **all ~35 Radix UI packages** (`react-dialog`, `react-select`, `react-slot`, `react-popover`, …) |
| `>=18` | `react-markdown` |
| `>=18.0.0` | `zustand` |
| `^18.0.0` | **`@testing-library/react`**, **`@types/react-dom`** |

**This is the whole story.** Radix — the scariest-looking part of the dependency graph — peers `*` and constrains nothing. The `^18.0.0` pin comes from exactly two places:

1. `@testing-library/react@15` (peer `@types/react: ^18.0.0` only), and
2. `@types/react-dom@18` (peer `@types/react: ^18.0.0`).

`@types/react-dom@19.2.4` peers `@types/react: ^19.2.0` — so the two `@types` packages must move together, always.

`@testing-library/react@16.3.2` peers `@types/react: ^18.0.0 || ^19.0.0`. **Therefore RTL 15 → 16 is a hard prerequisite for removing the override cleanly** — it is the only first-party blocker. Once RTL is at 16 and both `@types` packages are at 19, the root `overrides` block *and* `legacy-peer-deps=true` in `.npmrc` can both be deleted. That is a meaningful hygiene win: `legacy-peer-deps` currently masks every peer conflict in the repo.

### The actual React 19 type changes

From the official upgrade guide (https://react.dev/blog/2024/04/25/react-19-upgrade-guide), verified against the real `@types/react@19.2.18` tarball:

**a) `useRef` now requires an argument.** All three overloads in `index.d.ts` (lines 1737/1749/1761) take `initialValue`; there is no zero-arg overload.
```ts
function useRef<T>(initialValue: T): RefObject<T>;
function useRef<T>(initialValue: T | null): RefObject<T | null>;
function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
```
`MutableRefObject` is deprecated; everything is `RefObject<T>` and all refs are mutable.

**b) Global `JSX` namespace removed**, moved to `React.JSX`. Confirmed: there is **no `declare global`** block in `@types/react@19.2.18`. Module augmentation must now be wrapped in `declare module "react" { namespace JSX { … } }`.

**c) `ReactElement["props"]` defaults to `unknown` instead of `any`.** Only affects code reading `.props` off an untyped element.

**d) Ref callbacks may no longer implicitly return.** Because refs now support cleanup functions, `ref={el => (x = el)}` is a type error; needs braces.

**e) `ref` as a prop.** Function components receive `ref` directly; `forwardRef` is no longer required (but is **not removed** and keeps working).

**f) `PropTypes` and `defaultProps` removed for function components**; legacy context (`contextTypes`/`getChildContext`) and string refs removed.

**g) `ReactNode` gained an opaque experimental member** (`DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_REACT_NODES`). Harmless for consumers, but it means custom types that *exhaustively* destructure `ReactNode` can break.

### Codemod

```bash
npx types-react-codemod@latest preset-19 ./src
# and, separately, for unsound .props access:
npx types-react-codemod@latest react-element-default-any-props ./src
```
`preset-19` bundles `refobject-defaults`, `scoped-jsx`, and `no-implicit-ref-callback-return`.

### Realistic blast radius on this codebase — **small**

I scanned `apps/web/src` for every documented breakage:

| Breakage | Occurrences | Assessment |
|---|---|---|
| `useRef()` with no args | **0** | — |
| `useRef<T>()` with empty generic | **5** | Real errors. Listed below. Trivial fix. |
| Implicit-return ref callbacks | **0** | — |
| `JSX.Element` / `JSX.IntrinsicElements` | **0** | Codebase already uses `React.JSX`/`ReactElement` |
| `defaultProps` | **0** | — |
| `propTypes` / `prop-types` | **0** | — |
| `forwardRef` | 29 files (all `components/ui/*`) | **Not a breakage.** Still supported. |
| `ElementRef` | 51 | **Not a breakage.** See below. |
| `ReactNode` references | 87 | Non-breaking |

The five real errors:
```
src/components/PremiumSearch.tsx:38          useRef<NodeJS.Timeout>()
src/components/ui/premium-tooltip.tsx:20     React.useRef<NodeJS.Timeout>()
src/components/RecentDiffsRealtime.tsx:52    useRef<NodeJS.Timeout>()
src/hooks/usePerformanceOptimization.ts:77   useRef<NodeJS.Timeout>()
src/hooks/usePerformanceOptimization.ts:166  useRef<number>()
```
Each becomes `useRef<NodeJS.Timeout | undefined>(undefined)`. The codemod does this automatically.

**On `ElementRef` (51 uses):** I extracted `@types/react@19.2.18` and grepped. `ElementRef` is **present and functional**, defined at line 219 as `type ElementRef<...> = ComponentRef<C>` with an `@deprecated Use ComponentRef<T> instead` JSDoc tag. It compiles; editors will show a strikethrough. This is a cleanup, not a blocker — which removes what looks like the single largest line-count item from the migration.

**Verdict:** despite ~96k lines, the React 19 types migration is roughly **5 mechanical edits + a codemod run + one full `tsc --noEmit` to catch second-order inference changes**. The codebase is unusually clean here (no PropTypes, no defaultProps, no global JSX). Budget half a day, dominated by reading the typecheck output, not by editing. The genuine unknown is inference drift in the 29 `forwardRef` UI components once `@types/react-dom` also moves — that can't be predicted statically and is the reason to allocate a buffer.

---

## 3. Next.js 15.0.0 → 16.2.12

**One major has shipped: Next.js 16** (released 2025-10-21, https://nextjs.org/blog/next-16). Also 15.1 → 15.5 in between.

### Support policy — this has a deadline

Per https://nextjs.org/support-policy:
- **16.x — Active LTS** (features + fixes + security)
- **15.x — Maintenance LTS**, critical fixes and security only, **until 2026-10-21**

That is **~2.5 months away.** After that, 15.x receives nothing — including the next CVE-2025-29927-class bug. This converts Next 16 from "nice to have" into a dated obligation.

### Codemod

```bash
npx @next/codemod@canary upgrade latest
```
Handles: `next.config` turbopack key, `next lint` → ESLint CLI, `middleware` → `proxy`, `unstable_` prefix removal, `experimental_ppr` removal.

There is also an official MCP path (`next-devtools-mcp@latest`) documented at https://nextjs.org/docs/app/guides/mcp.

### Requirements

| Requirement | v16 minimum |
|---|---|
| Node.js | **20.9.0+** (18 dropped) |
| TypeScript | 5.1.0+ |
| Browsers | Chrome/Edge/Firefox 111+, Safari 16.4+ |

`next@16.2.12` peer-depends `react: ^18.2.0 || ^19.0.0` — so `react@^19.0.0` here is fine.

### Breaking changes, scored against this codebase

**Already satisfied — no work:**

- **Async request APIs are now mandatory** (sync access removed; v15 only deprecated it). I checked every `page.tsx`/`layout.tsx`/`route.ts`: **zero** sync `params: {` signatures, 63 sites already typed `params: Promise<{…}>` and awaited, **zero** un-awaited `cookies()`/`headers()`. This is normally the single biggest v16 cost and **this app has already paid it.**
- **Parallel routes now require explicit `default.js`** (builds fail without). No `@slot` directories exist. N/A.
- **Custom webpack config blocks `next build`.** `next.config.mjs` defines no `webpack` key. Turbopack-by-default should just work.
- **AMP removal**, **`serverRuntimeConfig`/`publicRuntimeConfig` removal**, **`next/legacy/image`** — none used.

**Real work required:**

1. **`next lint` is removed**, and the `eslint` key in `next.config` is removed. This app uses **both**: `"lint": "next lint"` in `apps/web/package.json`, and `eslint: { ignoreDuringBuilds: true }` in `next.config.mjs`. Codemod: `npx @next/codemod@canary next-lint-to-eslint-cli .`. **This is what couples Next 16 to the ESLint 9/10 migration (§5).**
2. **`images.domains` is deprecated.** Current config:
   ```js
   images: { domains: ['inplain.ai', 'cdn.inplain.ai'] }
   ```
   → convert to `remotePatterns: [{ protocol: 'https', hostname: 'inplain.ai' }, …]`. Deprecated (warns), **not removed** — so it will not break the build, but should be done in the same PR.
3. **`next/image` default changes** — silent behavior shifts, easy to miss:
   - `minimumCacheTTL` 60s → **4 hours**
   - `imageSizes` — `16` removed from defaults
   - `qualities` — was all 1–100, now **`[75]` only**; any other `quality` prop is silently coerced to the nearest allowed value
   - `maximumRedirects` unlimited → **3**
   - `dangerouslyAllowLocalIP` — local IPs now blocked by default
4. **`revalidateTag(tag)` now requires a second `cacheLife` argument**; single-arg form is deprecated and produces a TS error. New `updateTag()` (read-your-writes) and `refresh()` APIs.
5. **`middleware.ts` → `proxy.ts`.** Deprecated, not removed. **Important caveat: `proxy.ts` runs Node-only and the runtime cannot be configured; the Edge runtime is not supported in `proxy`.** If the Clerk middleware needs Edge, **keep `middleware.ts`** — it still works in v16. Do not let the codemod rename this without checking.
6. **Scroll behavior** — Next no longer overrides `scroll-behavior: smooth` during navigation. Opt back in with `data-scroll-behavior="smooth"` on `<html>`.
7. **`next dev` writes to `.next/dev`**; `process.argv` no longer contains `'dev'` in the config file.

### On the `export const dynamic` blanket

The app applies `export const dynamic = 'force-dynamic'` across **28 files** (25 single-quoted, 3 double-quoted), plus `output: undefined` and a timestamp `generateBuildId` — a deliberate "disable static optimization everywhere" posture.

Per https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config, the v16 version-history table reads:

> `v16.0.0` — `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` **removed when Cache Components is enabled**.

So: **`export const dynamic = 'force-dynamic'` continues to work in Next 16 as long as you do not set `cacheComponents: true`.** The 28 files need no changes for the upgrade itself.

Note the strategic tension: v16's headline feature (Cache Components / PPR) is *mutually exclusive* with this app's `force-dynamic` blanket. Adopting Cache Components would mean deleting all 28 exports and re-deriving caching per route — a separate, larger project. **Recommendation: upgrade to 16, leave `cacheComponents` off, keep the blanket.** Treat Cache Components as a future initiative, not part of this revival. Note that the blanket is also worth revisiting on its own merits — it is a blunt instrument that likely costs real performance — but that is a product decision, not an upgrade blocker.

---

## 4. Tailwind 3.4 → 4.3

Source: https://tailwindcss.com/docs/upgrade-guide

### Automated tool

```bash
npx @tailwindcss/upgrade
```
Requires Node 20+. Docs: "handles the vast majority of migration automatically" — dependencies, JS config → CSS, template class renames — but "may require manual tweaks for complex projects" and "won't catch all edge cases."

### What changes

- PostCSS plugin moves to its own package; `postcss-import` and `autoprefixer` are now built in and must be **removed**:
  ```js
  // apps/web/postcss.config.js  — current
  plugins: { tailwindcss: {}, autoprefixer: {} }
  // v4
  plugins: { '@tailwindcss/postcss': {} }
  ```
- `@tailwind base/components/utilities` → `@import "tailwindcss"`.
- JS config still supported via explicit `@config "../../tailwind.config.ts"`, but **no longer auto-detected**. `corePlugins`, `safelist`, `separator`, and `resolveConfig()` are unsupported/removed.
- **Browser floor: Safari 16.4+, Chrome 111+, Firefox 128+.** Stay on v3.4 if you need older.
- **Sass/Less/Stylus are not supported.**

### Breaking changes that produce *silent visual regressions*

These are the expensive ones — they don't error, they just look different:

- Default **border color** `gray-200` → `currentColor`
- `ring` default **3px → 1px**, color `blue-500` → `currentColor`
- **Renames:** `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `rounded-sm`→`rounded-xs`, `blur-sm`→`blur-xs`, `outline-none`→`outline-hidden`, `ring`→`ring-3`
- **Removed:** `bg-opacity-*`, `text-opacity-*`, `border-opacity-*`, `flex-shrink-*`, `flex-grow-*`
- Important modifier: `!flex` → `flex!`
- CSS-var arbitrary values: `bg-[--x]` → `bg-(--x)`
- Variant stacking order **reversed** (`first:*:pt-0` → `*:first:pt-0`)
- `hover:` now gated behind `@media (hover: hover)`
- `space-y-*`/`divide-*` selectors changed
- Preflight: placeholder color, `<button>` `cursor: default`, `<dialog>` margins
- `@layer utilities` for custom utilities → `@utility`
- `theme(colors.red.500)` → `var(--color-red-500)`

### Cost for *this* app — the highest of the seven, by a wide margin

Measured in `apps/web/src/app/globals.css`:

- **656 lines**, **95** CSS custom properties, **60** `@apply` directives
- **4** `@layer` blocks: two `base`, one `components`, one `utilities` — the `@layer utilities` block must be rewritten to `@utility`
- Imports a second hand-authored sheet, `src/styles/policy-viewer.css`
- Heavy nested `@apply` with arbitrary HSL values, e.g.
  ```css
  @apply bg-[hsl(var(--risk-low)/0.1)] text-[hsl(var(--risk-low))] border border-[hsl(var(--risk-low)/0.2)];
  ```
  This exact `hsl(var(--x))` pattern is what the shadcn v4 migration replaces with OKLCH + `@theme inline` — the upgrade tool does **not** reliably convert it.
- `tailwind.config.ts` is ~160 lines: full shadcn color mapping, 9 custom keyframes, 9 animations, container config, and `require("tailwindcss-animate")`.

Plus a **second, coupled migration**: `components.json` is `"style": "new-york"`, `"cssVariables": true`, `"config": "tailwind.config.ts"`. Per https://ui.shadcn.com/docs/tailwind-v4, the shadcn v4 story requires:
- `tailwindcss-animate` → **`tw-animate-css`** (`@plugin` → `@import "tw-animate-css"`); the app depends on `tailwindcss-animate@^1.0.7`
- HSL CSS vars → **OKLCH**
- `:root`/`.dark` moved **out of** `@layer base`, into `@theme inline`
- `data-slot` attributes added to every primitive; `forwardRef` removed
- Practically: `npx shadcn@latest add --all --overwrite`, which **overwrites all 29 `components/ui/*` files** — and those files here are *not* stock (`premium-card.tsx`, `premium-alert.tsx`, `premium-progress.tsx`, `premium-tooltip.tsx`, `accessible-button.tsx`, `accessible-dialog.tsx`, `accessible-form.tsx` are custom). Every local modification would have to be re-applied by hand.

**Realistic estimate: 2–4 days**, most of it visual QA that no tool can automate, against a design system with glassmorphism, gradients, and shimmer effects where the `ring`/`shadow`/`border-color` default changes will land visibly. There is **no security or compatibility forcing function** — Tailwind 3.4.19 is maintained under the `v3-lts` tag. **This is the one to defer.**

---

## 5. turbo 1.13 → 2.10.8

Sources: https://turborepo.dev/docs/crafting-your-repository/upgrading · https://turborepo.dev/blog/turbo-2-0

```bash
npx @turbo/codemod migrate
```

Breaking changes:
- **`pipeline` → `tasks`** in `turbo.json`. The repo's `turbo.json` still uses `pipeline`. Codemod handles it.
- `outputMode` → `outputLogs`
- **Strict Mode for env vars is now the default** (was Loose). ← *the only real risk item;* tasks that implicitly inherited env vars can start failing. This app has `.env`, `.env.production`, `.env.staging`, and a `setup:env` script, so env plumbing is non-trivial — verify the build after.
- Workspace root directory implicitly a dependency of all tasks; `engines` in root `package.json` now affects cache hashing (expect one full cache miss)
- Directory globs in `inputs`/`outputs` now include contents (`dist` ≡ `dist/**`)
- `--ignore` removed (use `--filter`); `--scope` removed; `--filter` no longer infers namespaces and **errors on no matches**; `--only` semantics changed
- Requires a package manager declaration in root `package.json` — **already present** (`"packageManager": "npm@10.2.0"`)
- Bump `eslint-config-turbo` to v2 if used (not used here)

**Assessment:** the repo's `turbo.json` is 5 tasks and 15 lines. This is a ~15-minute change, fully independent of everything else. Best value/risk ratio in the entire list after the security patch.

---

## 6. ESLint 8 → 9/10, flat config

### Is flat config required? Yes — twice over.

- **`eslint-config-next@16.2.12` peer-depends `eslint: ">=9.0.0"`.** ESLint 8 is not supported.
- **ESLint 10** (current `latest`, 10.8.0): per https://eslint.org/docs/latest/use/migrate-to-10.0.0, the legacy `.eslintrc` format is **entirely removed** — "the old configuration format is no longer supported." `FlatESLint`/`LegacyESLint` APIs removed. `eslint-env` comments are now errors. Config lookup changed from cwd-based to per-file upward search. JSX references are now tracked.
- ESLint 10 requires Node **20.19.0+, 22.13.0+, or 24+**.
- Next.js 16 independently ships `@next/eslint-plugin-next` defaulting to flat config.

An ESLint **9** maintenance line exists (`maintenance: 9.39.5`) if you want flat config without ESLint 10's stricter rules — a reasonable intermediate step.

### Is it supported cleanly? Yes.

`eslint-config-next` v16 has first-class flat-config entry points — this is well-trodden now, not a workaround:

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  { rules: { /* the 10 rule overrides from .eslintrc.json */ } },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
```

Three exported configs: `eslint-config-next` (base), `/core-web-vitals`, `/typescript`.

### Work required here

- `apps/web/.eslintrc.json` extends `next/core-web-vitals` + `next/typescript`, sets **10 rule overrides** and 7 `ignorePatterns` — all of which port directly (rules verbatim; `ignorePatterns` → `globalIgnores`).
- **Monorepo note:** root `package.json` also carries `eslint`, `eslint-config-next@15.0.0`, `eslint-config-prettier`, `eslint-plugin-prettier`, plus `.husky` pre-commit hooks. Flat config resolves per-file upward, so the root and `apps/web` configs need to be reconciled deliberately rather than by copy-paste.
- For a monorepo where Next isn't at the root, set `settings.next.rootDir` (documented at https://nextjs.org/docs/app/api-reference/config/eslint).
- Codemod for the script change: `npx @next/codemod@canary next-lint-to-eslint-cli .` (`next lint` → `eslint .`).

**Caveat worth stating plainly:** `next.config.mjs` currently sets `eslint: { ignoreDuringBuilds: true }` with a `TODO: Re-enable once all linting errors are fixed`. **Linting is currently disabled at build time, so the true error count is unknown** and could be large. Run `npx eslint .` on the *current* setup first to size this before committing to the ESLint migration — otherwise this task has an unbounded tail. Note also that in v16 `next build` no longer runs lint at all, so lint must move to CI explicitly or it silently stops running.

---

## 7. Vitest 1 → 3/4 and Testing Library 15 → 16

### Vitest

Current `latest` is **4.1.10**; a `V3` dist-tag pins **3.2.7**. Vitest 4 requires **Vite ≥ 6.0.0 and Node ≥ 20**.

**v1 → v2:** default pool changed **`threads` → `forks`**. Coverage thresholds restructured into a nested `thresholds` object supporting glob patterns.

**v2 → v3:**
- `spy.mockReset()` now restores the **original implementation** instead of a noop — *silent behavioral change in existing tests*
- `vi.spyOn` reuses existing mocks rather than creating new spies
- `fakeTimers.toFake` defaults removed — `performance.now()` etc. are now mocked by default when `vi.useFakeTimers()` is called
- `WorkspaceSpec` → `TestSpecification`

**v3 → v4** (https://vitest.dev/guide/migration):
- `maxThreads`/`maxForks` → **`maxWorkers`**; `singleThread`/`singleFork` → `maxWorkers: 1, isolate: false`; **`poolOptions` removed** (options hoisted to top level)
- **`workspace` → `projects`**
- `deps.external`/`inline`/`fallbackCJS` → `server.deps.*`
- **Coverage: `coverage.all` and `coverage.extensions` removed**; V8 provider switched to AST-based remapping; **`coverage.include` must now be defined explicitly**
- `vitest/execute` removed; `vite-node` replaced by Vite's Module Runner
- Reporter API removals (`onCollected`, `onFinished`, …); `basic` reporter removed; `verbose` → `tree`
- Test-name delimiter changed from space to `>` — **will invalidate existing snapshots**
- `JEST_WORKER_ID` → `VITEST_POOL_ID`

**Impact on the 4 config files** (`apps/web`, `packages/shared`, `packages/api`, `apps/browser-extension`): all use plain top-level `test:` config with no `poolOptions`/`workspace`, so most v4 renames don't apply. `apps/web/vitest.config.ts` does set `coverage.include`/`exclude` (fine) and needs `@vitejs/plugin-react` (`^4.3.1`) bumped for Vite 6.

**⚠️ Separate finding — the 70% coverage gate is probably not running.** `apps/web/vitest.config.ts` has:
```ts
coverage: { thresholds: { global: { branches: 70, functions: 70, lines: 70, statements: 70 } } }
```
`thresholds.global` is **Jest** syntax. Vitest expects thresholds *flat* (`thresholds: { lines: 70, … }`) and treats any other key as a **glob pattern**. A glob literally named `global` matches no files, so these thresholds are likely silently ignored — meaning `CLAUDE.md`'s documented "70% minimum" may never have been enforced. Worth verifying with `npm run test:coverage` and checking the exit code before assuming the suite is a safety net for any of these migrations. *(Inferred from Vitest's documented threshold schema — confirm empirically.)*

### @testing-library/react 15 → 16.3.2

- **v16.0.0** moved `@testing-library/dom` and `@types/react-dom` to **peer dependencies** — they must now be installed explicitly. `@testing-library/dom@^10.0.0` is required and is **not currently a direct devDependency**; it must be added.
- **React 19 support landed in v16.1.0** (2024-12-05). **v15.0.7 predates React 19 entirely** — so the app is currently running React 19 against a Testing Library that never supported it, held together by `legacy-peer-deps=true`.
- v16.3.2 (2026-01-19) peers `@types/react: ^18.0.0 || ^19.0.0` — the key that unlocks §2.

Source: https://github.com/testing-library/react-testing-library/releases

**`jsdom` 24 → 30** is six majors and is the least-documented hop here; treat as unverified risk and bump it in its own commit so failures are attributable.

---

## 8. Node 20 → 22/24

Authoritative: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json

| Version | Codename | LTS start | Maintenance | **EOL** | Status today |
|---|---|---|---|---|---|
| **20** | Iron | 2023-10-24 | 2024-10-22 | **2026-04-30** | ❌ **EOL — 3 months ago** |
| **22** | Jod | 2024-10-29 | 2025-10-21 | 2027-04-30 | ✅ Active LTS |
| **24** | Krypton | 2025-10-28 | 2026-10-20 | 2028-04-30 | ✅ **Active LTS (latest)** |
| **26** | — | 2026-10-28 | 2027-10-20 | 2029-04-30 | Current (not LTS until Oct 2026) |

nodejs.org states plainly: *"Production applications should only use Active LTS or Maintenance LTS releases."* **`.nvmrc` pins `20` — an EOL runtime receiving no security patches.**

**Vercel** (https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) offers 24.x (default), 22.x, 20.x, and resolves `engines.node` ranges to the newest match. Its documented mapping table lists **`>=20.0.0` → "latest 24.x version."** Root `package.json` has `"engines": { "node": ">=20.0.0" }` — so **production on Vercel is already running Node 24 while local dev pins Node 20.** That drift is itself a bug risk (and means the Node bump is largely about making local match prod, which lowers its risk considerably).

**Recommendation: Node 24.** It is Active LTS until 2026-10-20, EOL 2028-04-30, already the Vercel default and almost certainly already what production runs. Node 22 is the conservative alternative. Also satisfies Next 16 (≥20.9) and ESLint 10 (≥20.19/22.13/24).

Change `.nvmrc` → `24`, and tighten `engines.node` → `">=22.0.0"` or `"24.x"` so the range stops silently resolving to something local never tests.

---

## 9. Not asked about, but found

- **`@vercel/kv` is deprecated.** npm deprecation notice: *"Vercel KV is deprecated. If you had an existing KV store, it should have moved to Upstash Redis which you will see under Vercel Integrations. For new projects, install a Redis integration from Vercel Marketplace."* The app depends on `@vercel/kv@^1.0.1` and lists it in `serverExternalPackages`. It also **already** has `redis@^5.5.6` at the root — suggesting a partial migration was started. This is a real project (a storage backend swap), not a version bump. **Verify the KV store still exists in the Vercel dashboard before the revival** — this could be a hard runtime failure independent of any upgrade.
- **`@vercel/blob` 0.19 → 2.6.1** — two majors, unreviewed here.
- **`@sentry/nextjs` 9 → 10.69.0**; v10 peers `next: ^16.0.0-0`, so it supports Next 16. Note all three Sentry configs are `.disabled` (`sentry.client.config.ts.disabled`, etc.) — Sentry isn't actually wired up. Advisory range covers `8.0.0-alpha.2 – 10.39.0`, so a bump past 10.39.0 is wanted regardless.
- **`@clerk/nextjs` 6 already supports Next 16.** `6.39.6` peers `next: "^13.5.7 || ^14.2.25 || ^15.2.3 || ^16"`. **You do not need Clerk 7 to go to Next 16.** Clerk 7 (Core 3) removes `<SignedIn>`, `<SignedOut>`, and `<Protect>` in favor of a single `<Show>` component — this app uses `<SignedIn>` ×3 and `<SignedOut>` ×2, plus `<ClerkProvider>`, `<UserButton>` ×2, `<SignIn>` ×3, `<SignUp>`. Clerk 7 also changes `auth.protect()` to return 401 instead of 404. Migration tool: `npx @clerk/upgrade`. **Defer.**
- **TypeScript `latest` is 7.0.2** — the native Go port. A 2-major jump with its own compatibility story; explicitly out of scope for this revival. Next 16 only needs ≥5.1. Stay on 5.x.
- **`zod` 4.4.3** — v4 is a substantial rewrite. `zod@^3.23.8` is used for API validation throughout. No forcing function; defer.
- Stray `.npmrc.bak` at repo root — worth a look; may indicate a prior attempt to remove `legacy-peer-deps`.
- 40+ status/summary `.md` files at repo root (`PHASE_1_*`, `DEPLOYMENT_*`, `PRODUCTION_*`). Unrelated to upgrades, but the repo would benefit from consolidating them into `docs/`.

---

## 10. Sequenced recommendation

Ordered by value ÷ risk. **Every step should be its own PR** so a regression is attributable.

### Prerequisite graph

```
Node 24 ──────────────────────────► ESLint 10 (needs ≥20.19/22.13/24)
                                        │
@testing-library/react 16 ─► @types/react 19 + @types/react-dom 19
   (only blocker on ^18.0.0)     └─► drop overrides + legacy-peer-deps
                                        │
ESLint 9/10 flat config ────────────────┴──► Next.js 16
   (next lint removed in v16;                  (Active LTS; 15.x dies 2026-10-21)
    eslint-config-next@16 peers eslint>=9)

Tailwind 4 ──── independent, no dependents
turbo 2 ─────── independent, no dependents
```

---

### 🔴 Stage 0 — Do today. Not an upgrade; a patch. (hours)

**Highest value/risk in this document by an order of magnitude.** All semver-minor within current majors. No migration, no codemods, no API changes.

| Change | From | To | Why |
|---|---|---|---|
| `next` | `15.0.0` (exact) | **`15.5.22`** | Clears all 33 advisories incl. CVE-2025-29927. `isSemVerMajor: false`. |
| `@clerk/nextjs` | `^6.23.0` | **`^6.39.6`** | Clears the critical Clerk middleware bypass. |
| `jspdf` | `^3.0.1` | `^4.2.1+` | Critical HTML injection / path traversal. |

**Also change the pin style:** `"next": "15.0.0"` → `"next": "^15.5.22"`. The exact pin is the root cause of the whole advisory backlog and will recreate it if left in place.

Then: `npm audit` again, smoke-test auth flows (sign-in, sign-out, protected routes, `middleware.ts` matcher behavior), deploy. **This is shippable independently of everything below and should not wait on any of it.**

---

### 🟢 Stage 1 — Free wins. Independent, no dependents. (half day)

**1a. Node 20 → 24.** `.nvmrc` → `24`; `engines.node` → `">=22.0.0"`. Node 20 EOL'd 2026-04-30, and Vercel is *already* serving 24 for this project's `>=20.0.0` range — so this mostly makes local match prod. Unblocks ESLint 10. Check the `.devcontainer` and `.github` workflows for hardcoded `20`.

**1b. turbo 1 → 2.10.8.** `npx @turbo/codemod migrate`. `pipeline` → `tasks` on a 15-line config. Watch for **env-var Strict Mode**, the one real risk — verify `npm run build` still resolves `.env*`. ~15 minutes.

Independent, no dependents, immediately reduces drift. Do them while Stage 2 is being scoped.

---

### 🟡 Stage 2 — The types cluster. Must move together. (1–2 days)

Ordered *within* the stage; **`@types/react` cannot move before RTL**.

1. **`@testing-library/react` 15 → 16.3.2** + explicitly add **`@testing-library/dom@^10`** (now a peer). **← the prerequisite.** It is the only first-party package pinning `@types/react` to `^18.0.0`.
2. **Vitest 1 → 3.2.7** (`V3` tag). Two majors, not three — stopping at v3 avoids v4's `poolOptions`/`workspace`/coverage-shape churn while still clearing the `vitest <3.2.6` advisory. Watch for `mockReset` semantics and fake-timer defaults. *Consider v4 later, separately.* While here, **fix `coverage.thresholds.global` → flat `thresholds`** (§7) and confirm the gate actually fails a run.
3. **`@types/react` + `@types/react-dom` → 19.x, together.** Run `npx types-react-codemod@latest preset-19 ./src`. Expect ~5 real edits (all listed in §2). Then `tsc --noEmit` across all workspaces.
4. **Delete the root `overrides` block and `legacy-peer-deps=true` from `.npmrc`.** Regenerate `package-lock.json`. This is the actual prize — it removes the mechanism currently hiding every peer conflict in the repo.

Hold `jsdom` 24 → 30 as a separate follow-up commit; six majors with thin migration docs.

**Why now:** low blast radius (verified statically), removes a permanent source of confusion, and puts the repo in a supported state where peer conflicts surface instead of hiding.

---

### 🟠 Stage 3 — ESLint flat config. Prerequisite for Stage 4. (1 day, *size it first*)

**Before committing:** run `npx eslint .` on the current setup. `next.config.mjs` has had `eslint.ignoreDuringBuilds: true` with a `TODO`, so **the real error count is unknown** and could be hundreds. Size it, then decide.

- `eslint` 8 → **9.39.5** (`maintenance`) or **10.8.0**. Prefer 9 first if the error count is high — it gets you flat config without ESLint 10's added strictness.
- `eslint-config-next` → 16.x (peers `eslint >=9`).
- `.eslintrc.json` → `eslint.config.mjs`; port the 10 rule overrides verbatim, `ignorePatterns` → `globalIgnores`.
- Reconcile root vs. `apps/web` configs (flat config resolves per-file upward). Set `settings.next.rootDir` for the monorepo.
- Update `.husky` hooks and any CI lint step.

**This is a hard prerequisite for Stage 4** — Next 16 removes `next lint` and the `eslint` config key, both of which this repo uses.

---

### 🔵 Stage 4 — Next.js 15 → 16.2.12. Deadline-driven. (1–2 days)

**Do this before 2026-10-21**, when 15.x leaves Maintenance LTS and stops receiving security fixes entirely.

Cheaper here than for most apps: **async request APIs are already done** (63 `Promise<params>` sites, zero sync accesses), no parallel routes, no custom webpack config.

1. `npx @next/codemod@canary upgrade latest`
2. `npx @next/codemod@canary next-lint-to-eslint-cli .` (Stage 3 largely covers this)
3. Remove `eslint: { ignoreDuringBuilds: true }` from `next.config.mjs` (key no longer exists)
4. `images.domains` → `images.remotePatterns`
5. **Audit the `next/image` default changes** — `qualities: [75]`, `minimumCacheTTL` 4h, `imageSizes`, `maximumRedirects: 3`. These regress silently.
6. `revalidateTag(tag)` → `revalidateTag(tag, 'max')` wherever used
7. **Leave `cacheComponents` off** → all 28 `export const dynamic = 'force-dynamic'` keep working unchanged
8. **Keep `middleware.ts`; do not rename to `proxy.ts` yet** — `proxy` is Node-runtime-only and cannot be configured; confirm Clerk's Edge requirements first. `middleware.ts` still works in v16.
9. Verify the Turbopack-by-default build (no webpack config present, so expected to be clean)
10. Add `data-scroll-behavior="smooth"` to `<html>` if smooth scrolling is relied on

Clerk stays on **6.39.6** — it already peers `^16`.

---

### ⚪ Stage 5 — Defer. Revisit next quarter.

| Item | Why defer |
|---|---|
| **Tailwind 3 → 4** | 2–4 days, mostly un-automatable visual QA. 656-line `globals.css`, 60 `@apply`, 95 CSS vars, `@layer utilities` → `@utility`, HSL→OKLCH, `tailwindcss-animate`→`tw-animate-css`, and a shadcn re-add that **overwrites 29 `ui/*` files including 7 customized ones**. Silent regressions from `border`/`ring`/`shadow` default changes. **Zero security or compatibility pressure** — v3.4.19 is maintained under `v3-lts`. Highest cost, lowest forcing function. |
| **Clerk 6 → 7** | v6.39.6 already supports Next 16 and is patched. v7 removes `<SignedIn>`/`<SignedOut>`/`<Protect>` → `<Show>` (5 call sites) and changes `auth.protect()` to 401. No benefit until you want v7 features. |
| **Vitest 3 → 4** | `poolOptions`/`workspace`/coverage-shape churn + snapshot delimiter change. Stage 2 already clears the advisory at v3. |
| **jsdom 24 → 30** | Six majors, thin docs. Isolate it. |
| **`@vercel/kv` (deprecated)** | Not a bump — a storage migration to Upstash Redis / Vercel Marketplace. `redis@^5.5.6` is already present, so this may be half-done. **Verify the store still exists before the revival**; this could fail at runtime independently of any upgrade. |
| **TypeScript 5 → 7** | Native Go port; own compatibility story. Next 16 needs only ≥5.1. |
| **zod 3 → 4** | Substantial rewrite, used throughout API validation. No forcing function. |
| **Cache Components / PPR** | Architecturally incompatible with the `force-dynamic` blanket. A separate initiative, not part of this revival. |

---

## 11. Confidence and caveats

**Verified directly** (npm registry, official docs, or the repo itself): all version numbers in §1; Node EOL dates (`schedule.json`); the `@types/react` peer-constraint analysis (parsed from `package-lock.json`); `ElementRef` still present-but-deprecated and the three `useRef` overloads (extracted from the real `@types/react@19.2.18` tarball); all codebase counts (`useRef`, `forwardRef`, `JSX.`, `defaultProps`, `propTypes`, `export const dynamic`, async `params`, Clerk components, `globals.css` metrics); the advisory list and ranges (`npm audit` on the checked-in lockfile); `eslint-config-next@16` peering `eslint >=9`; `@clerk/nextjs@6.39.6` peering `next ^16`; Next.js 16 breaking changes (official upgrade guide + release blog); Tailwind v4 breaking changes (official upgrade guide); Turborepo v2 breaking changes (official docs).

**Flagged as unverified / needs empirical confirmation:**

1. **The `coverage.thresholds.global` finding (§7)** is inferred from Vitest's documented threshold schema (unknown keys are treated as globs), not observed. Confirm by running `npm run test:coverage` and checking the exit code.
2. **Vitest 1 → 2 specifics** came from the v3 migration page's summary rather than a live v2 guide (`v2.vitest.dev` not fetched directly).
3. **Actual ESLint error count is unknown** — linting has been disabled at build time. Stage 3's estimate is unbounded until `npx eslint .` is run.
4. **Second-order TypeScript inference drift** in the 29 `forwardRef` components under `@types/react-dom@19` cannot be predicted statically. The §2 estimate assumes it is minor; only a full `tsc --noEmit` settles it.
5. **Clerk's Edge-runtime requirement** for `middleware.ts` → `proxy.ts` was not confirmed against Clerk docs. Stage 4 recommends keeping `middleware.ts`, which is the safe default regardless.
6. **`npm audit` reflects the committed `package-lock.json`**, not necessarily what is deployed. Confirm against the live Vercel deployment.
7. **`@vercel/blob` 0.19 → 2.6.1** (two majors) and **`@sentry/nextjs` 9 → 10** breaking changes were not researched in depth.

**One judgment call worth surfacing:** this report puts a security patch ahead of every upgrade in the brief. That is a deliberate reordering of what was asked — the question was about upgrade sequencing, but `next@15.0.0` pinned exactly, with auth in middleware, is a live exploitable auth bypass with public exploit code on GitHub. Stage 0 is independent of the entire rest of the plan and should ship before any migration work is scoped.

---

## Sources

- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/blog/next-16
- https://nextjs.org/support-policy
- https://nextjs.org/docs/app/api-reference/config/eslint
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- https://tailwindcss.com/docs/upgrade-guide
- https://ui.shadcn.com/docs/tailwind-v4
- https://github.com/Wombosvideo/tw-animate-css
- https://turborepo.dev/docs/crafting-your-repository/upgrading
- https://turborepo.dev/blog/turbo-2-0
- https://eslint.org/docs/latest/use/migrate-to-10.0.0
- https://vitest.dev/guide/migration
- https://v3.vitest.dev/guide/migration
- https://github.com/testing-library/react-testing-library/releases
- https://nodejs.org/en/about/previous-releases
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://github.com/advisories/GHSA-f82v-jwr5-mffw (CVE-2025-29927)
- https://nvd.nist.gov/vuln/detail/CVE-2025-29927
- https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
- https://github.com/advisories/GHSA-vqx2-fgx2-5wq9 (Clerk middleware bypass)
- https://github.com/advisories/GHSA-w24r-5266-9c3c
- https://github.com/advisories/GHSA-9qr9-h5gf-34mp (Next.js RCE)
- https://github.com/advisories/GHSA-5xrq-8626-4rwp (Vitest UI)
