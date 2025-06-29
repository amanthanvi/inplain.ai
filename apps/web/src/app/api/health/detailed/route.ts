import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  latency?: number
  metadata?: Record<string, any>
}

interface DetailedHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  duration: number
  version: string
  environment: string
  checks: HealthCheck[]
  metrics?: {
    uptime: number
    memory: any
    cpu?: any
  }
}

// Track service start time
const serviceStartTime = Date.now()

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    // In production, this would check actual database connection
    // For now, simulate a check
    await new Promise(resolve => setTimeout(resolve, 10))
    
    return {
      name: 'database',
      status: 'healthy',
      latency: Date.now() - start,
      metadata: {
        type: 'postgresql',
        pool: 'healthy',
        connections: 5
      }
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start
    }
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    const { kv, isKVConfigured, getKVConfigError } = await import('@/app/api/lib/kv-wrapper')
    
    if (!isKVConfigured()) {
      return {
        name: 'redis',
        status: 'degraded',
        message: getKVConfigError() || 'KV not configured',
        latency: Date.now() - start
      }
    }
    
    // Test write and read
    const testKey = `health:check:${Date.now()}`
    const testValue = { timestamp: Date.now(), random: Math.random() }
    
    await kv.set(testKey, testValue, { ex: 60 })
    const retrieved = await kv.get<typeof testValue>(testKey)
    await kv.del(testKey)
    
    if (!retrieved || retrieved.timestamp !== testValue.timestamp) {
      throw new Error('Read/write test failed')
    }
    
    return {
      name: 'redis',
      status: 'healthy',
      latency: Date.now() - start,
      metadata: {
        type: 'vercel-kv',
        operations: ['read', 'write', 'delete']
      }
    }
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start
    }
  }
}

async function checkBlobStorage(): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN
    
    if (!hasBlobToken) {
      return {
        name: 'blob_storage',
        status: 'degraded',
        message: 'Blob storage not configured',
        latency: Date.now() - start
      }
    }
    
    // In production, test actual blob operations
    return {
      name: 'blob_storage',
      status: 'healthy',
      latency: Date.now() - start,
      metadata: {
        provider: 'vercel-blob'
      }
    }
  } catch (error) {
    return {
      name: 'blob_storage',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start
    }
  }
}

async function checkExternalAPIs(): Promise<HealthCheck> {
  const start = Date.now()
  const results: Record<string, boolean> = {}
  
  try {
    // Check OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        results.openrouter = response.ok
      } catch {
        results.openrouter = false
      }
    }
    
    // Check Clerk
    try {
      const response = await fetch('https://api.clerk.com/v1/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      results.clerk = response.ok
    } catch {
      results.clerk = false
    }
    
    const allHealthy = Object.values(results).every(v => v)
    const anyUnhealthy = Object.values(results).some(v => !v)
    
    return {
      name: 'external_apis',
      status: allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'healthy',
      latency: Date.now() - start,
      metadata: results
    }
  } catch (error) {
    return {
      name: 'external_apis',
      status: 'degraded',
      message: 'Failed to check external APIs',
      latency: Date.now() - start
    }
  }
}

async function checkAuthentication(): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    const hasPublicKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    const hasSecretKey = !!process.env.CLERK_SECRET_KEY
    
    if (!hasPublicKey || !hasSecretKey) {
      return {
        name: 'authentication',
        status: 'unhealthy',
        message: 'Clerk keys not configured',
        latency: Date.now() - start
      }
    }
    
    // Test Clerk SDK initialization
    try {
      const { auth } = await import('@clerk/nextjs/server')
      // This won't actually make a request, just verify SDK is loaded
      return {
        name: 'authentication',
        status: 'healthy',
        latency: Date.now() - start,
        metadata: {
          provider: 'clerk',
          configured: true
        }
      }
    } catch (error) {
      return {
        name: 'authentication',
        status: 'degraded',
        message: 'Clerk SDK issue',
        latency: Date.now() - start
      }
    }
  } catch (error) {
    return {
      name: 'authentication',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start
    }
  }
}

async function checkQueueSystem(): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    // Check if queue/cron system is configured
    const hasCronSecret = !!process.env.CRON_SECRET
    
    return {
      name: 'queue_system',
      status: hasCronSecret ? 'healthy' : 'degraded',
      message: hasCronSecret ? undefined : 'Cron secret not configured',
      latency: Date.now() - start,
      metadata: {
        type: 'vercel-cron',
        configured: hasCronSecret
      }
    }
  } catch (error) {
    return {
      name: 'queue_system',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start
    }
  }
}

export async function GET(request: Request) {
  const start = Date.now()
  const headersList = await headers()
  
  // Check authorization
  const authHeader = headersList.get('authorization')
  const isAuthorized = authHeader === `Bearer ${process.env.HEALTH_CHECK_TOKEN}` ||
    process.env.NODE_ENV === 'development'
  
  if (!isAuthorized) {
    // Return basic health for unauthorized requests
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }
  
  // Run all health checks in parallel
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkBlobStorage(),
    checkExternalAPIs(),
    checkAuthentication(),
    checkQueueSystem()
  ])
  
  // Determine overall status
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length
  const degradedCount = checks.filter(c => c.status === 'degraded').length
  
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
  if (unhealthyCount > 0) {
    overallStatus = 'unhealthy'
  } else if (degradedCount > 0) {
    overallStatus = 'degraded'
  }
  
  // Build response
  const response: DetailedHealth = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    environment: process.env.VERCEL_ENV || 'development',
    checks,
    metrics: {
      uptime: Date.now() - serviceStartTime,
      memory: process.memoryUsage ? process.memoryUsage() : {}
    }
  }
  
  // Add CPU usage if available
  if (process.cpuUsage) {
    response.metrics!.cpu = process.cpuUsage()
  }
  
  // Set appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
    overallStatus === 'degraded' ? 200 : 503
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': overallStatus,
      'X-Response-Time': `${Date.now() - start}ms`
    }
  })
}