import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    
    // Server-specific options
    autoSessionTracking: true,
    
    // Integrations
    integrations: [
      // Database query tracking
      Sentry.prismaIntegration(),
      // HTTP request tracking
      Sentry.httpIntegration({
        tracing: true,
      }),
    ],
    
    // Filtering
    ignoreErrors: [
      // Ignore client-side errors that leaked to server
      'ResizeObserver loop limit exceeded',
      // Ignore expected errors
      'AbortError',
      'Request aborted',
    ],
    
    beforeSend(event, hint) {
      // Add request context
      const error = hint.originalException
      
      // Add custom breadcrumbs for API routes
      if (event.request?.url?.includes('/api/')) {
        Sentry.addBreadcrumb({
          category: 'api',
          message: `API call to ${event.request.url}`,
          level: 'info',
          data: {
            method: event.request.method,
            status_code: event.contexts?.response?.status_code,
          },
        })
      }
      
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && 
          !process.env.SENTRY_SEND_IN_DEVELOPMENT) {
        return null
      }
      
      return event
    },
    
    // Profiling (requires additional setup)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  })
}

// Export custom error class for better error tracking
export class ApplicationError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    
    Error.captureStackTrace(this, this.constructor)
    
    // Automatically report to Sentry
    if (!isOperational) {
      Sentry.captureException(this, {
        contexts: {
          application: {
            statusCode,
            context,
          },
        },
      })
    }
  }
}