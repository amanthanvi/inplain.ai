import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    const debugInfo: any = {
      hasCookie: !!sessionCookie,
      cookieValue: sessionCookie?.value ? `${sessionCookie.value.substring(0, 10)}...` : null,
      jwtSecretConfigured: !!process.env.JWT_SECRET,
      kvConfigured: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
      environment: process.env.NODE_ENV,
    };

    if (sessionCookie?.value) {
      try {
        // Verify JWT
        const { payload } = await jwtVerify(sessionCookie.value, getJwtSecret());
        debugInfo.jwtValid = true;
        debugInfo.jwtPayload = payload;
        
        // Check if session exists in KV
        const kvUserId = await kv.get<string>(`session:${sessionCookie.value}`);
        debugInfo.sessionInKV = !!kvUserId;
        debugInfo.kvUserId = kvUserId;
        
        // Check if user exists
        if (kvUserId || payload.userId) {
          const userId = kvUserId || payload.userId;
          const user = await kv.hgetall(`user:${userId}`);
          debugInfo.userExists = !!user;
          debugInfo.userTier = user?.tier || null;
        }
      } catch (error) {
        debugInfo.jwtValid = false;
        debugInfo.jwtError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Check Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      debugInfo.authHeader = authHeader.substring(0, 20) + '...';
    }

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}