import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.01, // 1% of sessions
    replaysOnErrorSampleRate: 0.1, // 10% of sessions with errors
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    
    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Filtering
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // User-caused errors
      'Non-Error promise rejection captured',
      // Safari specific
      'The operation is insecure',
    ],
    
    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes('chrome-extension://') ||
                 frame.filename?.includes('moz-extension://')
      )) {
        return null
      }
      
      // Add user context if available
      const user = getUserContext()
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
          username: user.username,
        }
      }
      
      return event
    },
  })
}

// Helper to get user context (implement based on your auth)
function getUserContext(): { id: string; email?: string; username?: string } | null {
  // This would integrate with Clerk
  // For now, return null until Clerk integration is added
  return null
}