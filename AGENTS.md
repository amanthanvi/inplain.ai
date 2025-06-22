# PolicyDiff Codebase Guidelines for AI Agents

## Build/Test Commands
- **Build**: `npm run build` (uses Turbo for monorepo)
- **Test**: `npm test` (all tests) or `npm run test:watch` (watch mode)
- **Single test**: `npm test -- path/to/test.ts` or `cd packages/[name] && npm test -- file.test.ts`
- **Lint**: `npm run lint` (ESLint + Prettier)
- **Type check**: `npm run typecheck`
- **Format**: `npm run format` (auto-fix with Prettier)

## Code Style
- **TypeScript**: Strict mode enabled, `noUncheckedIndexedAccess: true`
- **Imports**: Use absolute imports `@policydiff/shared`, `@/*` for app-relative
- **Formatting**: Tabs (width 4), double quotes, semicolons, trailing commas ES5
- **Naming**: camelCase for variables/functions, PascalCase for types/components
- **Files**: kebab-case for filenames, `.test.ts` for tests in `__tests__/` folders

## Error Handling
- Use Zod schemas for validation (see `packages/shared/src/schemas.ts`)
- Return typed errors, avoid throwing unless necessary
- Log errors with context, use structured logging where available

## Testing
- Vitest for unit tests, Playwright for E2E
- Test files use `describe`, `it`, `expect`, `beforeEach` from vitest
- Mock external services, test edge cases