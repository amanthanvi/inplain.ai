/**
 * Robust Retry Utility with Exponential Backoff
 * 
 * Provides resilient retry logic for external calls, API requests,
 * and other operations that may fail transiently.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number
  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxDelay?: number
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number
  /** Add random jitter to prevent thundering herd (default: true) */
  enableJitter?: boolean
  /** Custom function to determine if error is retryable (default: all errors retryable) */
  isRetryable?: (error: any) => boolean
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: any, delay: number) => void
  /** Timeout for individual attempts in milliseconds */
  attemptTimeout?: number
}

export interface RetryResult<T> {
  /** The successful result */
  result: T
  /** Number of attempts made */
  attempts: number
  /** Total time taken in milliseconds */
  totalTime: number
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: any,
    public readonly allErrors: any[]
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

export class RetryUtils {
  /**
   * Execute a function with retry logic and exponential backoff
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      enableJitter = true,
      isRetryable = () => true,
      onRetry,
      attemptTimeout
    } = options

    const startTime = Date.now()
    const errors: any[] = []
    let lastError: any

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let result: T

        if (attemptTimeout) {
          // Add timeout to individual attempts
          result = await this.withTimeout(fn, attemptTimeout)
        } else {
          result = await fn()
        }

        return {
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        }
      } catch (error) {
        lastError = error
        errors.push(error)

        // Don't retry if we've reached max attempts or error is not retryable
        if (attempt === maxAttempts || !isRetryable(error)) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(
          attempt,
          initialDelay,
          maxDelay,
          backoffMultiplier,
          enableJitter
        )

        onRetry?.(attempt, error, delay)

        // Wait before retrying
        await this.sleep(delay)
      }
    }

    // All attempts failed
    throw new RetryError(
      `Operation failed after ${maxAttempts} attempts. Last error: ${lastError?.message || 'Unknown error'}`,
      maxAttempts,
      lastError,
      errors
    )
  }

  /**
   * Retry specifically for HTTP requests
   */
  static async retryFetch(
    url: string,
    init?: RequestInit,
    options: RetryOptions = {}
  ): Promise<RetryResult<Response>> {
    const isRetryableError = (error: any) => {
      // Retry on network errors, timeouts, and 5xx status codes
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return true // Network error
      }
      if (error.name === 'AbortError') {
        return true // Timeout
      }
      if (error.status >= 500) {
        return true // Server error
      }
      if (error.status === 429) {
        return true // Rate limited
      }
      return false
    }

    return this.withRetry(
      async () => {
        const response = await fetch(url, init)
        
        // Throw error for non-successful status codes
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
          ;(error as any).status = response.status
          ;(error as any).response = response
          throw error
        }

        return response
      },
      {
        isRetryable: isRetryableError,
        ...options
      }
    )
  }

  /**
   * Retry for AI service calls with specific error handling
   */
  static async retryAICall<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const isRetryableError = (error: any) => {
      const message = error.message?.toLowerCase() || ''
      
      // Don't retry on authentication errors
      if (message.includes('unauthorized') || message.includes('api key')) {
        return false
      }
      
      // Don't retry on content policy violations
      if (message.includes('content policy') || message.includes('safety')) {
        return false
      }

      // Don't retry on quota exceeded (permanent)
      if (message.includes('quota exceeded') || message.includes('billing')) {
        return false
      }

      // Retry on rate limits, temporary errors, network issues
      if (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('temporary') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      ) {
        return true
      }

      // Default to retry for unknown errors
      return true
    }

    return this.withRetry(fn, {
      maxAttempts: 3,
      initialDelay: 2000, // Longer delay for AI services
      maxDelay: 60000,
      isRetryable: isRetryableError,
      onRetry: (attempt, error, delay) => {
        console.warn(`AI call attempt ${attempt} failed, retrying in ${delay}ms:`, error.message)
      },
      ...options
    })
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number,
    enableJitter: boolean
  ): number {
    // Calculate exponential backoff delay
    let delay = initialDelay * Math.pow(multiplier, attempt - 1)
    
    // Cap at maximum delay
    delay = Math.min(delay, maxDelay)
    
    // Add jitter to prevent thundering herd
    if (enableJitter) {
      // Add random jitter of ±25%
      const jitter = delay * 0.25 * (Math.random() * 2 - 1)
      delay = Math.max(0, delay + jitter)
    }
    
    return Math.round(delay)
  }

  /**
   * Add timeout to a promise
   */
  private static async withTimeout<T>(
    promise: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | number | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`)
        error.name = 'TimeoutError'
        reject(error)
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([promise(), timeoutPromise])
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      return result
    } catch (error) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      throw error
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Batch retry multiple operations with concurrency control
   */
  static async retryBatch<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions & { concurrency?: number } = {}
  ): Promise<Array<RetryResult<T> | RetryError>> {
    const { concurrency = 5, ...retryOptions } = options
    const results: Array<RetryResult<T> | RetryError> = []

    // Process operations in batches to control concurrency
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency)
      
      const batchPromises = batch.map(async (operation) => {
        try {
          return await this.withRetry(operation, retryOptions)
        } catch (error) {
          return error instanceof RetryError ? error : new RetryError(
            error instanceof Error ? error.message : 'Unknown error',
            retryOptions.maxAttempts || 3,
            error,
            [error]
          )
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }
}

// Convenience exports for common patterns
export const retryFetch = RetryUtils.retryFetch.bind(RetryUtils)
export const retryAI = RetryUtils.retryAICall.bind(RetryUtils)
export const withRetry = RetryUtils.withRetry.bind(RetryUtils)