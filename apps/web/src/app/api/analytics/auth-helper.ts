import { kv } from '@vercel/kv';

export interface SessionUser {
  id: string;
  email: string;
  tier: 'free' | 'premium' | 'enterprise';
}

export async function validateAnalyticsAccess(
  token: string | null,
  requiredTiers: string[] = ['premium', 'enterprise']
): Promise<{ user: SessionUser | null; error?: string }> {
  if (!token) {
    return { user: null, error: 'Unauthorized' };
  }

  try {
    // Get user ID from session token
    const userId = await kv.get<string>(`session:${token}`);
    if (!userId) {
      return { user: null, error: 'Invalid session' };
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