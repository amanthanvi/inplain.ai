import { NextResponse } from 'next/server';
import { getAppMode } from '@/lib/env';

export const runtime = 'edge';

export async function GET() {
  try {
    const mode = getAppMode();
    const hasApiKey = !!process.env.OPENROUTER_API_KEY;
    const hasRedis = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
    const hasAuth = !!process.env.JWT_SECRET;
    
    // Add debug info in development
    const debugInfo = process.env.NODE_ENV === 'development' ? {
      debug: {
        nodeEnv: process.env.NODE_ENV,
        apiKeyLength: process.env.OPENROUTER_API_KEY?.length || 0,
        apiKeyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 8) || 'none',
        kvUrlSet: !!process.env.KV_REST_API_URL,
        kvTokenSet: !!process.env.KV_REST_API_TOKEN,
        jwtSecretSet: !!process.env.JWT_SECRET
      }
    } : {};
    
    return NextResponse.json({
      mode,
      services: {
        ai: hasApiKey,
        storage: hasRedis,
        auth: hasAuth
      },
      timestamp: new Date().toISOString(),
      ...debugInfo
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Status check failed' },
      { status: 500 }
    );
  }
}