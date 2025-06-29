'use client'

import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs'
import { ReactNode } from 'react'

// Wrapper to handle build-time dummy keys
export function ClerkProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  
  // During build with dummy key, just render children without Clerk
  if (publishableKey === 'pk_test_dummy' || !publishableKey) {
    return <>{children}</>
  }
  
  return (
    <BaseClerkProvider publishableKey={publishableKey}>
      {children}
    </BaseClerkProvider>
  )
}