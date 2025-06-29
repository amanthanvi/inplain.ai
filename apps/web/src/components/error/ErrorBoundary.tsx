'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  eventId: string | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{
    error: Error
    resetError: () => void
    eventId: string | null
  }>
  showDialog?: boolean
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Report to Sentry
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })

    // Update state
    this.setState({
      error,
      errorInfo,
      eventId,
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
            eventId={this.state.eventId}
          />
        )
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          eventId={this.state.eventId}
          showDialog={this.props.showDialog}
        />
      )
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: Error
  resetError: () => void
  eventId: string | null
  showDialog?: boolean
}

function DefaultErrorFallback({
  error,
  resetError,
  eventId,
  showDialog = true,
}: DefaultErrorFallbackProps) {
  const router = useRouter()
  const [showDetails, setShowDetails] = React.useState(false)

  React.useEffect(() => {
    // Show Sentry user feedback dialog if available
    if (showDialog && eventId && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.showReportDialog({ eventId })
    }
  }, [eventId, showDialog])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            We apologize for the inconvenience. The error has been reported to our team.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={resetError} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => router.push('/')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6">
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              {showDetails ? 'Hide' : 'Show'} Error Details
            </Button>

            {showDetails && (
              <div className="mt-2 p-4 bg-muted rounded-lg">
                <p className="font-mono text-sm break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 text-xs overflow-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {eventId && (
          <p className="text-center text-xs text-muted-foreground">
            Error ID: {eventId}
          </p>
        )}
      </div>
    </div>
  )
}

// HOC for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for error handling
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by useErrorHandler:', error, errorInfo)
    }

    Sentry.captureException(error, {
      extra: errorInfo,
    })
  }, [])
}