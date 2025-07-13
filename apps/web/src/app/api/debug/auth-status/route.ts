import { NextResponse } from 'next/server'
import { isDevAuthEnabled } from '@/lib/dev-auth'

export const runtime = 'edge'

export async function GET() {
  const clerkPublicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  const nodeEnv = process.env.NODE_ENV
  const vercelEnv = process.env.VERCEL_ENV
  const devAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS
  
  return NextResponse.json({
    environment: {
      NODE_ENV: nodeEnv,
      VERCEL_ENV: vercelEnv,
      DEV_AUTH_BYPASS: devAuthBypass,
      IS_PRODUCTION: nodeEnv === 'production',
      DEV_AUTH_ENABLED: isDevAuthEnabled()
    },
    clerkConfig: {
      hasPublicKey: !!clerkPublicKey,
      hasSecretKey: !!clerkSecretKey,
      publicKeyPrefix: clerkPublicKey ? clerkPublicKey.substring(0, 10) + '...' : null,
      isConfigured: !!(clerkPublicKey && clerkSecretKey)
    },
    authBehavior: {
      shouldRequireAuth: nodeEnv === 'production' && !isDevAuthEnabled(),
      devAuthActive: isDevAuthEnabled(),
      message: isDevAuthEnabled() 
        ? 'Development auth bypass is active' 
        : nodeEnv === 'production'
          ? 'Production mode - authentication required'
          : 'Development mode - authentication may be bypassed'
    },
    timestamp: new Date().toISOString()
  })
}