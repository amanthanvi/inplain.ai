import { NextRequest, NextResponse } from 'next/server'

// Debug endpoint to check environment configuration
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  // Only allow in development or with correct secret
  if (process.env.NODE_ENV !== 'development' && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check which environment variables are configured
  const envStatus = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    
    // AI Configuration
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    OPENROUTER_API_KEY_LENGTH: process.env.OPENROUTER_API_KEY?.length || 0,
    DEFAULT_AI_MODEL: process.env.DEFAULT_AI_MODEL || 'not set',
    
    // Storage Configuration
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    
    // Cron Configuration
    CRON_SECRET: !!process.env.CRON_SECRET,
    
    // Additional AI Settings
    AI_CACHE_EXPIRY_HOURS: process.env.AI_CACHE_EXPIRY_HOURS || 'not set',
    AI_RATE_LIMIT_PER_MINUTE: process.env.AI_RATE_LIMIT_PER_MINUTE || 'not set',
    AI_MAX_TOKENS: process.env.AI_MAX_TOKENS || 'not set',
    AI_TEMPERATURE: process.env.AI_TEMPERATURE || 'not set',
    
    // Public URLs
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'not set',
    VERCEL_URL: process.env.VERCEL_URL || 'not set',
  }
  
  // Test KV connection if configured
  let kvStatus = 'not configured'
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv')
      await kv.ping()
      kvStatus = 'connected'
    } catch (error) {
      kvStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`
    }
  }
  
  return NextResponse.json({
    envStatus,
    kvStatus,
    timestamp: new Date().toISOString()
  })
}