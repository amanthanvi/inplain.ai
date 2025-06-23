import { NextRequest, NextResponse } from 'next/server'
import { getEnvStatus, getSafeEnvInfo, getEnvVar } from '@/lib/env'

// Debug endpoint to check environment configuration
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  // Only allow in development or with correct secret
  if (process.env.NODE_ENV !== 'development' && secret !== getEnvVar('CRON_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Get comprehensive environment status
  const status = getEnvStatus()
  const safeInfo = getSafeEnvInfo()
  
  // Legacy format for backward compatibility
  const envStatus = {
    ...safeInfo,
    // Add specific flags for the AppStatus component
    OPENROUTER_API_KEY: !!getEnvVar('OPENROUTER_API_KEY'),
    KV_REST_API_URL: !!getEnvVar('KV_REST_API_URL'),
    KV_REST_API_TOKEN: !!getEnvVar('KV_REST_API_TOKEN'),
  }
  
  // Test KV connection if configured
  let kvStatus = 'not configured'
  if (getEnvVar('KV_REST_API_URL') && getEnvVar('KV_REST_API_TOKEN')) {
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
    environmentStatus: status,
    timestamp: new Date().toISOString()
  })
}