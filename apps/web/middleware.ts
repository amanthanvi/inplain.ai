import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/login',
  '/signup',
  '/api/health',
  '/api/status',
  '/api/companies(.*)',
  '/api/search(.*)',
  '/api/diff/(.*)',
  '/api/analyze/(.*)',
  '/api/summary/(.*)',
  '/(.*)/page.tsx', // Company pages are public for viewing
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};