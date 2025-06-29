import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry-stub'
import { z } from 'zod'
import { logger } from '@/lib/logger-stub'

// Error types
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

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends APIError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends APIError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends APIError {
  constructor(service: string, originalError?: any) {
    super(`External service error: ${service}`, 503, 'EXTERNAL_SERVICE_ERROR', {
      service,
      originalError: originalError?.message,
    })
    this.name = 'ExternalServiceError'
  }
}

// Error handler for API routes
export async function handleAPIError(
  error: unknown,
  request?: Request
): Promise<NextResponse> {
  // Log the error
  logger.error('API Error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: request?.url,
    method: request?.method,
  })

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      },
      { status: 400 }
    )
  }

  // Handle our custom API errors
  if (error instanceof APIError) {
    const response = {
      error: error.message,
      code: error.code,
      ...(error.details && { details: error.details }),
    }

    // Add retry-after header for rate limit errors
    const headers: HeadersInit = {}
    if (error instanceof RateLimitError && error.details?.retryAfter) {
      headers['Retry-After'] = String(error.details.retryAfter)
    }

    return NextResponse.json(response, {
      status: error.statusCode,
      headers,
    })
  }

  // Report unknown errors to Sentry
  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: {
        type: 'api_error',
      },
      extra: {
        url: request?.url,
        method: request?.method,
      },
    })
  }

  // Generic error response
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  )
}

// Async error wrapper for API routes
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      // Find request object in args
      const request = args.find(arg => arg instanceof Request) as Request | undefined
      return handleAPIError(error, request)
    }
  }
}

// Error recovery strategies
export interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoff?: 'linear' | 'exponential'
  shouldRetry?: (error: any, attempt: number) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    shouldRetry = (error) => !(error instanceof ValidationError),
  } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }

      const waitTime = backoff === 'exponential' 
        ? delay * Math.pow(2, attempt - 1)
        : delay * attempt

      logger.warn(`Retry attempt ${attempt}/${maxAttempts}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        waitTime,
      })

      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError
}

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly onStateChange?: (state: string) => void
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
        this.onStateChange?.('half-open')
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failures = 0
        this.onStateChange?.('closed')
      }
      
      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()

      if (this.failures >= this.threshold) {
        this.state = 'open'
        this.onStateChange?.('open')
      }

      throw error
    }
  }

  reset() {
    this.failures = 0
    this.state = 'closed'
    this.onStateChange?.('closed')
  }
}