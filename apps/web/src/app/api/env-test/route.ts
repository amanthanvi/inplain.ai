import { NextResponse } from 'next/server'
import { getAppMode, getEnvVar } from '@/lib/env'

/**
 * Test endpoint to verify environment variable detection
 * This helps debug issues with demo mode detection
 */
export async function GET() {
  const mode = getAppMode()
  const hasApiKey = !!getEnvVar('OPENROUTER_API_KEY')
  const nodeEnv = process.env.NODE_ENV
  
  return NextResponse.json({
    mode,
    hasApiKey,
    nodeEnv,
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || 'not set',
    // Don't expose the actual key, just show if it exists
    apiKeyLength: process.env.OPENROUTER_API_KEY?.length || 0
  })
}