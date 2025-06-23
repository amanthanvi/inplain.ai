# Vercel Deployment Checklist for PolicyDiff

## Pre-deployment Fixes Applied

✅ **1. Fixed Configuration Conflicts**
- Removed duplicate `next.config.js` file
- Updated `next.config.mjs` for Next.js 15 compatibility
- Removed deprecated experimental options
- Fixed static asset cache headers regex patterns

✅ **2. Updated Vercel Configuration**
- Added proper build commands for monorepo structure
- Added output directory configuration
- Added security headers
- Added redirect rules for www subdomain

✅ **3. Fixed Middleware Issues**
- Removed hardcoded font preload paths causing 404s
- Kept security headers and API CORS configuration
- Fixed static asset detection logic

✅ **4. Fixed Font Loading**
- Removed Google Fonts import from CSS
- Configured Inter font using Next.js font optimization
- Added all required font weights (400, 500, 600, 700)

✅ **5. Created Helper Files**
- `.env.production` template with all required variables
- Health check endpoint at `/api/health`
- `robots.txt` for SEO

## Deployment Steps

### 1. Set Environment Variables in Vercel

Required variables (must be set in Vercel dashboard):

```bash
# OpenRouter AI (REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
DEFAULT_AI_MODEL=google/gemini-2.0-flash-exp:free

# Cron Security (REQUIRED)
CRON_SECRET=generate-a-secure-random-string

# KV Storage (AUTO-CONFIGURED)
# These are set automatically when you create a KV database in Vercel
```

### 2. Create KV Database

1. Go to your Vercel project dashboard
2. Navigate to "Storage" tab
3. Click "Create Database" → "KV"
4. Follow the setup wizard
5. Environment variables will be added automatically

### 3. Deploy Commands

From the root directory:

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 4. Post-deployment Verification

1. **Check Health Status**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Verify Static Assets**
   - Open browser DevTools Network tab
   - Load the homepage
   - Check that CSS/JS files load with 200 status
   - Verify fonts are loading correctly

3. **Test API Endpoints**
   ```bash
   # Test feed endpoint
   curl https://your-app.vercel.app/api/feed
   
   # Test search
   curl https://your-app.vercel.app/api/search?q=privacy
   ```

4. **Trigger Manual Data Sync**
   ```bash
   curl -X POST https://your-app.vercel.app/api/cron/monitor \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

## Common Issues & Solutions

### Issue: 500 errors on API routes
**Solution**: Check that all environment variables are set correctly in Vercel

### Issue: KV connection errors
**Solution**: Ensure KV database is created and linked to your project

### Issue: Static assets 404
**Solution**: Clear Vercel cache and redeploy: `vercel --force`

### Issue: Fonts not loading
**Solution**: Already fixed by using Next.js font optimization

### Issue: CORS errors
**Solution**: Middleware already configured to handle CORS

## Performance Optimizations Applied

- Removed standalone output mode for better Vercel integration
- Optimized static asset caching headers
- Configured proper font loading
- Added health check endpoint for monitoring
- Removed problematic HTTP/2 push headers

## Security Headers Applied

- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (in next.config.mjs)
- Referrer-Policy: origin-when-cross-origin

## Next Steps After Deployment

1. Monitor the deployment logs in Vercel dashboard
2. Set up alerts for API errors
3. Configure custom domain if needed
4. Enable Vercel Analytics (optional)
5. Set up error tracking with Sentry (optional)