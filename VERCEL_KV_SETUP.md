# Vercel KV Setup Guide

## Overview

This guide explains how to properly set up Vercel KV for the inplain.ai application in production.

## Production Setup

1. **Connect KV Store in Vercel Dashboard**
   - Go to your Vercel project dashboard
   - Navigate to the "Storage" tab
   - Click "Create Database" and select "KV"
   - Connect the KV store to your production environment

2. **Environment Variables**
   When you connect a KV store, Vercel automatically sets these environment variables:
   - `KV_URL` - The primary KV store URL
   - `KV_REST_API_URL` - The REST API endpoint
   - `KV_REST_API_TOKEN` - Authentication token
   - `KV_REST_API_READ_ONLY_TOKEN` - Optional read-only token

3. **Verify Connection**
   After deployment, check the KV connection status:
   ```
   https://your-domain.vercel.app/api/health/kv
   ```

## Troubleshooting

### "KV not configured" Error

If you see this error in production logs:

1. **Check Environment Variables**
   - In Vercel dashboard, go to Settings > Environment Variables
   - Ensure the KV variables are present and not empty
   - Variables should be automatically added when KV is connected

2. **Re-link KV Store**
   - In the Storage tab, disconnect and reconnect the KV store
   - This will regenerate the environment variables

3. **Check Edge Runtime Compatibility**
   - Our API routes use Edge runtime, which has special requirements
   - The KV wrapper (`kv-wrapper.ts`) handles this automatically

4. **Debug with Health Endpoint**
   The `/api/health/kv` endpoint provides detailed information:
   - Configuration status
   - Operational status
   - Which environment variables are detected
   - Connection latency

### Manual Environment Variable Setup

If automatic setup fails, you can manually add these variables:

1. Get credentials from Vercel KV dashboard
2. Add to Vercel environment variables:
   - `KV_REST_API_URL`: The REST endpoint URL
   - `KV_REST_API_TOKEN`: The authentication token

## Code Structure

- `/apps/web/src/app/api/lib/kv-wrapper.ts` - Main KV client wrapper
- `/apps/web/src/app/api/lib/get-kv-config.ts` - Environment variable detection
- `/apps/web/src/lib/env.ts` - Environment variable definitions

## Best Practices

1. Always use the `getKV()` function from `kv-wrapper.ts`
2. The wrapper provides automatic fallback to in-memory storage in development
3. Check `isKVConfigured()` before assuming persistence
4. Use the health endpoint to verify production setup

## Common Issues

1. **Edge Runtime Issues**
   - The default `@vercel/kv` export works best in Vercel production
   - `createClient` is used as fallback for explicit configuration

2. **Environment Variable Names**
   - Vercel may use different variable names over time
   - Our config checks multiple possible names for compatibility

3. **Token Permissions**
   - Ensure the token has read/write permissions
   - Read-only tokens will cause write operations to fail