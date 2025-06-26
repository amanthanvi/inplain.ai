'use client'

import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'

interface SafeLayoutProps {
  children: ReactNode
}

export function SafeLayout({ children }: SafeLayoutProps) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}