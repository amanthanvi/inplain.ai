import { logger } from '@/lib/logger-stub'
import * as Sentry from '@/lib/sentry-stub'

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
  halfOpenRequests: number
  onStateChange?: (state: CircuitBreakerState) => void
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures: number = 0
  private successes: number = 0
  private lastFailureTime: number = 0
  private halfOpenRequests: number = 0
  private monitoringStart: number = Date.now()

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      halfOpenRequests: 3,
    }
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if monitoring period has elapsed and reset counters
    if (Date.now() - this.monitoringStart > this.options.monitoringPeriod) {
      this.resetCounters()
    }

    // Check circuit state
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN)
      } else {
        logger.warn('Circuit breaker is open', {
          name: this.name,
          lastFailure: new Date(this.lastFailureTime).toISOString(),
        })
        
        if (fallback) {
          return fallback()
        }
        
        throw new Error(`Circuit breaker '${this.name}' is open`)
      }
    }

    // Check half-open state limits
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.options.halfOpenRequests) {
        if (this.failures > 0) {
          this.transitionTo(CircuitBreakerState.OPEN)
          throw new Error(`Circuit breaker '${this.name}' is open`)
        } else {
          this.transitionTo(CircuitBreakerState.CLOSED)
        }
      }
      this.halfOpenRequests++
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  private onSuccess(): void {
    this.successes++

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.options.halfOpenRequests) {
        this.transitionTo(CircuitBreakerState.CLOSED)
      }
    }
  }

  private onFailure(error: unknown): void {
    this.failures++
    this.lastFailureTime = Date.now()

    logger.error('Circuit breaker operation failed', {
      name: this.name,
      state: this.state,
      failures: this.failures,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionTo(CircuitBreakerState.OPEN)
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failures >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitBreakerState.OPEN)
    }

    // Report to Sentry
    Sentry.captureException(error, {
      tags: {
        circuit_breaker: this.name,
        circuit_state: this.state,
      },
      extra: {
        failures: this.failures,
        threshold: this.options.failureThreshold,
      },
    })
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state
    this.state = newState

    if (newState === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenRequests = 0
      this.failures = 0
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.resetCounters()
    }

    logger.info('Circuit breaker state changed', {
      name: this.name,
      from: oldState,
      to: newState,
    })

    this.options.onStateChange?.(newState)
  }

  private resetCounters(): void {
    this.failures = 0
    this.successes = 0
    this.halfOpenRequests = 0
    this.monitoringStart = Date.now()
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getStats(): {
    state: CircuitBreakerState
    failures: number
    successes: number
    lastFailureTime: number | null
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime || null,
    }
  }

  reset(): void {
    this.transitionTo(CircuitBreakerState.CLOSED)
    this.resetCounters()
    this.lastFailureTime = 0
  }
}

// Circuit breaker registry
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()

  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options))
    }
    return this.breakers.get(name)!
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  reset(name: string): void {
    this.breakers.get(name)?.reset()
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset())
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats()
    })
    return stats
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// Decorator for circuit breaker protection
export function WithCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    const circuitBreaker = circuitBreakerRegistry.get(
      `${name}.${propertyName}`,
      options
    )

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(() => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  openrouter: circuitBreakerRegistry.get('openrouter', {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    monitoringPeriod: 60000,
    halfOpenRequests: 2,
  }),
  
  database: circuitBreakerRegistry.get('database', {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 60000,
    halfOpenRequests: 3,
  }),
  
  redis: circuitBreakerRegistry.get('redis', {
    failureThreshold: 10,
    resetTimeout: 30000,
    monitoringPeriod: 60000,
    halfOpenRequests: 5,
  }),
  
  externalAPI: circuitBreakerRegistry.get('external-api', {
    failureThreshold: 5,
    resetTimeout: 120000, // 2 minutes
    monitoringPeriod: 300000, // 5 minutes
    halfOpenRequests: 3,
  }),
}