import { NextResponse } from 'next/server';
import { kv, isKVConfigured, getKVConfigError } from '../lib/kv-wrapper';
import { getEnvStatus, getAppMode, getSafeEnvInfo } from '@/lib/env';
import { isDevAuthEnabled } from '@/lib/dev-auth';

export async function GET() {
  const envStatus = getEnvStatus();
  const appMode = getAppMode();
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: appMode,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      appMode,
      devAuthEnabled: isDevAuthEnabled(),
      configured: envStatus.isConfigured,
      missingRequired: envStatus.missingRequired,
      missingOptional: envStatus.missingOptional,
      warnings: envStatus.warnings
    },
    services: {
      kv: {
        configured: isKVConfigured(),
        healthy: false,
        error: getKVConfigError()
      },
      ai: {
        configured: !!process.env.OPENROUTER_API_KEY,
        model: process.env.DEFAULT_AI_MODEL || 'google/gemini-2.5-flash-preview-05-20'
      },
      storage: {
        blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN
      }
    }
  };

  // Test KV connection if configured
  if (isKVConfigured()) {
    try {
      // Test basic operation
      await kv.set('health:check', Date.now(), { ex: 60 });
      const value = await kv.get('health:check');
      health.services.kv.healthy = !!value;
    } catch (error) {
      console.error('KV health check failed:', error);
      health.services.kv.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Determine overall health status
  const isHealthy = appMode === 'development' || 
    (health.services.kv.healthy && health.services.ai.configured) ||
    appMode === 'demo';
  
  health.status = isHealthy ? 'ok' : 'degraded';
  const statusCode = isHealthy ? 200 : 503;
  
  // Add safe environment info in development
  if (process.env.NODE_ENV === 'development') {
    health.environment = {
      ...health.environment,
      ...getSafeEnvInfo()
    };
  }
  
  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store',
      'X-App-Mode': appMode,
      'X-Dev-Auth': isDevAuthEnabled() ? 'enabled' : 'disabled'
    }
  });
}