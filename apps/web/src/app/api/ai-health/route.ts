import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedAIService } from '../../../lib/ai/unified-ai-service'
import { getErrorRecovery } from '../../../lib/ai/error-recovery'
import { ModelSelector } from '../../../lib/ai/model-selector'

export async function GET(request: NextRequest) {
  try {
    const aiService = getUnifiedAIService()
    const errorRecovery = getErrorRecovery()
    
    // Get service health
    const health = await aiService.getHealthStatus()
    
    // Get error recovery stats
    const recoveryStats = errorRecovery.getStats()
    
    // Get usage statistics
    const usageStats = ModelSelector.getUsageStats()
    
    // Combine all health information
    const healthReport = {
      status: health.status,
      timestamp: new Date().toISOString(),
      services: {
        ai: {
          status: health.status,
          models: health.models,
          cache: health.cache
        },
        errorRecovery: {
          circuitBreakers: recoveryStats.circuitBreakerStates,
          queueLength: recoveryStats.queueLength,
          recentErrors: recoveryStats.recentErrors.length,
          errorCounts: recoveryStats.errorCounts
        }
      },
      usage: {
        modelUsage: usageStats.modelUsage,
        taskDistribution: usageStats.taskDistribution,
        averageCost: usageStats.averageCost
      },
      recommendations: [
        ...usageStats.recommendations,
        ...(health.status === 'degraded' ? ['Some AI models are unavailable'] : []),
        ...(recoveryStats.queueLength > 10 ? ['High request queue, consider scaling'] : []),
        ...(Object.values(recoveryStats.circuitBreakerStates).includes('open') ? ['Some models have open circuit breakers'] : [])
      ]
    }
    
    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503
    
    return NextResponse.json(healthReport, { status: statusCode })
    
  } catch (error) {
    console.error('AI health check error:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 503 })
  }
}

// Support HEAD requests for uptime monitoring
export async function HEAD(request: NextRequest) {
  try {
    const aiService = getUnifiedAIService()
    const health = await aiService.getHealthStatus()
    
    const statusCode = health.status === 'healthy' ? 200 : 503
    return new NextResponse(null, { status: statusCode })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}