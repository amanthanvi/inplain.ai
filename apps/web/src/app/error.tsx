'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { AnimatedContainer } from '@/components/ui/animations'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Page error:', error)
    
    // In production, send to error tracking
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, etc.
    }
  }, [error])

  const isNetworkError = error.message.toLowerCase().includes('fetch') || 
                        error.message.toLowerCase().includes('network')
  const isAuthError = error.message.toLowerCase().includes('auth') || 
                     error.message.toLowerCase().includes('unauthorized')

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <AnimatedContainer animation="scale">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl">
              {isNetworkError ? 'Connection Problem' : 
               isAuthError ? 'Authentication Error' : 
               'Something went wrong'}
            </CardTitle>
            <CardDescription className="text-base">
              {isNetworkError ? 
                'We\'re having trouble connecting to our servers. Please check your internet connection and try again.' :
               isAuthError ? 
                'There was a problem with your authentication. Please try signing in again.' :
                'We encountered an unexpected error. Our team has been notified and we\'re working on a fix.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error ID for support */}
            {error.digest && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Error ID: <code className="font-mono">{error.digest}</code>
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <Button onClick={reset} size="lg" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button variant="outline" size="lg" asChild className="w-full">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Homepage
                </Link>
              </Button>

              {isAuthError && (
                <Button variant="outline" size="lg" asChild className="w-full">
                  <Link href="/login">
                    Sign In Again
                  </Link>
                </Button>
              )}
            </div>

            {/* Support link */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Still having trouble?
              </p>
              <Button variant="ghost" size="sm" asChild>
                <a href="mailto:support@inplain.ai">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </div>

            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 rounded-lg bg-muted p-4">
                  <p className="text-xs font-mono break-all">
                    {error.message}
                  </p>
                  {error.stack && (
                    <pre className="mt-2 text-xs overflow-x-auto">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </AnimatedContainer>
    </div>
  )
}