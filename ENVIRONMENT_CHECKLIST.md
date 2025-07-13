# Environment Variables Checklist

## Required for Production Deployment

### Vercel (Web Application)

#### Authentication (Clerk)
- [ ] `CLERK_SECRET_KEY` - Get from Clerk dashboard
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Get from Clerk dashboard
- [ ] `NEXT_PUBLIC_CLERK_DOMAIN` - Your Clerk domain
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` - Set to `/login`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` - Set to `/onboarding`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_OUT_REDIRECT_URL` - Set to `/`

#### Database (Vercel KV)
- [ ] `KV_REST_API_URL` - Get from Vercel KV dashboard
- [ ] `KV_REST_API_TOKEN` - Get from Vercel KV dashboard
- [ ] `KV_REST_API_READ_ONLY_TOKEN` - Get from Vercel KV dashboard
- [ ] `REDIS_URL` - Get from Vercel KV dashboard
- [ ] `KV_URL` - Get from Vercel KV dashboard

#### Storage (Vercel Blob)
- [ ] `BLOB_READ_WRITE_TOKEN` - Get from Vercel Blob dashboard

#### AI Service (OpenRouter)
- [ ] `OPENROUTER_API_KEY` - Get from OpenRouter dashboard
- [ ] `DEFAULT_AI_MODEL` - Set to `google/gemini-2.5-flash-preview-05-20`

#### Security
- [ ] `CRON_SECRET` - Generate with: `openssl rand -hex 32`
- [ ] `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- [ ] `SCRAPER_API_KEY` - Generate a secure key to share with scraper
- [ ] `VERCEL_API_KEY` - Generate for internal API access

#### URLs
- [ ] `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., https://inplain.ai)
- [ ] `NEXT_PUBLIC_SCRAPER_API_URL` - Your scraper URL (e.g., https://inplain-scraper.onrender.com)

#### Feature Flags
- [ ] `NEXT_PUBLIC_DEMO_MODE` - Set to `false` for production

### Render (Scraper Service)

#### Core Configuration
- [ ] `PYTHONUNBUFFERED` - Set to `1`
- [ ] `SCRAPY_SETTINGS_MODULE` - Set to `scrapy_settings`

#### Frontend Integration
- [ ] `FRONTEND_URL` - Your production URL (e.g., https://inplain.ai)
- [ ] `WEBHOOK_URL` - Set to `https://inplain.ai/api/webhooks/scraper`
- [ ] `VERCEL_API_URL` - Your production URL
- [ ] `VERCEL_API_KEY` - Same as Vercel's VERCEL_API_KEY

#### Database
- [ ] `REDIS_URL` - Same as Vercel's REDIS_URL

#### Security
- [ ] `SCRAPER_API_KEY` - Same as Vercel's SCRAPER_API_KEY

## Environment Variable Generation Commands

```bash
# Generate CRON_SECRET
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -base64 32

# Generate SCRAPER_API_KEY
openssl rand -hex 24

# Generate VERCEL_API_KEY
openssl rand -hex 24
```

## Verification Steps

1. **Check Vercel Environment**:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Check Scraper Environment**:
   ```bash
   curl https://your-scraper.onrender.com/health
   ```

3. **Test Webhook Integration**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhooks/scraper \
     -H "Authorization: Bearer YOUR_SCRAPER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

4. **Test AI Service**:
   ```bash
   curl https://your-app.vercel.app/api/ai-health
   ```

## Common Issues

### Missing Environment Variables
- Error: "Missing required environment variable: X"
- Solution: Add the missing variable in Vercel/Render dashboard

### Invalid API Keys
- Error: "Invalid API key" or 401 errors
- Solution: Regenerate and update the API keys

### Database Connection Issues
- Error: "Failed to connect to Redis"
- Solution: Check KV_URL and REDIS_URL are correct

### AI Service Errors
- Error: "OpenRouter API error"
- Solution: Verify OPENROUTER_API_KEY and check credit balance

## Security Best Practices

1. **Never commit .env files** to version control
2. **Use different keys** for development and production
3. **Rotate keys regularly** (every 90 days)
4. **Use read-only tokens** where possible
5. **Restrict API keys** by domain/IP when supported