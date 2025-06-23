import { NextResponse } from 'next/server'
import { getAppMode } from '@/lib/env'

/**
 * Public API endpoint to check application status
 * Returns the current application mode
 */
export async function GET() {
  try {
    const mode = getAppMode()
    
    return NextResponse.json({
      mode,
      isDemo: mode === 'demo',
      isProduction: mode === 'production',
      isDevelopment: mode === 'development'
    })
  } catch (error) {
    console.error('Error getting app status:', error)
    return NextResponse.json(
      { error: 'Failed to get app status' },
      { status: 500 }
    )
  }
}