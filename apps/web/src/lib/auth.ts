import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { kv } from '@vercel/kv';
import { isDevAuthEnabled, DEV_USER, DEV_SESSION_TOKEN, logDevAuthStatus } from './dev-auth';

export type { User, Session, AuthTokens } from './types/auth';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
};

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-512'
      },
      keyMaterial,
      512
    );
    
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [saltHex, storedHashHex] = hashedPassword.split(':');
    if (!saltHex || !storedHashHex) return false;
    
    const encoder = new TextEncoder();
    
    const saltMatches = saltHex.match(/.{2}/g);
    if (!saltMatches) return false;
    
    const salt = new Uint8Array(saltMatches.map(byte => parseInt(byte, 16)));
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-512'
      },
      keyMaterial,
      512
    );
    
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === storedHashHex;
  }

  static async createUser(email: string, password: string, name: string): Promise<User> {
    const userId = crypto.randomUUID();
    const hashedPassword = await this.hashPassword(password);
    
    const user: User = {
      id: userId,
      email: email.toLowerCase(),
      name,
      tier: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      emailAlerts: false,
      alertFrequency: 'daily',
      customWatchlists: [],
      usage: {
        apiCalls: 0,
        analysisCount: 0,
        lastReset: new Date()
      }
    };

    // Store user in KV
    await kv.hset(`user:${userId}`, user as unknown as { [field: string]: unknown });
    await kv.set(`user:email:${email.toLowerCase()}`, userId);
    await kv.set(`user:password:${userId}`, hashedPassword);

    // Create verification token
    const tokenArray = crypto.getRandomValues(new Uint8Array(32));
    const verificationToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
    await kv.set(`verify:${verificationToken}`, userId, { ex: 24 * 60 * 60 }); // 24 hours

    return user;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const userId = await kv.get<string>(`user:email:${email.toLowerCase()}`);
    if (!userId) return null;
    
    const user = await kv.hgetall(`user:${userId}`) as User | null;
    return user;
  }

  static async getUserById(userId: string): Promise<User | null> {
    // Development bypass
    if (isDevAuthEnabled() && userId === DEV_USER.id) {
      return DEV_USER;
    }
    
    const user = await kv.hgetall(`user:${userId}`) as User | null;
    return user;
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    await kv.hset(`user:${userId}`, updatedUser as unknown as { [field: string]: unknown });
    
    // Update email index if email changed
    if (updates.email && updates.email !== user.email) {
      await kv.del(`user:email:${user.email}`);
      await kv.set(`user:email:${updates.email.toLowerCase()}`, userId);
    }

    return updatedUser;
  }

  static async createSession(userId: string): Promise<string> {
    const token = await new SignJWT({ userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(getJwtSecret());

    // Store session in KV for API access validation
    await kv.set(`session:${token}`, userId, { ex: SESSION_DURATION / 1000 });

    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/'
    });

    return token;
  }

  static async verifySession(token: string): Promise<Session | null> {
    // Development bypass
    if (isDevAuthEnabled() && token === DEV_SESSION_TOKEN) {
      logDevAuthStatus();
      return {
        userId: DEV_USER.id,
        expiresAt: new Date(Date.now() + SESSION_DURATION)
      };
    }

    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      return {
        userId: payload.userId as string,
        expiresAt: new Date(payload.exp! * 1000)
      };
    } catch {
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    // Development bypass
    if (isDevAuthEnabled()) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('session');
      
      // Check for dev session token
      if (sessionCookie?.value === DEV_SESSION_TOKEN) {
        logDevAuthStatus();
        return DEV_USER;
      }
      
      // Auto-login in dev mode if no session
      if (!sessionCookie?.value) {
        logDevAuthStatus();
        cookieStore.set('session', DEV_SESSION_TOKEN, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: SESSION_DURATION / 1000,
          path: '/'
        });
        return DEV_USER;
      }
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) return null;

    const session = await this.verifySession(sessionCookie.value);
    if (!session) return null;

    return this.getUserById(session.userId);
  }

  static async logout(): Promise<void> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    // Remove session from KV if it exists
    if (sessionCookie?.value) {
      await kv.del(`session:${sessionCookie.value}`);
    }
    
    cookieStore.delete('session');
  }

  static async generateApiKey(userId: string): Promise<string> {
    const keyArray = crypto.getRandomValues(new Uint8Array(32));
    const keyHex = Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const apiKey = `pk_${keyHex}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashedKey = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await this.updateUser(userId, { apiKey: hashedKey });
    
    // Store the hashed key for lookup
    await kv.set(`apikey:${hashedKey}`, userId);
    
    return apiKey; // Return unhashed key only once
  }

  static async verifyApiKey(apiKey: string): Promise<User | null> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashedKey = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const userId = await kv.get<string>(`apikey:${hashedKey}`);
    
    if (!userId) return null;
    
    return this.getUserById(userId);
  }

  static async trackUsage(userId: string, type: 'api' | 'analysis'): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;

    const now = new Date();
    const resetDate = new Date(user.usage.lastReset);
    
    // Reset monthly usage if needed
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      user.usage = {
        apiCalls: 0,
        analysisCount: 0,
        lastReset: now
      };
    }

    // Increment usage
    if (type === 'api') {
      user.usage.apiCalls++;
    } else {
      user.usage.analysisCount++;
    }

    await kv.hset(`user:${userId}`, { usage: user.usage } as unknown as { [field: string]: unknown });
  }

  static async checkUsageLimits(userId: string): Promise<{ allowed: boolean; limit: number; used: number }> {
    const user = await this.getUserById(userId);
    if (!user) return { allowed: false, limit: 0, used: 0 };

    const limits = {
      free: { api: 100, analysis: 20 },
      premium: { api: 5000, analysis: 1000 },
      enterprise: { api: -1, analysis: -1 } // Unlimited
    };

    const userLimits = limits[user.tier];
    const used = user.usage.apiCalls + user.usage.analysisCount;
    const limit = userLimits.api + userLimits.analysis;

    if (user.tier === 'enterprise') {
      return { allowed: true, limit: -1, used };
    }

    return { 
      allowed: used < limit,
      limit,
      used
    };
  }

  static async verifyEmail(token: string): Promise<boolean> {
    const userId = await kv.get<string>(`verify:${token}`);
    if (!userId) return false;

    await this.updateUser(userId, { emailVerified: true });
    await kv.del(`verify:${token}`);
    
    return true;
  }

  static async requestPasswordReset(email: string): Promise<string | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    const tokenArray = crypto.getRandomValues(new Uint8Array(32));
    const resetToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
    await kv.set(`reset:${resetToken}`, user.id, { ex: 60 * 60 }); // 1 hour
    
    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const userId = await kv.get<string>(`reset:${token}`);
    if (!userId) return false;

    const hashedPassword = await this.hashPassword(newPassword);
    await kv.set(`user:password:${userId}`, hashedPassword);
    await kv.del(`reset:${token}`);
    
    return true;
  }
}

// Middleware helper
export async function requireAuth(): Promise<User> {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requirePremium(): Promise<User> {
  const user = await requireAuth();
  if (user.tier === 'free') {
    throw new Error('Premium subscription required');
  }
  return user;
}