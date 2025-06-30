import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  // Only allow in development or with a secret key
  const debugSecret = process.env.DEBUG_SECRET
  const isDev = process.env.NODE_ENV === 'development'
  
  if (!isDev && debugSecret !== 'your-debug-secret') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const envStatus = {
    clerk: {
      publishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: !!process.env.CLERK_SECRET_KEY,
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'not set',
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || 'not set',
      fallbackRedirectUrl: process.env.NEXT_PUBLIC_CLERK_FALLBACK_REDIRECT_URL || 'not set',
      forceRedirectUrl: process.env.NEXT_PUBLIC_CLERK_FORCE_REDIRECT_URL || 'not set',
    },
    kv: {
      restApiUrl: !!process.env.KV_REST_API_URL,
      restApiToken: !!process.env.KV_REST_API_TOKEN,
    },
    vercel: {
      env: process.env.VERCEL_ENV || 'not set',
      url: process.env.VERCEL_URL || 'not set',
      isVercel: !!process.env.VERCEL,
    },
    app: {
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'not set',
    },
    ai: {
      openRouterKey: !!process.env.OPENROUTER_API_KEY,
      defaultModel: process.env.DEFAULT_AI_MODEL || 'not set',
    }
  }

  return NextResponse.json({ 
    status: 'ok',
    environment: envStatus,
    timestamp: new Date().toISOString()
  })
}