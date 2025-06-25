import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/settings(.*)',
  '/api/alerts(.*)',
  '/api/watchlists(.*)',
  '/api/webhooks(.*)',
  '/api/export(.*)',
  '/api/user(.*)',
  '/api/analytics(.*)',
  '/api/auth/preferences(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  // Protect specific routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}