'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorCount: number
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null
  private previousResetKeys: Array<string | number> = []

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      errorCount: 0,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorCount: 0,
      showDetails: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 ErrorBoundary caught an error')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Stack:', error.stack)
      console.groupEnd()
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo)
    }

    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, LogRocket, etc.
      console.error('Production error:', { error, errorInfo })
    }

    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }))
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state
    
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary()
    }
    
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== this.previousResetKeys[idx])
      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
    
    this.previousResetKeys = resetKeys || []
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    })
  }

  render() {
    const { hasError, error, errorInfo, errorCount, showDetails } = this.state
    const { fallback, children, isolate, level = 'component', showDetails: showDetailsProp } = this.props

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>
      }

      const isPageLevel = level === 'page'
      const isSectionLevel = level === 'section'
      
      return (
        <div className={cn(
          "flex items-center justify-center",
          isPageLevel && "min-h-screen",
          isSectionLevel && "min-h-[400px] py-12",
          !isPageLevel && !isSectionLevel && "p-8"
        )}>
          <Card className={cn(
            "w-full",
            isPageLevel && "max-w-2xl",
            isSectionLevel && "max-w-xl",
            !isPageLevel && !isSectionLevel && "max-w-md"
          )}>
            <CardHeader className="text-center">
              <div className={cn(
                "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
                errorCount > 2 ? "bg-destructive/20" : "bg-amber-100"
              )}>
                <AlertTriangle className={cn(
                  "h-8 w-8",
                  errorCount > 2 ? "text-destructive" : "text-amber-600"
                )} />
              </div>
              <CardTitle className="text-2xl">
                {isPageLevel ? "Something went wrong" : "Component Error"}
              </CardTitle>
              <CardDescription>
                {errorCount > 2 
                  ? "This component is experiencing repeated errors. Please refresh the page."
                  : "We encountered an unexpected error. Please try again."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Message */}
              {(showDetailsProp || process.env.NODE_ENV === 'development') && (
                <Alert variant="destructive" className="text-sm">
                  <AlertDescription>
                    <code className="font-mono">{error.message}</code>
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button onClick={this.resetErrorBoundary} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                
                {isPageLevel && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/">
                      <Home className="mr-2 h-4 w-4" />
                      Go to Homepage
                    </Link>
                  </Button>
                )}
              </div>

              {/* Expandable Error Details */}
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => this.setState({ showDetails: !showDetails })}
                    className="w-full justify-between"
                  >
                    <span className="flex items-center">
                      <Bug className="mr-2 h-4 w-4" />
                      Error Details
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      showDetails && "rotate-180"
                    )} />
                  </Button>
                  
                  {showDetails && (
                    <div className="mt-2 space-y-2 rounded-lg bg-muted p-4">
                      <div className="text-xs font-mono">
                        <p className="font-semibold">Component Stack:</p>
                        <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                      {error.stack && (
                        <div className="text-xs font-mono">
                          <p className="font-semibold">Error Stack:</p>
                          <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

// Async Error Boundary for Suspense
export function AsyncErrorBoundary({ 
  children, 
  fallback,
  ...props 
}: Props) {
  return (
    <ErrorBoundary fallback={fallback} {...props}>
      {children}
    </ErrorBoundary>
  )
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Props
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Network Error Boundary
export function NetworkErrorBoundary({ 
  children,
  onRetry
}: {
  children: ReactNode
  onRetry?: () => void
}) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Connection Error</CardTitle>
            <CardDescription>
              Unable to connect to our servers. Please check your internet connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Error boundary specifically for forms
export function FormErrorBoundary({ 
  children,
  onReset
}: {
  children: ReactNode
  onReset?: () => void
}) {
  return (
    <ErrorBoundary
      resetOnPropsChange
      onError={(error) => {
        console.error('Form error:', error)
      }}
      fallback={
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            There was an error with the form. Please refresh and try again.
          </AlertDescription>
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  )
}