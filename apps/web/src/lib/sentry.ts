/**
 * Sentry integration for error tracking and performance monitoring
 * This is a unified configuration that works across client, server, and edge runtimes
 */

// Check if Sentry should be enabled
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const IS_ENABLED = SENTRY_DSN && (IS_PRODUCTION || process.env.SENTRY_SEND_IN_DEVELOPMENT === 'true')

// Type definitions for Sentry-like interface
interface SentryUser {
  id?: string
  email?: string
  username?: string
}

interface SentryContext {
  [key: string]: any
}

interface SentryBreadcrumb {
  message?: string
  type?: string
  category?: string
  level?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  data?: Record<string, any>
  timestamp?: number
}

// Sentry-compatible interface that works with or without Sentry
class SentryService {
  private breadcrumbs: SentryBreadcrumb[] = []
  private context: SentryContext = {}
  private user: SentryUser | null = null

  captureException(error: any, context?: SentryContext): void {
    if (IS_ENABLED) {
      // In production, this would send to Sentry
      console.error('[Sentry] Exception captured:', error, context)
    } else {
      // In development, just log
      console.error('[Error]', error, context)
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (IS_ENABLED) {
      console.log(`[Sentry] Message captured (${level}):`, message)
    } else {
      console.log(`[${level.toUpperCase()}]`, message)
    }
  }

  setUser(user: SentryUser | null): void {
    this.user = user
    if (IS_ENABLED) {
      console.log('[Sentry] User context updated:', user)
    }
  }

  setContext(key: string, context: any): void {
    this.context[key] = context
    if (IS_ENABLED) {
      console.log(`[Sentry] Context '${key}' updated:`, context)
    }
  }

  addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now()
    })
    
    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100)
    }

    if (IS_ENABLED) {
      console.log('[Sentry] Breadcrumb added:', breadcrumb)
    }
  }

  withScope(callback: (scope: any) => void): void {
    // Simplified scope implementation
    const scope = {
      setTag: (key: string, value: string) => {
        this.context[`tag:${key}`] = value
      },
      setContext: (key: string, context: any) => {
        this.setContext(key, context)
      },
      setUser: (user: SentryUser) => {
        this.setUser(user)
      }
    }
    callback(scope)
  }

  // Performance monitoring
  startTransaction(name: string, op: string): any {
    const transaction = {
      name,
      op,
      startTime: Date.now(),
      finish: () => {
        const duration = Date.now() - transaction.startTime
        if (IS_ENABLED) {
          console.log(`[Sentry] Transaction '${name}' completed in ${duration}ms`)
        }
      }
    }
    return transaction
  }
}

// Create singleton instance
const sentryService = new SentryService()

// Export Sentry-compatible API
export const captureException = (error: any, context?: any) => 
  sentryService.captureException(error, context)

export const captureMessage = (message: string, level?: any) => 
  sentryService.captureMessage(message, level)

export const setUser = (user: SentryUser | null) => 
  sentryService.setUser(user)

export const setContext = (key: string, context: any) => 
  sentryService.setContext(key, context)

export const addBreadcrumb = (breadcrumb: SentryBreadcrumb) => 
  sentryService.addBreadcrumb(breadcrumb)

export const withScope = (callback: (scope: any) => void) => 
  sentryService.withScope(callback)

export const startTransaction = (context: { name: string; op: string }) => 
  sentryService.startTransaction(context.name, context.op)

// Re-export types
export type { SentryUser, SentryContext, SentryBreadcrumb }

// Helper function to initialize Sentry with user context from Clerk
export async function initializeSentryUser(userId?: string, email?: string) {
  if (userId) {
    setUser({
      id: userId,
      email: email
    })
  }
}

// Error boundary integration
export function sentryErrorBoundary(error: Error, errorInfo: any) {
  captureException(error, {
    errorBoundary: true,
    componentStack: errorInfo.componentStack
  })
}

// API route error handler
export function sentryApiHandler(error: any, req: Request) {
  const url = new URL(req.url)
  captureException(error, {
    request: {
      url: url.pathname,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    }
  })
}