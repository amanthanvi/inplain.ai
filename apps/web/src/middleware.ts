import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { isDevAuthEnabled, DEV_SESSION_TOKEN, DEV_USER, isDevAuthRequest } from './lib/dev-auth';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
};

// Protected routes that require authentication
const protectedRoutes = [
  '/api/alerts',
  '/api/watchlists',
  '/api/webhooks',
  '/api/export',
  '/api/user',
  '/api/analytics',
  '/api/analyze',
  '/api/analyze-stream',
  '/api/analyze-advanced',
  '/api/summary',
  '/dashboard',
  '/settings',
  '/watchlist',
  '/onboarding'
];

// API routes that require premium tier
const premiumApiRoutes = [
  '/api/analytics',
  '/api/export',
  '/api/webhooks'
];

async function verifyAuth(request: NextRequest): Promise<{ authenticated: boolean; userId?: string }> {
  // Development bypass
  if (isDevAuthEnabled()) {
    const sessionCookie = request.cookies.get('session');
    
    // Check for dev auth headers (for API requests)
    if (isDevAuthRequest(request.headers)) {
      console.log('🔓 Dev auth bypass via headers');
      return {
        authenticated: true,
        userId: DEV_USER.id
      };
    }
    
    // Check for dev session token
    if (sessionCookie?.value === DEV_SESSION_TOKEN) {
      console.log('🔓 Dev auth bypass via session token');
      return {
        authenticated: true,
        userId: DEV_USER.id
      };
    }
    
    // Auto-authenticate in dev mode
    if (!sessionCookie?.value) {
      console.log('🔓 Dev auth auto-bypass (no session)');
      return {
        authenticated: true,
        userId: DEV_USER.id
      };
    }
  }

  const sessionCookie = request.cookies.get('session');
  
  if (!sessionCookie?.value) {
    return { authenticated: false };
  }

  try {
    const { payload } = await jwtVerify(sessionCookie.value, getJwtSecret());
    return {
      authenticated: true,
      userId: payload.userId as string
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return { authenticated: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  
  // Add development auth warning header
  if (isDevAuthEnabled()) {
    response.headers.set('X-Dev-Auth-Active', 'true');
    response.headers.set('X-Dev-Auth-Warning', 'Authentication bypassed for development');
  }
  
  // Add performance headers
  response.headers.set('X-Robots-Tag', 'index, follow');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Add timing headers for performance monitoring
  response.headers.set('Server-Timing', `total;dur=${Date.now()}`);
  
  // Compression hints
  response.headers.set('Accept-CH', 'DPR, Width, Viewport-Width');
  
  // Check if route requires authentication
  const requiresAuth = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (requiresAuth) {
    const { authenticated, userId } = await verifyAuth(request);
    
    if (!authenticated) {
      // For API routes, return 401 Unauthorized
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      // For web routes, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Add user ID to request headers for downstream use
    if (userId) {
      response.headers.set('X-User-Id', userId);
    }
  }
  
  // For API routes, add CORS and rate limiting headers
  if (pathname.startsWith('/api/')) {
    // CORS for API
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
    
    // Rate limiting headers (actual limiting would be done by a service like Vercel Edge Config)
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', '99');
    response.headers.set('X-RateLimit-Reset', String(Date.now() + 3600000));
  }
  
  // Static asset optimization
  if (isStaticAsset(pathname)) {
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