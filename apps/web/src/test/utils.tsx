import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { AuthProvider } from '@/contexts/auth-context'

// Mock providers for testing
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  tier: 'free' as const,
  preferences: {
    watchlist: ['google', 'facebook'],
    notifications: {
      email: true,
      majorChanges: true,
      weeklyDigest: false
    }
  },
  ...overrides
})

export const createMockPolicy = (overrides = {}) => ({
  id: 'test-policy-id',
  slug: 'test-company',
  name: 'Test Company',
  url: 'https://test.com/privacy',
  content: 'Test privacy policy content',
  lastChecked: new Date().toISOString(),
  version: 1,
  metadata: {
    wordCount: 1000,
    readingTime: 5,
    lastModified: new Date().toISOString()
  },
  ...overrides
})

export const createMockDiff = (overrides = {}) => ({
  id: 'test-diff-id',
  companySlug: 'test-company',
  version: 2,
  changes: [
    {
      type: 'addition' as const,
      text: 'New privacy policy section',
      position: 100
    }
  ],
  summary: 'Test policy changes',
  timestamp: new Date().toISOString(),
  metadata: {
    changeCount: 1,
    impactLevel: 'moderate' as const
  },
  ...overrides
})

export const createMockAnalysis = (overrides = {}) => ({
  id: 'test-analysis-id',
  companySlug: 'test-company',
  type: 'comprehensive' as const,
  result: 'This is a test AI analysis of the privacy policy.',
  metadata: {
    model: 'claude-3-5-sonnet',
    timestamp: new Date().toISOString(),
    processingTime: 2.5
  },
  ...overrides
})