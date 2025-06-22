import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add performance headers
  response.headers.set('X-Robots-Tag', 'index, follow');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Enable HTTP/2 Server Push for critical resources
  const pushResources = [
    '/fonts/inter-var.woff2',
    '/_next/static/css/app.css',
    '/_next/static/js/main.js'
  ];
  
  const linkHeader = pushResources
    .map(resource => `<${resource}>; rel=preload; as=${getAsType(resource)}`)
    .join(', ');
  
  response.headers.set('Link', linkHeader);
  
  // Add timing headers for performance monitoring
  response.headers.set('Server-Timing', `total;dur=${Date.now()}`);
  
  // Compression hints
  response.headers.set('Accept-CH', 'DPR, Width, Viewport-Width');
  
  // For API routes, add CORS and rate limiting headers
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // CORS for API
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Rate limiting headers (actual limiting would be done by a service like Vercel Edge Config)
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', '99');
    response.headers.set('X-RateLimit-Reset', String(Date.now() + 3600000));
  }
  
  // Static asset optimization
  if (isStaticAsset(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('CDN-Cache-Control', 'max-age=31536000');
  }
  
  return response;
}

function getAsType(resource: string): string {
  if (resource.endsWith('.css')) return 'style';
  if (resource.endsWith('.js')) return 'script';
  if (resource.endsWith('.woff2')) return 'font';
  return 'fetch';
}

function isStaticAsset(pathname: string): boolean {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
    '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};