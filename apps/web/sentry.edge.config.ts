import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    
    // Performance Monitoring for Edge Runtime
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    
    // Edge-specific configuration
    transportOptions: {
      // Reduce request size for edge runtime
      maxValueLength: 250,
    },
    
    beforeSend(event, hint) {
      // Add Edge runtime context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'edge',
          version: process.env.VERCEL_EDGE_RUNTIME_VERSION,
        },
      }
      
      // Add region information
      if (process.env.VERCEL_REGION) {
        event.tags = {
          ...event.tags,
          region: process.env.VERCEL_REGION,
        }
      }
      
      return event
    },
  })
}