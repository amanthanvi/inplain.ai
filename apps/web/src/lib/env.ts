/**
 * Environment variable utility for handling server and client-side env vars
 * Provides type-safe access and graceful fallbacks
 */

type EnvVarConfig = {
  name: string
  required: boolean
  defaultValue?: string
  description: string
  clientSafe?: boolean
}

// Define all environment variables used in the application
const ENV_VARS: Record<string, EnvVarConfig> = {
  // AI Configuration
  OPENROUTER_API_KEY: {
    name: 'OPENROUTER_API_KEY',
    required: false,
    description: 'OpenRouter API key for AI services',
    clientSafe: false
  },
  DEFAULT_AI_MODEL: {
    name: 'DEFAULT_AI_MODEL',
    required: false,
    defaultValue: 'anthropic/claude-3-haiku',
    description: 'Default AI model to use',
    clientSafe: false
  },
  AI_CACHE_EXPIRY_HOURS: {
    name: 'AI_CACHE_EXPIRY_HOURS',
    required: false,
    defaultValue: '24',
    description: 'Hours to cache AI responses',
    clientSafe: false
  },
  AI_RATE_LIMIT_PER_MINUTE: {
    name: 'AI_RATE_LIMIT_PER_MINUTE',
    required: false,
    defaultValue: '10',
    description: 'Maximum AI requests per minute',
    clientSafe: false
  },
  AI_MAX_TOKENS: {
    name: 'AI_MAX_TOKENS',
    required: false,
    defaultValue: '2000',
    description: 'Maximum tokens per AI request',
    clientSafe: false
  },
  AI_TEMPERATURE: {
    name: 'AI_TEMPERATURE',
    required: false,
    defaultValue: '0.3',
    description: 'AI temperature setting',
    clientSafe: false
  },
  
  // Storage Configuration
  KV_URL: {
    name: 'KV_URL',
    required: false,
    description: 'Vercel KV store URL (primary)',
    clientSafe: false
  },
  KV_REST_API_URL: {
    name: 'KV_REST_API_URL',
    required: false,
    description: 'Vercel KV store REST API URL',
    clientSafe: false
  },
  KV_REST_API_TOKEN: {
    name: 'KV_REST_API_TOKEN',
    required: false,
    description: 'Vercel KV store authentication token',
    clientSafe: false
  },
  KV_REST_API_READ_ONLY_TOKEN: {
    name: 'KV_REST_API_READ_ONLY_TOKEN',
    required: false,
    description: 'Vercel KV store read-only token',
    clientSafe: false
  },
  BLOB_READ_WRITE_TOKEN: {
    name: 'BLOB_READ_WRITE_TOKEN',
    required: false,
    description: 'Vercel Blob storage token',
    clientSafe: false
  },
  
  // Cron Configuration
  CRON_SECRET: {
    name: 'CRON_SECRET',
    required: false,
    description: 'Secret for authenticating cron jobs',
    clientSafe: false
  },
  
  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
    name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    required: true,
    description: 'Clerk publishable key for authentication',
    clientSafe: true
  },
  CLERK_SECRET_KEY: {
    name: 'CLERK_SECRET_KEY',
    required: true,
    description: 'Clerk secret key for server-side authentication',
    clientSafe: false
  },
  
  // Public Environment Variables
  NEXT_PUBLIC_API_URL: {
    name: 'NEXT_PUBLIC_API_URL',
    required: false,
    description: 'Public API URL',
    clientSafe: true
  },
  NEXT_PUBLIC_APP_URL: {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Public app URL',
    clientSafe: true
  },
  
  // Deployment Environment
  NODE_ENV: {
    name: 'NODE_ENV',
    required: true,
    defaultValue: 'development',
    description: 'Node environment',
    clientSafe: true
  },
  VERCEL: {
    name: 'VERCEL',
    required: false,
    description: 'Running on Vercel',
    clientSafe: true
  },
  VERCEL_ENV: {
    name: 'VERCEL_ENV',
    required: false,
    description: 'Vercel environment',
    clientSafe: true
  },
  VERCEL_URL: {
    name: 'VERCEL_URL',
    required: false,
    description: 'Vercel deployment URL',
    clientSafe: true
  }
}

export type EnvStatus = {
  isConfigured: boolean
  missingRequired: string[]
  missingOptional: string[]
  warnings: string[]
  mode: 'production' | 'demo' | 'development'
}

/**
 * Get environment variable value with fallback
 * @param key - Environment variable key
 * @param fallback - Optional fallback value
 * @returns Environment variable value or fallback
 */
export function getEnvVar(key: string, fallback?: string): string | undefined {
  if (typeof window !== 'undefined') {
    // Client-side: only access NEXT_PUBLIC_ variables
    if (key.startsWith('NEXT_PUBLIC_') || ENV_VARS[key]?.clientSafe) {
      return process.env[key] || fallback
    }
    return fallback
  }
  
  // Server-side: access all variables
  const config = ENV_VARS[key]
  if (!config) {
    console.warn(`Unknown environment variable: ${key}`)
    return process.env[key] || fallback
  }
  
  return process.env[key] || config.defaultValue || fallback
}

/**
 * Check if running in a browser environment
 */
export function isClientSide(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Get safe environment status for client-side usage
 * Only returns information about client-safe variables
 */
export function getClientEnvStatus(): Partial<EnvStatus> {
  return {
    mode: getAppMode(),
    isConfigured: true // Always true for client since we handle fallbacks
  }
}

/**
 * Get full environment status (server-side only)
 */
export function getEnvStatus(): EnvStatus {
  if (isClientSide()) {
    throw new Error('getEnvStatus can only be called on the server')
  }
  
  const missingRequired: string[] = []
  const missingOptional: string[] = []
  const warnings: string[] = []
  
  // Check each environment variable
  Object.entries(ENV_VARS).forEach(([key, config]) => {
    const value = process.env[key]
    
    if (!value && config.required) {
      missingRequired.push(key)
    } else if (!value && !config.required && !config.defaultValue) {
      missingOptional.push(key)
    }
  })
  
  // Determine application mode
  const mode = getAppMode()
  
  // Add mode-specific warnings
  if (mode === 'demo') {
    warnings.push('Running in demo mode - AI features are simulated')
  }
  
  // Check if any KV configuration is available
  const hasKVConfig = (process.env.KV_REST_API_URL || process.env.KV_URL) && 
                      (process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN)
  
  if (!hasKVConfig) {
    warnings.push('Storage not configured - data persistence is limited')
  }
  
  return {
    isConfigured: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    warnings,
    mode
  }
}

/**
 * Determine application mode based on environment
 */
export function getAppMode(): 'production' | 'demo' | 'development' {
  if (process.env.NODE_ENV === 'development') {
    return 'development'
  }
  
  // Check if AI is configured - access env var directly
  // This is important for Edge runtime compatibility
  const hasAI = !!process.env.OPENROUTER_API_KEY
  
  // In production without AI, run in demo mode
  if (process.env.NODE_ENV === 'production' && !hasAI) {
    return 'demo'
  }
  
  return 'production'
}

/**
 * Get public runtime config for client-side usage
 */
export function getPublicConfig() {
  // On client side, we can't determine the actual mode since OPENROUTER_API_KEY is server-only
  // The actual mode will be fetched from the API
  const defaultMode = process.env.NODE_ENV === 'development' ? 'development' : 'demo'
  
  return {
    mode: isClientSide() ? defaultMode : getAppMode(),
    apiUrl: getEnvVar('NEXT_PUBLIC_API_URL') || getEnvVar('VERCEL_URL') || '',
    appUrl: getEnvVar('NEXT_PUBLIC_APP_URL') || getEnvVar('VERCEL_URL') || '',
    isDevelopment: process.env.NODE_ENV === 'development',
    isVercel: !!getEnvVar('VERCEL')
  }
}

/**
 * Validate environment configuration on startup (server-side only)
 */
export function validateEnvConfig(): void {
  if (isClientSide()) return
  
  const status = getEnvStatus()
  
  if (!status.isConfigured) {
    console.error('Missing required environment variables:', status.missingRequired)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${status.missingRequired.join(', ')}`)
    }
  }
  
  if (status.warnings.length > 0) {
    console.warn('Environment warnings:', status.warnings)
  }
  
  if (status.missingOptional.length > 0) {
    console.info('Optional environment variables not set:', status.missingOptional)
  }
}

/**
 * Get a safe subset of environment info for logging
 */
export function getSafeEnvInfo(): Record<string, any> {
  const info: Record<string, any> = {}
  
  Object.entries(ENV_VARS).forEach(([key, config]) => {
    const value = getEnvVar(key)
    if (value) {
      // Mask sensitive values
      if (key.includes('TOKEN') || key.includes('SECRET') || key.includes('KEY')) {
        info[key] = value.substring(0, 4) + '...' + value.substring(value.length - 4)
      } else {
        info[key] = value
      }
    } else {
      info[key] = null
    }
  })
  
  return info
}

/**
 * Check if running in demo mode (no AI configured)
 */
export function isDemoMode(): boolean {
  return getAppMode() === 'demo'
}