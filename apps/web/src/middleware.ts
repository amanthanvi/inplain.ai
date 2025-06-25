import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

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

// Define public routes that should always be accessible
const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/companies',
  '/login(.*)',
  '/signup(.*)',
  '/api/companies(.*)',
  '/api/diff(.*)',
  '/api/diffs(.*)',
  '/api/snapshot(.*)',
  '/api/summary(.*)',
  '/api/health',
  '/api/status',
  // Company pages - dynamic routes
  '/[^/]+$', // Matches single path segments like /google, /facebook
])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }
  
  // Protect specific routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}