# Deployment Verification Checklist

## Pre-Deployment Requirements

### Critical Environment Variables (Add in Vercel Dashboard)
```bash
# Clerk Authentication - REQUIRED
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... # Get from clerk.com dashboard
CLERK_SECRET_KEY=sk_live_...                   # Get from clerk.com dashboard

# Ensure these match your Vercel deployment URL
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### Optional Environment Variables
```bash
# Vercel KV (for persistent storage)
KV_REST_API_URL=...    # From Vercel KV dashboard
KV_REST_API_TOKEN=...  # From Vercel KV dashboard

# AI Features
OPENROUTER_API_KEY=...             # For AI functionality
DEFAULT_AI_MODEL=anthropic/claude-3-haiku

# Other
CRON_SECRET=...            # For cron job authentication
BLOB_READ_WRITE_TOKEN=...  # For blob storage
```

## Deployment Steps

1. **Commit and Push Changes**
   ```bash
   git add .
   git commit -m "fix: complete deployment fixes for auth, CSP, KV, and fonts"
   git push origin main
   ```

2. **Vercel Deployment**
   - Go to Vercel dashboard
   - Check deployment logs for any build errors
   - Ensure all environment variables are set

## Post-Deployment Verification

### 1. Authentication Flow
- [ ] Visit https://inplain.ai
- [ ] Check browser console - no CSP errors for clerk.inplain.ai
- [ ] Click login button - should redirect to /login
- [ ] Complete sign in - should redirect to /dashboard
- [ ] Check /api/auth/session returns user data

### 2. API Health Checks
- [ ] Visit /api/debug/env-status (in development)
- [ ] Check all critical services show as configured
- [ ] Visit /api/health - should return { status: "ok" }

### 3. Core Functionality
- [ ] Homepage loads without errors
- [ ] Policy pages load correctly
- [ ] Search functionality works
- [ ] Timeline visualization displays
- [ ] Diff comparisons function

### 4. Performance
- [ ] No 404 errors for fonts or assets
- [ ] Page loads quickly (< 3s)
- [ ] No memory leaks in console

### 5. Error Handling
- [ ] KV fallback works if not configured
- [ ] AI features degrade gracefully without API key
- [ ] Proper error messages displayed to users

## Common Issues & Solutions

### Auth Still Not Working
1. Verify Clerk keys are for the correct environment (dev vs prod)
2. Check Clerk dashboard for your app domain configuration
3. Ensure https://inplain.ai is added as an allowed origin in Clerk

### KV Still Showing Errors
1. KV is optional - app works without it
2. To enable: Create KV database in Vercel dashboard
3. Copy environment variables to project settings

### CSP Violations
1. Check exact domain in browser error
2. Add to CSP in /src/lib/middleware/security.ts
3. Redeploy

## Debug Commands

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Check environment variables (locally)
vercel env pull

# Force redeploy
vercel --prod --force
```

## Success Criteria
✅ Users can sign in/sign up without errors
✅ No console errors on any page
✅ Core features (viewing policies, diffs) work
✅ API endpoints respond correctly
✅ Performance monitoring shows no critical issues