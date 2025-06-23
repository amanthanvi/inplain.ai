# PolicyDiff Codebase Guidelines for AI Agents

## Build/Test Commands
- **Build**: `npm run build` (uses Turbo for monorepo)
- **Test**: `npm test` (all tests) or `npm run test:watch` (watch mode)
- **Single test**: `npm test -- path/to/test.ts` or `cd packages/[name] && npm test -- file.test.ts`
- **Dev server**: `npm run dev` (starts all services in watch mode)
- **Lint**: `npm run lint` (ESLint + Prettier)
- **Type check**: `npm run typecheck`
- **Format**: `npm run format` (auto-fix) or `npm run format:check` (verify)
- **Clean**: `npm run clean` (removes build artifacts and node_modules)

## Code Style
- **TypeScript**: Strict mode, `noUncheckedIndexedAccess: true`, target ES2022
- **Imports**: Use `@policydiff/shared`, `@policydiff/api` for cross-package, `@/*` for app-relative
- **Formatting**: Tabs (width 4), double quotes, semicolons, trailing commas ES5, 80 char lines
- **Naming**: camelCase for variables/functions, PascalCase for types/components/classes
- **Files**: kebab-case for filenames, `.test.ts` for tests in `__tests__/` folders

## Project Structure
- **Monorepo**: Turbo-based with workspaces in `apps/*` and `packages/*`
- **Packages**: `shared` (common types/utils), `api` (backend logic), `scraper` (web scraping)
- **Apps**: `web` (Next.js frontend)
- **Node**: Requires v20.0.0+, uses npm@10.2.0 package manager

## Testing & Quality
- **Unit tests**: Vitest with 90% coverage thresholds, use `describe`, `it`, `expect`
- **E2E tests**: Playwright (when configured)
- **Mocking**: Mock external services, test edge cases
- **Pre-commit**: Husky hooks for linting and formatting

## Error Handling & Validation
- Use Zod schemas for validation (see `packages/shared/src/schemas.ts`)
- Return typed errors, avoid throwing unless necessary
- Log errors with context, use structured logging where available