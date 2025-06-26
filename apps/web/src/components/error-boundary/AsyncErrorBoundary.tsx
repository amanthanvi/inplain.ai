'use client'

import React, { Component, ReactNode, Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingSpinner } from '@/components/ui/loading-states'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
  onError?: (error: Error) => void
}

export function AsyncErrorBoundary({
  children,
  fallback,
  loadingFallback,
  onError
}: AsyncErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Suspense fallback={loadingFallback || <LoadingSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

// Wrapper for async server components
export function AsyncBoundary({ 
  children,
  errorFallback,
  loadingFallback 
}: {
  children: ReactNode
  errorFallback?: ReactNode
  loadingFallback?: ReactNode
}) {
  return (
    <AsyncErrorBoundary
      fallback={errorFallback}
      loadingFallback={loadingFallback}
    >
      {children}
    </AsyncErrorBoundary>
  )
}