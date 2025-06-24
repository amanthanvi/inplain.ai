import { NextResponse } from 'next/server';
import { getClerkUser } from '@/lib/auth-clerk';
import { isDevAuthEnabled, DEV_USER, DEV_AUTH_WARNING } from '@/lib/dev-auth';

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  const devAuthEnabled = isDevAuthEnabled();
  const clerkUser = await getClerkUser();
  
  const response = {
    devAuth: {
      enabled: devAuthEnabled,
      warning: devAuthEnabled ? DEV_AUTH_WARNING : null,
      devUser: devAuthEnabled ? {
        id: DEV_USER.id,
        email: DEV_USER.email,
        tier: DEV_USER.tier
      } : null
    },
    currentUser: clerkUser ? {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      tier: (clerkUser.publicMetadata as any)?.tier || 'free',
      isDevUser: clerkUser.id === DEV_USER.id
    } : null,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DEV_AUTH_BYPASS: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS
    }
  };

  const headers = new Headers();
  if (devAuthEnabled) {
    headers.set('X-Dev-Auth-Active', 'true');
    headers.set('X-Dev-Auth-Warning', 'Authentication bypassed for development');
  }

  return NextResponse.json(response, { headers });
}