# Environment Variable Utility Documentation

This document describes the new environment variable utility that provides type-safe access to environment variables with proper handling for both server and client contexts.

## Overview

The environment utility solves the following issues:
- Environment variables set in Vercel are not accessible in browser context
- Graceful fallbacks for missing environment variables
- Type-safe access to environment configuration
- Clear separation between server and client environment variables

## Core Components

### 1. Environment Configuration (`/src/lib/env.ts`)

The main utility that provides:
- Type-safe environment variable definitions
- Server/client context detection
- Graceful fallbacks with default values
- Environment status checking

### 2. Environment Provider (`/src/providers/env-provider.tsx`)

React context provider for client-side environment access:
- Provides environment configuration to all components
- Ensures consistent access patterns
- Type-safe context with proper error handling

### 3. Environment Hook (`/src/hooks/useEnv.ts`)

React hooks for accessing environment configuration:
- `useEnv()` - Access client-safe environment config
- `useEnvStatus()` - Check server environment status (for debugging)

## Usage Examples

### Server-Side Usage

```typescript
import { getEnvVar, getEnvStatus } from '@/lib/env'

// Get a single environment variable with fallback
const apiKey = getEnvVar('OPENROUTER_API_KEY', 'default-key')

// Check overall environment status
const status = getEnvStatus()
if (!status.isConfigured) {
  console.error('Missing required env vars:', status.missingRequired)
}

// Get application mode
const mode = getAppMode() // 'production' | 'demo' | 'development'
```

### Client-Side Usage

```typescript
import { useEnvironment } from '@/providers/env-provider'
// or
import { useEnv } from '@/hooks/useEnv'

function MyComponent() {
  const env = useEnvironment()
  
  if (env.isDemo) {
    return <div>Running in demo mode</div>
  }
  
  return <div>Production mode</div>
}
```

### In API Routes

```typescript
import { getEnvVar } from '@/lib/env'

export async function GET() {
  const apiKey = getEnvVar('OPENROUTER_API_KEY')
  
  if (!apiKey) {
    // Handle demo mode
    return NextResponse.json({ demo: true })
  }
  
  // Use API key for production
}
```

## Environment Variables

All environment variables are defined in `/src/lib/env.ts` with the following properties:
- `name`: Variable name
- `required`: Whether the variable is required
- `defaultValue`: Optional default value
- `description`: What the variable is used for
- `clientSafe`: Whether it's safe to expose to the client

### AI Configuration
- `OPENROUTER_API_KEY` - API key for AI services
- `DEFAULT_AI_MODEL` - Default AI model (default: anthropic/claude-3-haiku)
- `AI_CACHE_EXPIRY_HOURS` - Cache duration (default: 24)
- `AI_RATE_LIMIT_PER_MINUTE` - Rate limiting (default: 10)
- `AI_MAX_TOKENS` - Max tokens per request (default: 2000)
- `AI_TEMPERATURE` - AI temperature (default: 0.3)

### Storage Configuration
- `KV_REST_API_URL` - Vercel KV store URL
- `KV_REST_API_TOKEN` - Vercel KV authentication
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

### Other Configuration
- `CRON_SECRET` - Secret for cron job authentication
- `NEXT_PUBLIC_API_URL` - Public API URL
- `NEXT_PUBLIC_APP_URL` - Public app URL

## Application Modes

The application can run in three modes:

1. **Production**: Full features with AI and storage configured
2. **Demo**: AI features are mocked, limited storage
3. **Development**: All features available for testing

The mode is automatically determined based on:
- `NODE_ENV` environment variable
- Presence of `OPENROUTER_API_KEY`
- Other configuration variables

## Best Practices

1. **Always use the utility functions** instead of accessing `process.env` directly
2. **Define all new environment variables** in `/src/lib/env.ts`
3. **Use appropriate fallbacks** for optional variables
4. **Check `clientSafe` flag** before exposing variables to the client
5. **Handle demo mode gracefully** in your components and APIs

## Migration Guide

To migrate existing code:

1. Replace `process.env.VARIABLE_NAME` with `getEnvVar('VARIABLE_NAME')`
2. Add new variables to the `ENV_VARS` object in `/src/lib/env.ts`
3. Use `useEnvironment()` hook in React components
4. Handle demo mode appropriately in your logic

## Troubleshooting

### Variable not accessible in browser
- Ensure the variable has `clientSafe: true` in its configuration
- Use `NEXT_PUBLIC_` prefix for client-side variables

### Variable shows as undefined
- Check if the variable is defined in Vercel dashboard
- Verify the variable is added to `ENV_VARS` configuration
- Use appropriate fallback values

### Demo mode activated unexpectedly
- Verify `OPENROUTER_API_KEY` is set in production
- Check environment status using the debug endpoint