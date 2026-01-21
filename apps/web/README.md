# Web (Next.js)

This is the Next.js app for:

- Marketing site (`/`, `/companies`, `/about`, `/roadmap`)
- Authenticated app (`/app/*`)

Source of truth: `SPEC.md` (repo root).

## Local dev

From the repo root:

```bash
make dev-web
```

## Auth (Clerk, App Router)

- `apps/web/proxy.ts` uses `clerkMiddleware()` from `@clerk/nextjs/server`.
- `apps/web/app/layout.tsx` wraps the app in `<ClerkProvider>`.

## Deploy

See `infra/railway/README.md`.
