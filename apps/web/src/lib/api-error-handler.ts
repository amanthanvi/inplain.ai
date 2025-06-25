import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export function handleAPIError(error: unknown): NextResponse {
  console.error('API Error:', error)

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      },
      { status: 400 }
    )
  }

  // Custom API errors
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details
      },
      { status: error.statusCode }
    )
  }

  // Clerk auth errors
  if (error instanceof Error && error.message.includes('Unauthorized')) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      },
      { status: 401 }
    )
  }

  // Network/fetch errors
  if (error instanceof Error && (
    error.message.includes('fetch failed') ||
    error.message.includes('ECONNREFUSED')
  )) {
    return NextResponse.json(
      {
        error: 'External service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        details: 'Please try again later'
      },
      { status: 503 }
    )
  }

  // Rate limiting
  if (error instanceof Error && error.message.includes('rate limit')) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        details: 'Please wait before making more requests'
      },
      { 
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      }
    )
  }

  // Default error
  const message = error instanceof Error ? error.message : 'Internal server error'
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return NextResponse.json(
    {
      error: isDevelopment ? message : 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && error instanceof Error && {
        stack: error.stack
      })
    },
    { status: 500 }
  )
}

// Wrapper for API routes with error handling
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleAPIError(error)
    }
  }) as T
}

// Middleware for logging and monitoring
export async function withAPIMonitoring(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now()
  const method = request.method
  const url = request.url
  
  try {
    const response = await handler()
    const duration = Date.now() - start
    
    // Log successful requests
    console.log(`[API] ${method} ${url} - ${response.status} (${duration}ms)`)
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${duration}ms`)
    
    return response
  } catch (error) {
    const duration = Date.now() - start
    
    // Log errors
    console.error(`[API] ${method} ${url} - ERROR (${duration}ms)`, error)
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, DataDog, etc.
    }
    
    throw error
  }
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(identifier)
  
  if (!userLimit || userLimit.resetAt < now) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    })
    return true
  }
  
  if (userLimit.count >= limit) {
    return false
  }
  
  userLimit.count++
  return true
}

// Validation helpers
export function validateRequired<T>(
  value: T | undefined | null,
  fieldName: string
): T {
  if (value === undefined || value === null || value === '') {
    throw new APIError(`${fieldName} is required`, 400, 'MISSING_FIELD')
  }
  return value
}

export function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  fieldName: string
): T {
  if (!validValues.includes(value as T)) {
    throw new APIError(
      `Invalid ${fieldName}. Must be one of: ${validValues.join(', ')}`,
      400,
      'INVALID_ENUM',
      { field: fieldName, validValues }
    )
  }
  return value as T
}