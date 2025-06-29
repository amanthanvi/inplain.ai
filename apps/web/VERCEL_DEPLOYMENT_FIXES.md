# Vercel Deployment Fixes

## Issues Fixed

### 1. CSP Blocking Clerk Authentication Scripts
**Problem**: Content Security Policy was blocking scripts from `clerk.inplain.ai`

**Solution**: Updated CSP in `/src/lib/middleware/security.ts` to include:
- `https://clerk.inplain.ai` in script-src
- `https://clerk.inplain.ai` in connect-src  
- `https://clerk.inplain.ai` in frame-src
- `https://api.clerk.com` in connect-src

### 2. KV Environment Variables Not Found
**Problem**: KV wrapper was using `getEnvVar()` which may not work correctly in Edge runtime

**Solution**: Changed to direct `process.env` access in `/src/app/api/lib/kv-wrapper.ts`:
```typescript
const kvUrl = process.env.KV_REST_API_URL
const kvToken = process.env.KV_REST_API_TOKEN
```

### 3. Auth Routes Returning 401 Errors
**Problem**: Missing Clerk environment variables causing authentication failures

**Solution**: 
- Added environment variable checking in `/src/app/api/auth/session/route.ts`
- Returns 503 status with clear error message when Clerk is not configured
- Added debug endpoint at `/api/debug/env-status` to check environment configuration

### 4. Missing Font File (inter-var.woff2)
**Problem**: Performance provider trying to preload non-existent font file

**Solution**: Removed font preloading from `/src/components/performance/PerformanceProvider.tsx` since we're using Google Fonts which handles its own optimization

## Environment Variables Required in Vercel

### Critical - Add These First:
```bash
# Clerk Authentication (REQUIRED)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Clerk Routing (Already in vercel.json but can be overridden)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### Optional - For Full Functionality:
```bash
# Vercel KV Storage
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token

# AI Features
OPENROUTER_API_KEY=your_openrouter_api_key
DEFAULT_AI_MODEL=anthropic/claude-3-haiku

# Other
CRON_SECRET=your_cron_secret
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## Deployment Steps

1. **Add Environment Variables in Vercel Dashboard**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add each variable with appropriate scope (Production, Preview, Development)
   - Mark sensitive variables like `CLERK_SECRET_KEY` as "Sensitive"

2. **Verify Configuration**:
   - After deployment, visit `/api/debug/env-status` (only works in development)
   - Check browser console for any CSP violations
   - Test authentication flow

3. **Monitor Logs**:
   - Check Vercel Functions logs for any runtime errors
   - Look for "KV not configured" warnings if storage isn't set up

## Testing Checklist

- [ ] Authentication works (can sign in/sign up)
- [ ] No CSP errors in browser console
- [ ] API routes respond correctly
- [ ] KV storage works (or falls back gracefully)
- [ ] No 404 errors for static assets

## Troubleshooting

### If authentication still fails:
1. Verify Clerk keys are correct (development vs production)
2. Check that your Clerk application domain matches your Vercel domain
3. Ensure Clerk webhook endpoints are configured if using webhooks

### If KV errors persist:
1. The app will work without KV (uses in-memory storage)
2. To enable KV, create a KV database in Vercel dashboard
3. Copy the environment variables from KV dashboard to your project

### For CSP issues:
1. Check browser console for specific blocked resources
2. Add required domains to CSP policy in security middleware
3. Test in incognito mode to avoid browser extensions interfering