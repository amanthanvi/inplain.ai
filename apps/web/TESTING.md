# Testing Guide for PolicyDiff Web App

This document outlines the comprehensive testing strategy and setup for the PolicyDiff web application.

## Overview

Our testing suite includes:
- **Unit Tests**: Component and utility function testing with Vitest
- **Integration Tests**: API and service integration testing
- **End-to-End Tests**: Full user journey testing with Playwright
- **Visual Regression Tests**: Screenshot-based UI testing
- **Performance Tests**: Core Web Vitals and load testing

## Test Stack

- **Testing Framework**: [Vitest](https://vitest.dev/) for unit and integration tests
- **E2E Testing**: [Playwright](https://playwright.dev/) for browser automation
- **React Testing**: [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/)
- **Assertions**: Built-in Vitest/Jest matchers + @testing-library/jest-dom
- **Coverage**: V8 coverage provider via Vitest

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run e2e               # E2E tests only

# Development workflows
npm run test:watch        # Watch mode for unit tests
npm run test:coverage     # Generate coverage report
npm run e2e:ui           # Interactive E2E testing
```

## Test Structure

```
apps/web/
├── e2e/                     # End-to-end tests
│   ├── auth.spec.ts
│   ├── homepage.spec.ts
│   └── company-page.spec.ts
├── src/
│   ├── components/
│   │   └── __tests__/       # Component unit tests
│   ├── hooks/
│   │   └── __tests__/       # Hook unit tests
│   ├── lib/
│   │   └── __tests__/       # Utility unit tests
│   ├── contexts/
│   │   └── __tests__/       # Context unit tests
│   └── test/
│       ├── setup.ts         # Test configuration
│       ├── utils.tsx        # Test utilities
│       └── integration/     # Integration tests
├── playwright.config.ts     # E2E test configuration
├── vitest.config.ts        # Unit test configuration
└── scripts/
    └── test-runner.js      # Custom test runner
```

## Unit Testing

### Component Testing

We test React components using React Testing Library:

```typescript
import { render, screen, fireEvent } from '@/test/utils'
import { Button } from '../button'

describe('Button', () => {
  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Hook Testing

Custom hooks are tested using `renderHook`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useSearch } from '../useSearch'

describe('useSearch', () => {
  it('performs search and returns results', async () => {
    const { result } = renderHook(() => useSearch())
    
    result.current.search('google')
    
    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
    })
  })
})
```

### Testing Guidelines

1. **Test behavior, not implementation**: Focus on what the component does, not how it does it
2. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Test user interactions**: Click events, form submissions, keyboard navigation
4. **Mock external dependencies**: APIs, third-party libraries, Next.js modules
5. **Test error states**: Loading states, error boundaries, validation errors

## Integration Testing

Integration tests verify that different parts of the application work together:

```typescript
describe('API Integration', () => {
  it('should fetch companies list', async () => {
    const response = await api.get('/api/companies')
    expect(response.data).toHaveLength(2)
  })
})
```

## End-to-End Testing

E2E tests simulate real user workflows:

```typescript
test('should complete login flow', async ({ page }) => {
  await page.goto('/login')
  
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel(/password/i).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  
  await expect(page).toHaveURL('/dashboard')
})
```

### E2E Best Practices

1. **Test critical user journeys**: Authentication, core features, checkout flows
2. **Use Page Object Models**: For complex pages with many interactions
3. **Run in multiple browsers**: Chrome, Firefox, Safari, mobile browsers
4. **Test responsive design**: Different viewport sizes and orientations
5. **Handle async operations**: Wait for network requests, animations

## Test Data Management

### Mock Data Factories

We provide factory functions for creating test data:

```typescript
import { createMockUser, createMockPolicy, createMockDiff } from '@/test/utils'

const user = createMockUser({ tier: 'premium' })
const policy = createMockPolicy({ slug: 'google' })
```

### API Mocking

For unit tests, we mock API calls:

```typescript
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}))
```

For E2E tests, we use Playwright's route interception:

```typescript
await page.route('**/api/companies', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: mockCompanies })
  })
})
```

## Coverage Requirements

Our coverage thresholds are set in `vitest.config.ts`:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Excluded from Coverage

- Type definition files (*.d.ts)
- Test files themselves
- Next.js pages (tested via E2E)
- API routes (tested via integration)

## Continuous Integration

Tests run automatically on:

- **Pull Requests**: All test suites
- **Main Branch**: Full test suite + security scans
- **Nightly**: Extended E2E tests across all browsers

### GitHub Actions Workflow

```yaml
- name: Run unit tests
  run: npm run test:coverage
  
- name: Run E2E tests
  run: npm run e2e
```

## Performance Testing

We monitor:

- **Core Web Vitals**: LCP, FID, CLS scores
- **Bundle Size**: JavaScript bundle analysis
- **Load Times**: Time to Interactive (TTI)
- **Memory Usage**: React component memory leaks

## Debugging Tests

### Unit Test Debugging

```bash
# Run specific test file
npm run test path/to/test.ts

# Debug mode
npm run test:watch

# Coverage for specific file
npm run test:coverage -- path/to/component
```

### E2E Test Debugging

```bash
# Visual debugging
npm run e2e:headed

# Interactive debugging
npm run e2e:debug

# Trace viewer
npx playwright show-trace trace.zip
```

## Common Testing Patterns

### Testing Forms

```typescript
test('validates form inputs', async () => {
  render(<LoginForm />)
  
  // Test validation
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  expect(screen.getByText(/email is required/i)).toBeVisible()
  
  // Test successful submission
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' }
  })
  // ... continue test
})
```

### Testing Async Components

```typescript
test('displays loading state', async () => {
  render(<AsyncComponent />)
  
  expect(screen.getByText(/loading/i)).toBeVisible()
  
  await waitFor(() => {
    expect(screen.getByText(/loaded content/i)).toBeVisible()
  })
})
```

### Testing Error Boundaries

```typescript
test('catches and displays errors', () => {
  const ThrowError = () => {
    throw new Error('Test error')
  }
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  )
  
  expect(screen.getByText(/something went wrong/i)).toBeVisible()
})
```

## Contributing

When adding new features:

1. **Write tests first** (TDD approach preferred)
2. **Test edge cases**: Empty states, error conditions, boundary values
3. **Update this documentation** if adding new testing patterns
4. **Ensure all tests pass** before submitting PR
5. **Add E2E tests** for user-facing features

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)