export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export interface ErrorResponse {
  error: string
  code?: string
  details?: any
  timestamp: string
  requestId?: string
}

export function createErrorResponse(error: any): ErrorResponse {
  const timestamp = new Date().toISOString()
  const requestId = Math.random().toString(36).substring(7)

  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp,
      requestId
    }
  }

  // Handle API response errors
  if (error.response) {
    const status = error.response.status
    const data = error.response.data

    return {
      error: data?.error || getDefaultErrorMessage(status),
      code: data?.code || `HTTP_${status}`,
      details: data?.details,
      timestamp,
      requestId
    }
  }

  // Handle network errors
  if (error.request) {
    return {
      error: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      timestamp,
      requestId
    }
  }

  // Default error
  return {
    error: error.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    timestamp,
    requestId
  }
}

function getDefaultErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication required. Please log in.',
    403: 'You don\'t have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'There was a conflict with your request.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. We\'re working to fix this.',
    502: 'Server is temporarily unavailable.',
    503: 'Service is currently unavailable.',
  }

  return messages[status] || `An error occurred (${status})`
}

export function isRetryableError(error: any): boolean {
  if (error.response) {
    const status = error.response.status
    return status >= 500 || status === 429
  }
  return error.code === 'NETWORK_ERROR'
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (!isRetryableError(error) || i === maxRetries - 1) {
        throw error
      }

      const delay = initialDelay * Math.pow(2, i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Error messages for user-facing display
export const ErrorMessages = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Unable to connect. Please check your internet connection.',
  AUTH_REQUIRED: 'Please log in to continue.',
  PERMISSION_DENIED: 'You don\'t have permission to access this.',
  NOT_FOUND: 'The requested item could not be found.',
  VALIDATION: 'Please check your input and try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
  SERVER_ERROR: 'Server error. Our team has been notified.',
  AI_ANALYSIS_FAILED: 'AI analysis failed. Please try again or select a different model.',
  POLICY_FETCH_FAILED: 'Failed to fetch policy. The website might be unavailable.',
  DIFF_GENERATION_FAILED: 'Failed to generate diff. Please try again later.',
  EXPORT_FAILED: 'Failed to export data. Please try again.',
  WEBHOOK_FAILED: 'Failed to send webhook notification.',
  PAYMENT_FAILED: 'Payment processing failed. Please try again.',
} as const

// Error recovery suggestions
export function getErrorRecoverySuggestion(error: any): string {
  const code = error.code || error.response?.status

  const suggestions: Record<string | number, string> = {
    'NETWORK_ERROR': 'Check your internet connection and try again.',
    401: 'Please log in to continue.',
    403: 'Contact support if you believe you should have access.',
    404: 'Double-check the URL or navigate back to the homepage.',
    429: 'Wait a few minutes before trying again.',
    500: 'Try again in a few moments. If the problem persists, contact support.',
    'AI_RATE_LIMIT': 'You\'ve reached your AI analysis limit. Upgrade your plan for more.',
    'INVALID_API_KEY': 'Check your API key configuration.',
    'SUBSCRIPTION_EXPIRED': 'Renew your subscription to continue using premium features.',
  }

  return suggestions[code] || 'If this problem continues, please contact support.'
}