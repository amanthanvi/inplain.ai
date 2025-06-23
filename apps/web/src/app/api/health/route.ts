import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasKVUrl: !!process.env.KV_REST_API_URL,
      hasKVToken: !!process.env.KV_REST_API_TOKEN,
      hasCronSecret: !!process.env.CRON_SECRET,
      defaultModel: process.env.DEFAULT_AI_MODEL || 'not-set'
    },
    services: {
      kv: false,
      ai: false
    }
  };

  // Test KV connection
  try {
    await kv.ping();
    health.services.kv = true;
  } catch (error) {
    console.error('KV connection failed:', error);
  }

  // Test AI service configuration
  health.services.ai = !!process.env.OPENROUTER_API_KEY;

  const statusCode = health.services.kv && health.services.ai ? 200 : 503;
  
  return NextResponse.json(health, { status: statusCode });
}