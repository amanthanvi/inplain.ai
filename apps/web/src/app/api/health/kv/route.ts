import { NextResponse } from 'next/server'
import { getKV, isKVConfigured, getKVConfigError } from '@/app/api/lib/kv-wrapper'
import { getKVConfig } from '@/app/api/lib/get-kv-config'

export const runtime = 'edge'

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Get KV configuration status
    const { kvUrl, kvToken } = getKVConfig()
    const isConfigured = isKVConfigured()
    const configError = getKVConfigError()
    
    // Try to perform a simple KV operation
    let kvOperational = false
    let kvLatency = 0
    let kvError: string | null = null
    
    if (isConfigured) {
      try {
        const kv = getKV()
        const testKey = 'health:check:' + Date.now()
        const testValue = 'ok'
        
        const kvStart = Date.now()
        await kv.set(testKey, testValue, { ex: 60 }) // Expire after 60 seconds
        const result = await kv.get(testKey)
        await kv.del(testKey)
        kvLatency = Date.now() - kvStart
        
        kvOperational = result === testValue
      } catch (error) {
        kvError = error instanceof Error ? error.message : 'Unknown KV error'
        console.error('KV health check failed:', error)
      }
    }
    
    const response = {
      status: isConfigured && kvOperational ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency: Date.now() - startTime,
      kv: {
        configured: isConfigured,
        operational: kvOperational,
        latency: kvLatency,
        error: kvError || configError,
        config: {
          hasUrl: !!kvUrl,
          hasToken: !!kvToken,
          urlPrefix: kvUrl ? kvUrl.substring(0, 20) + '...' : null,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL: !!process.env.VERCEL,
            VERCEL_ENV: process.env.VERCEL_ENV,
            // Show which env vars are actually set
            KV_URL: !!process.env.KV_URL,
            KV_REST_API_URL: !!process.env.KV_REST_API_URL,
            KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
            KV_REST_API_READ_ONLY_TOKEN: !!process.env.KV_REST_API_READ_ONLY_TOKEN
          }
        }
      }
    }
    
    return NextResponse.json(response, { 
      status: response.status === 'healthy' ? 200 : 503 
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}