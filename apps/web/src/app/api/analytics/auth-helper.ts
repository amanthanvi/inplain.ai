import { kv } from '@vercel/kv';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export interface SessionUser {
  id: string;
  email: string;
  tier: 'free' | 'premium' | 'enterprise';
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
};

export async function validateAnalyticsAccess(
  token: string | null,
  requiredTiers: string[] = ['premium', 'enterprise']
): Promise<{ user: SessionUser | null; error?: string }> {
  try {
    let userId: string | null = null;

    // First try to get user from cookie session
    if (!token) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('session');
      
      if (!sessionCookie?.value) {
        return { user: null, error: 'Unauthorized' };
      }

      try {
        const { payload } = await jwtVerify(sessionCookie.value, getJwtSecret());
        userId = payload.userId as string;
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        return { user: null, error: 'Invalid session' };
      }
    } else {
      // If token is provided explicitly, check if it's an API key or session token
      if (token.startsWith('pk_')) {
        // API Key authentication
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        const hashedKey = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
        
        userId = await kv.get<string>(`apikey:${hashedKey}`);
        if (!userId) {
          return { user: null, error: 'Invalid API key' };
        }
      } else {
        // Session token from KV
        userId = await kv.get<string>(`session:${token}`);
        if (!userId) {
          return { user: null, error: 'Invalid session' };
        }
      }
    }

    if (!userId) {
      return { user: null, error: 'Unauthorized' };
    }

    // Get user data
    const user = await kv.hgetall(`user:${userId}`) as any;
    if (!user || !user.id) {
      return { user: null, error: 'User not found' };
    }

    // Check tier access
    if (!requiredTiers.includes(user.tier || 'free')) {
      return { user: null, error: `This feature requires ${requiredTiers.join(' or ')} tier` };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier || 'free'
      }
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { user: null, error: 'Session validation failed' };
  }
}