/**
 * Production Configuration
 * 
 * Centralized configuration for production environment settings,
 * feature flags, and deployment configurations
 */

/**
 * Production environment configuration
 */
export const ProductionConfig = {
  // Environment
  environment: 'production' as const,
  isDevelopment: false,
  isProduction: true,
  
  // Security
  security: {
    // CSP nonce generation
    enableCSPNonce: true,
    
    // HSTS preload
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: true,
    
    // Cookie settings
    cookieSecure: true,
    cookieSameSite: 'strict' as const,
    cookieHttpOnly: true,
    
    // Session settings
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    sessionRenewThreshold: 5 * 60 * 1000, // 5 minutes before expiry
    
    // API security
    requireAPIKey: true,
    apiKeyRotationDays: 90,
    
    // Request validation
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxUploadSize: 50 * 1024 * 1024, // 50MB
    
    // IP restrictions
    enableIPWhitelist: false,
    ipWhitelist: [],
    enableIPBlacklist: true,
    
    // Attack detection thresholds
    sqlInjectionThreshold: 3,
    xssThreshold: 3,
    bruteForceThreshold: 5,
    
    // Encryption
    encryptSensitiveData: true,
    encryptionAlgorithm: 'aes-256-gcm' as const
  },
  
  // Performance
  performance: {
    // Caching
    enableCaching: true,
    defaultCacheTTL: 3600, // 1 hour
    
    // CDN
    enableCDN: true,
    cdnUrl: 'https://cdn.inplain.ai',
    
    // Compression
    enableCompression: true,
    compressionLevel: 6,
    
    // Optimization
    enableMinification: true,
    enableBundleAnalyzer: false,
    enableSourceMaps: false,
    
    // Resource hints
    enablePreconnect: true,
    enablePrefetch: true,
    enablePreload: true,
    
    // Performance budgets
    budgets: {
      bundle: 500 * 1024, // 500KB
      image: 100 * 1024, // 100KB
      font: 50 * 1024, // 50KB
      script: 200 * 1024, // 200KB
      style: 100 * 1024 // 100KB
    }
  },
  
  // Monitoring
  monitoring: {
    // Error tracking
    enableSentry: true,
    sentryDSN: process.env.SENTRY_DSN,
    sentryEnvironment: 'production',
    sentryTracesSampleRate: 0.1, // 10% of transactions
    
    // Analytics
    enableAnalytics: true,
    analyticsId: process.env.ANALYTICS_ID,
    
    // Logging
    logLevel: 'warn' as const,
    enableStructuredLogging: true,
    logRetentionDays: 30,
    
    // Metrics
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    metricsRetentionDays: 90,
    
    // Health checks
    enableHealthChecks: true,
    healthCheckInterval: 60000, // 1 minute
    
    // Alerts
    enableAlerts: true,
    alertChannels: ['email', 'slack'],
    alertThresholds: {
      errorRate: 5, // 5% error rate
      responseTime: 1000, // 1 second
      uptime: 99.5 // 99.5% uptime
    }
  },
  
  // Features
  features: {
    // AI features
    ai: {
      enabled: true,
      provider: 'openrouter' as const,
      defaultModel: 'openai/gpt-4-turbo-preview',
      maxTokens: 4096,
      temperature: 0.7,
      enableStreaming: true,
      enableCaching: true,
      cacheTTL: 3600 // 1 hour
    },
    
    // Storage
    storage: {
      provider: 'vercel-kv' as const,
      enableCompression: true,
      enableEncryption: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedFileTypes: ['pdf', 'txt', 'html', 'json'],
      retentionDays: 90
    },
    
    // Email
    email: {
      enabled: true,
      provider: 'resend' as const,
      fromAddress: 'notifications@inplain.ai',
      replyToAddress: 'support@inplain.ai',
      enableBounceHandling: true,
      enableUnsubscribe: true
    },
    
    // Payments
    payments: {
      enabled: true,
      provider: 'stripe' as const,
      currency: 'usd',
      enableTestMode: false,
      webhookEndpoint: '/api/webhooks/stripe'
    },
    
    // Search
    search: {
      enabled: true,
      provider: 'internal' as const,
      enableFuzzySearch: true,
      maxResults: 100,
      enableSuggestions: true
    },
    
    // Notifications
    notifications: {
      enabled: true,
      channels: ['email', 'in-app'],
      enablePushNotifications: false,
      batchingEnabled: true,
      batchingInterval: 300000 // 5 minutes
    }
  },
  
  // Rate limiting
  rateLimiting: {
    enabled: true,
    
    // Default limits
    defaults: {
      windowMs: 60000, // 1 minute
      max: 60
    },
    
    // Endpoint-specific limits
    endpoints: {
      '/api/auth/*': { windowMs: 900000, max: 5 }, // 15 min, 5 requests
      '/api/ai/*': { windowMs: 60000, max: 10 }, // 1 min, 10 requests
      '/api/export/*': { windowMs: 3600000, max: 10 }, // 1 hour, 10 requests
      '/api/webhooks/*': { windowMs: 60000, max: 100 } // 1 min, 100 requests
    },
    
    // Burst handling
    enableBurstHandling: true,
    burstMultiplier: 2,
    
    // Distributed rate limiting
    enableDistributed: true,
    syncInterval: 5000 // 5 seconds
  },
  
  // Deployment
  deployment: {
    // Vercel-specific
    platform: 'vercel' as const,
    region: 'iad1', // US East
    
    // Build settings
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    
    // Environment
    nodeVersion: '20.x',
    
    // Functions
    functions: {
      maxDuration: 10, // 10 seconds
      memory: 1024, // 1GB
      
      // Edge functions
      edge: {
        runtime: 'edge',
        regions: ['iad1', 'sfo1', 'lhr1']
      }
    },
    
    // Cron jobs
    crons: [
      {
        name: 'monitor-policies',
        schedule: '0 9 * * *', // Daily at 9 AM UTC
        endpoint: '/api/cron/monitor'
      },
      {
        name: 'process-notifications',
        schedule: '*/5 * * * *', // Every 5 minutes
        endpoint: '/api/cron/notifications'
      },
      {
        name: 'cleanup-old-data',
        schedule: '0 2 * * 0', // Weekly at 2 AM UTC on Sunday
        endpoint: '/api/cron/cleanup'
      }
    ],
    
    // Redirects
    redirects: [
      {
        source: '/privacy',
        destination: '/privacy-policy',
        permanent: true
      },
      {
        source: '/terms',
        destination: '/terms-of-service',
        permanent: true
      }
    ],
    
    // Headers (additional to security headers)
    headers: [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-API-Version', value: '1.0' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' }
        ]
      }
    ]
  },
  
  // SEO
  seo: {
    enableSitemap: true,
    enableRobotsTxt: true,
    defaultTitle: 'Inplain.AI - Privacy Policy Monitoring',
    defaultDescription: 'Monitor privacy policy changes with AI-powered insights',
    defaultOgImage: 'https://inplain.ai/og-image.png',
    twitterHandle: '@inplain_ai'
  },
  
  // Legal
  legal: {
    termsOfServiceUrl: '/terms-of-service',
    privacyPolicyUrl: '/privacy-policy',
    cookiePolicyUrl: '/cookie-policy',
    acceptableUsePolicyUrl: '/acceptable-use',
    dataRetentionDays: 90,
    gdprCompliant: true,
    ccpaCompliant: true
  }
} as const

/**
 * Feature flags for gradual rollout
 */
export const FeatureFlags = {
  // AI features
  enableThinkingModel: true,
  enableWebSearch: true,
  enableToolCalling: true,
  enableStreaming: true,
  
  // Storage
  enableUnifiedStorage: true,
  enableContentDeduplication: true,
  enableCompression: true,
  
  // UI/UX
  enableNewDashboard: true,
  enableDarkMode: true,
  enableMobileOptimizations: true,
  enableProgressiveWebApp: false,
  
  // Security
  enableEnhancedSecurity: true,
  enableAdaptiveRateLimiting: true,
  enableRequestSigning: false,
  
  // Performance
  enableServiceWorker: false,
  enableImageOptimization: true,
  enableLazyLoading: true,
  enablePrefetching: true,
  
  // Experimental
  enableBetaFeatures: false,
  enableA11yEnhancements: true,
  enableAdvancedAnalytics: false
} as const

/**
 * Get configuration value with environment override
 */
export function getConfig<T extends keyof typeof ProductionConfig>(
  key: T
): typeof ProductionConfig[T] {
  // Allow environment variable overrides
  const envKey = `NEXT_PUBLIC_CONFIG_${key.toUpperCase()}`
  const envValue = process.env[envKey]
  
  if (envValue !== undefined) {
    try {
      return JSON.parse(envValue)
    } catch {
      return envValue as any
    }
  }
  
  return ProductionConfig[key]
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: keyof typeof FeatureFlags): boolean {
  // Allow environment variable overrides
  const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase()}`
  const envValue = process.env[envKey]
  
  if (envValue !== undefined) {
    return envValue === 'true'
  }
  
  return FeatureFlags[flag]
}

// Export types
export type ProductionConfigType = typeof ProductionConfig
export type FeatureFlagsType = typeof FeatureFlags