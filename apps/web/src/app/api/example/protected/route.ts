import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/lib/middleware'

/**
 * Example of a protected API endpoint using our middleware system
 * This endpoint demonstrates rate limiting, security headers, and API key authentication
 */

// Example 1: Protected endpoint with API key authentication
export const GET = middleware.protectedAPI(async (request: NextRequest) => {
  // The middleware has already:
  // 1. Validated the API key
  // 2. Applied rate limiting
  // 3. Added security headers
  // 4. Checked request patterns for attacks

  return NextResponse.json({
    message: 'This is a protected endpoint',
    timestamp: new Date().toISOString()
  })
})

// Example 2: AI endpoint with stricter rate limiting
export const POST = middleware.aiAPI(async (request: NextRequest) => {
  const body = await request.json()
  
  // Process AI request...
  return NextResponse.json({
    message: 'AI request processed',
    input: body,
    timestamp: new Date().toISOString()
  })
})

/**
 * Alternative approach: Manual middleware composition
 */
import { composeMiddleware } from '@/lib/middleware'

export async function PUT(request: NextRequest) {
  return composeMiddleware(
    request,
    {
      rateLimit: { enabled: true, type: 'api' },
      security: { enabled: true, maxRequestSize: 524288 }, // 512KB
      apiKey: { enabled: true, requiredPermission: 'write' }
    },
    async (req) => {
      // Your handler logic here
      const body = await req.json()
      
      return NextResponse.json({
        message: 'Custom middleware configuration',
        data: body
      })
    }
  )
}