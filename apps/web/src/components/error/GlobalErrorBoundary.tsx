'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { FadeIn } from '@/components/ui/framer-animations'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo)
    
    // In production, send to error tracking service like Sentry
    if (process.env.NODE_ENV === 'production') {
      // logErrorToService(error, errorInfo)
    }
    
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
          <FadeIn>
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>
                  We encountered an unexpected error. Our team has been notified.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
                    <p className="font-semibold text-destructive mb-1">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.error.stack && (
                      <pre className="text-muted-foreground whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  <Button onClick={() => window.location.reload()} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/'}
                    className="w-full"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>
                  {process.env.NODE_ENV === 'development' && (
                    <Button 
                      variant="outline" 
                      onClick={this.handleReset}
                      className="w-full"
                    >
                      <Bug className="h-4 w-4 mr-2" />
                      Reset Error Boundary
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Error ID: {Date.now().toString(36)}
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      )
    }

    return this.props.children
  }
}