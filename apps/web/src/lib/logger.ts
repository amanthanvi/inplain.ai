/**
 * Unified logging service that integrates with Sentry
 */

import { captureMessage, addBreadcrumb, captureException } from './sentry'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isServer = typeof window === 'undefined'

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString()
    const environment = this.isServer ? 'server' : 'client'
    
    // Format log entry
    const logEntry = {
      timestamp,
      level,
      message,
      environment,
      ...context
    }

    // Console output
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`, context || '')

    // Send to Sentry as breadcrumb (except errors)
    if (level !== 'error') {
      addBreadcrumb({
        message,
        level: level === 'warn' ? 'warning' : level,
        category: 'console',
        data: context
      })
    }

    // Send errors to Sentry
    if (level === 'error' && context?.error) {
      captureException(context.error, context)
    } else if (level === 'error') {
      captureMessage(message, 'error')
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context)
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    this.log('error', message, { 
      ...context, 
      error: error || new Error(message),
      stack: error?.stack 
    })
  }

  // Specialized logging methods
  api(method: string, path: string, status: number, duration: number, context?: LogContext) {
    const message = `API ${method} ${path} - ${status} (${duration}ms)`
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    
    this.log(level, message, {
      ...context,
      api: { method, path, status, duration }
    })
  }

  performance(metric: string, value: number, unit: string = 'ms', context?: LogContext) {
    this.info(`Performance: ${metric} = ${value}${unit}`, {
      ...context,
      performance: { metric, value, unit }
    })
  }

  security(event: string, context?: LogContext) {
    this.warn(`Security event: ${event}`, {
      ...context,
      security: { event }
    })
  }

  business(event: string, context?: LogContext) {
    this.info(`Business event: ${event}`, {
      ...context,
      business: { event }
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export helper functions for common patterns
export function logApiRequest(req: Request, res: Response, duration: number) {
  const url = new URL(req.url)
  logger.api(
    req.method,
    url.pathname,
    res.status,
    duration,
    {
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries())
    }
  )
}

export function logError(error: Error, context?: LogContext) {
  logger.error(error.message, error, context)
}

export function logPerformance(metric: string, value: number, unit?: string) {
  logger.performance(metric, value, unit)
}

export function logSecurityEvent(event: string, userId?: string, ip?: string) {
  logger.security(event, { userId, ip })
}

export function logBusinessEvent(event: string, data?: any) {
  logger.business(event, { data })
}