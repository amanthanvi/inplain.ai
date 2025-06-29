/**
 * Error Recovery and Resilience for AI Services
 * 
 * This module provides:
 * - Circuit breakers for failing services
 * - Exponential backoff with jitter
 * - Request queuing and rate limiting
 * - Graceful degradation strategies
 * - Error telemetry and monitoring
 */

import { z } from 'zod'

// Error types
export const AIErrorType = z.enum([
  'rate_limit',
  'insufficient_credits',
  'invalid_api_key',
  'model_unavailable',
  'content_policy',
  'timeout',
  'network_error',
  'invalid_request',
  'server_error',
  'unknown'
])

export type AIErrorType = z.infer<typeof AIErrorType>

export const AIError = z.object({
  type: AIErrorType,
  message: z.string(),
  modelId: z.string().optional(),
  statusCode: z.number().optional(),
  retryable: z.boolean(),
  retryAfter: z.number().optional(), // seconds
  details: z.any().optional()
})

export type AIError = z.infer<typeof AIError>

// Circuit breaker states
export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number // milliseconds
  halfOpenRequests: number
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failures = 0
  private lastFailureTime = 0
  private successCount = 0
  
  constructor(
    private modelId: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 3
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'half-open'
        this.successCount = 0
      } else {
        throw new Error(`Circuit breaker is open for ${this.modelId}`)
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = 'closed'
      }
    }
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): CircuitState {
    return this.state
  }

  reset() {
    this.state = 'closed'
    this.failures = 0
    this.successCount = 0
  }
}

// Request queue for rate limiting
export class RequestQueue {
  private queue: Array<{
    id: string
    fn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    priority: number
    timestamp: number
  }> = []
  
  private processing = false
  private requestCounts = new Map<string, { count: number; resetAt: number }>()
  
  constructor(
    private maxConcurrent = 3,
    private maxPerMinute = 60
  ) {}

  async add<T>(
    modelId: string,
    fn: () => Promise<T>,
    priority = 0
  ): Promise<T> {
    const id = `${modelId}-${Date.now()}-${Math.random()}`
    
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        fn,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      })
      
      // Sort by priority (higher first) then timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.timestamp - b.timestamp
      })
      
      this.process()
    })
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    const concurrent: Promise<void>[] = []

    while (this.queue.length > 0 && concurrent.length < this.maxConcurrent) {
      const item = this.queue.shift()
      if (!item) break

      const task = this.executeWithRateLimit(item)
      concurrent.push(task)
    }

    await Promise.all(concurrent)
    this.processing = false

    // Continue processing if there are more items
    if (this.queue.length > 0) {
      setTimeout(() => this.process(), 100)
    }
  }

  private async executeWithRateLimit(item: any) {
    try {
      // Check rate limit
      const now = Date.now()
      const modelId = item.id.split('-')[0]
      let rateInfo = this.requestCounts.get(modelId)
      
      if (!rateInfo || now > rateInfo.resetAt) {
        rateInfo = { count: 0, resetAt: now + 60000 }
        this.requestCounts.set(modelId, rateInfo)
      }

      if (rateInfo.count >= this.maxPerMinute) {
        const waitTime = rateInfo.resetAt - now
        await new Promise(resolve => setTimeout(resolve, waitTime))
        // Reset after waiting
        rateInfo = { count: 0, resetAt: now + 60000 }
        this.requestCounts.set(modelId, rateInfo)
      }

      rateInfo.count++
      const result = await item.fn()
      item.resolve(result)
    } catch (error) {
      item.reject(error)
    }
  }

  getQueueLength(): number {
    return this.queue.length
  }

  clear() {
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      item?.reject(new Error('Queue cleared'))
    }
  }
}

// Exponential backoff with jitter
export class BackoffStrategy {
  private attempt = 0
  
  constructor(
    private baseDelay = 1000,
    private maxDelay = 30000,
    private jitterFactor = 0.3
  ) {}

  next(): number {
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.jitterFactor * Math.random()
    const delay = exponentialDelay + jitter
    
    this.attempt++
    return Math.round(delay)
  }

  reset() {
    this.attempt = 0
  }

  getAttempt(): number {
    return this.attempt
  }
}

// Error recovery coordinator
export class ErrorRecovery {
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private requestQueue = new RequestQueue()
  private errorCounts = new Map<string, number>()
  private errorLog: AIError[] = []
  
  constructor(
    private maxRetries = 3,
    private enableTelemetry = true
  ) {}

  /**
   * Execute with full error recovery
   */
  async executeWithRecovery<T>(
    modelId: string,
    fn: () => Promise<T>,
    options: {
      fallbackModels?: string[]
      priority?: number
      maxRetries?: number
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.maxRetries
    const backoff = new BackoffStrategy()
    
    // Try primary model
    let lastError: AIError | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check circuit breaker
        const breaker = this.getOrCreateCircuitBreaker(modelId)
        
        // Execute through queue and circuit breaker
        const result = await this.requestQueue.add(
          modelId,
          () => breaker.execute(fn),
          options.priority || 0
        )
        
        // Success - reset backoff
        backoff.reset()
        return result
      } catch (error) {
        lastError = this.parseError(error, modelId)
        this.logError(lastError)
        
        // Check if error is retryable
        if (!lastError.retryable) {
          throw this.createUserFriendlyError(lastError)
        }
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          const delay = lastError.retryAfter 
            ? lastError.retryAfter * 1000 
            : backoff.next()
          
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // Try fallback models
    if (options.fallbackModels && options.fallbackModels.length > 0) {
      for (const fallbackModel of options.fallbackModels) {
        try {
          const breaker = this.getOrCreateCircuitBreaker(fallbackModel)
          
          const result = await this.requestQueue.add(
            fallbackModel,
            () => breaker.execute(fn),
            options.priority || 0
          )
          
          return result
        } catch (error) {
          lastError = this.parseError(error, fallbackModel)
          this.logError(lastError)
        }
      }
    }

    // All attempts failed
    throw this.createUserFriendlyError(
      lastError || { 
        type: 'unknown', 
        message: 'All retry attempts failed',
        retryable: false,
        modelId
      }
    )
  }

  /**
   * Parse error into structured format
   */
  private parseError(error: any, modelId: string): AIError {
    const message = error?.message || error?.toString() || 'Unknown error'
    const statusCode = error?.response?.status || error?.status
    
    // Determine error type
    let type: AIErrorType = 'unknown'
    let retryable = false
    let retryAfter: number | undefined
    
    if (statusCode === 429 || message.includes('rate limit')) {
      type = 'rate_limit'
      retryable = true
      retryAfter = error?.response?.headers?.['retry-after'] 
        ? parseInt(error.response.headers['retry-after']) 
        : 60
    } else if (statusCode === 402 || message.includes('insufficient credit')) {
      type = 'insufficient_credits'
      retryable = false
    } else if (statusCode === 401 || message.includes('api key')) {
      type = 'invalid_api_key'
      retryable = false
    } else if (statusCode === 404 || message.includes('model not found')) {
      type = 'model_unavailable'
      retryable = false
    } else if (message.includes('content policy')) {
      type = 'content_policy'
      retryable = false
    } else if (message.includes('timeout')) {
      type = 'timeout'
      retryable = true
    } else if (statusCode >= 500 || message.includes('server error')) {
      type = 'server_error'
      retryable = true
    } else if (statusCode >= 400) {
      type = 'invalid_request'
      retryable = false
    } else if (message.includes('network')) {
      type = 'network_error'
      retryable = true
    }
    
    return {
      type,
      message,
      modelId,
      statusCode,
      retryable,
      retryAfter,
      details: error
    }
  }

  /**
   * Create user-friendly error message
   */
  private createUserFriendlyError(error: AIError): Error {
    const friendlyMessages: Record<AIErrorType, string> = {
      rate_limit: 'Service is temporarily busy. Please try again in a moment.',
      insufficient_credits: 'Your account has insufficient credits. Please upgrade your plan.',
      invalid_api_key: 'Authentication failed. Please check your settings.',
      model_unavailable: 'The selected AI model is currently unavailable.',
      content_policy: 'The content violates our usage policies.',
      timeout: 'Request took too long. Please try again.',
      network_error: 'Network connection issue. Please check your connection.',
      invalid_request: 'Invalid request. Please check your input.',
      server_error: 'Service temporarily unavailable. Please try again.',
      unknown: 'An unexpected error occurred. Please try again.'
    }
    
    const userMessage = friendlyMessages[error.type]
    const err = new Error(userMessage)
    ;(err as any).details = error
    return err
  }

  /**
   * Log error for telemetry
   */
  private logError(error: AIError) {
    // Update error counts
    const key = `${error.modelId}:${error.type}`
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1)
    
    // Add to error log (keep last 100)
    this.errorLog.push(error)
    if (this.errorLog.length > 100) {
      this.errorLog.shift()
    }
    
    // Send telemetry if enabled
    if (this.enableTelemetry) {
      this.sendTelemetry(error)
    }
  }

  /**
   * Send error telemetry
   */
  private async sendTelemetry(error: AIError) {
    // In production, this would send to monitoring service
    console.error('AI Error Telemetry:', {
      type: error.type,
      modelId: error.modelId,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Get or create circuit breaker for model
   */
  private getOrCreateCircuitBreaker(modelId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(modelId)
    if (!breaker) {
      breaker = new CircuitBreaker(modelId)
      this.circuitBreakers.set(modelId, breaker)
    }
    return breaker
  }

  /**
   * Get recovery statistics
   */
  getStats(): {
    circuitBreakerStates: Record<string, CircuitState>
    queueLength: number
    errorCounts: Record<string, number>
    recentErrors: AIError[]
  } {
    const circuitBreakerStates: Record<string, CircuitState> = {}
    
    this.circuitBreakers.forEach((breaker, modelId) => {
      circuitBreakerStates[modelId] = breaker.getState()
    })
    
    return {
      circuitBreakerStates,
      queueLength: this.requestQueue.getQueueLength(),
      errorCounts: Object.fromEntries(this.errorCounts),
      recentErrors: this.errorLog.slice(-10)
    }
  }

  /**
   * Reset circuit breaker for a model
   */
  resetCircuitBreaker(modelId: string) {
    const breaker = this.circuitBreakers.get(modelId)
    breaker?.reset()
  }

  /**
   * Clear all state
   */
  reset() {
    this.circuitBreakers.clear()
    this.requestQueue.clear()
    this.errorCounts.clear()
    this.errorLog = []
  }
}

// Export singleton instance
let recoveryInstance: ErrorRecovery | null = null

export function getErrorRecovery(): ErrorRecovery {
  if (!recoveryInstance) {
    recoveryInstance = new ErrorRecovery()
  }
  return recoveryInstance
}