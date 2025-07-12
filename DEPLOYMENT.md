# Inplain.AI Deployment Guide

## Overview

Inplain.AI consists of two main components:
1. **Web Application** - Next.js app deployed on Vercel
2. **Scraper Service** - Python Scrapy app deployed on Render

## Environment Variables Configuration

### Vercel (Web Application)

The following environment variables need to be set in Vercel:

```env
# Authentication
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_CLERK_DOMAIN=clerk.inplain.ai
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_OUT_REDIRECT_URL=/

# Database
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
REDIS_URL=rediss://...
KV_URL=rediss://...

# AI Service
OPENROUTER_API_KEY=sk-or-v1-...
DEFAULT_AI_MODEL=google/gemini-2.5-flash-preview-05-20

# Security
CRON_SECRET=... (generate with: openssl rand -hex 32)
JWT_SECRET=... (generate with: openssl rand -base64 32)
SCRAPER_API_KEY=... (shared with scraper service)
VERCEL_API_KEY=... (generate for internal API access)

# URLs
NEXT_PUBLIC_APP_URL=https://inplain.ai
NEXT_PUBLIC_SCRAPER_API_URL=https://inplain-scraper.onrender.com

# Feature Flags
NEXT_PUBLIC_DEMO_MODE=false
```

### Render (Scraper Service)

The following environment variables need to be set in Render:

```env
# Core Configuration
PYTHONUNBUFFERED=1
SCRAPY_SETTINGS_MODULE=scrapy_settings

# Frontend Integration
FRONTEND_URL=https://inplain.ai
WEBHOOK_URL=https://inplain.ai/api/webhooks/scraper
VERCEL_API_URL=https://inplain.ai
VERCEL_API_KEY=... (same as VERCEL_API_KEY in Vercel)

# Database
REDIS_URL=rediss://... (same as in Vercel)

# Security
SCRAPER_API_KEY=... (same as in Vercel)
```

## Data Flow Architecture

### 1. Scraping Trigger
- Vercel cron job (`/api/cron/trigger-scraping`) runs daily
- Checks which companies need scraping based on `checkInterval`
- Updates Redis with companies to scrape
- Optionally triggers Render scraper via webhook

### 2. Scraping Process
The scraper can store data in three ways:
- **Redis Storage** (legacy) - Stores directly in Redis queues
- **Webhook Notification** - Sends to `/api/webhooks/scraper`
- **Direct API Storage** - Uses `/api/snapshots/[slug]` endpoint

### 3. Data Processing
- Vercel cron job (`/api/cron/process-scrapes`) processes scraped data
- Converts raw scrapes into snapshots
- Calculates diffs between consecutive snapshots
- Generates AI summaries for changes

### 4. Frontend Access
- All data accessed through unified storage adapter
- Real-time metrics calculated from actual data
- No mock data in production

## Deployment Steps

### 1. Deploy Scraper to Render

1. Connect GitHub repository
2. Set root directory to `packages/scraper`
3. Use Docker deployment with provided Dockerfile
4. Configure environment variables (see Environment Variables section)
5. Deploy

### 2. Deploy Web App to Vercel

1. Connect GitHub repository
2. Set root directory to `apps/web`
3. Configure environment variables (see Environment Variables section)
4. Deploy

### 3. Configure Webhook Integration

Run the webhook setup script for automated configuration:

```bash
./scripts/setup-webhook.sh
```

Or manually configure following the [Webhook Setup Guide](./WEBHOOK_SETUP.md)

### 3. Configure Cron Jobs in Vercel

Add the following cron jobs in Vercel project settings:

```
# Daily scraping trigger (9 AM UTC)
/api/cron/trigger-scraping - 0 9 * * *

# Process scraped data (every 30 minutes)
/api/cron/process-scrapes - */30 * * * *

# Monitor for changes (already configured)
/api/cron/monitor - 0 9 * * *
```

### 4. Test Integration

1. Manually trigger scraping:
   ```bash
   curl -X GET https://inplain.ai/api/cron/trigger-scraping \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. Check scraper logs in Render dashboard

3. Verify snapshots are created:
   ```bash
   curl https://inplain.ai/api/snapshot/google
   ```

## Security Considerations

1. **API Keys**: 
   - Generate strong, unique keys for `SCRAPER_API_KEY` and `VERCEL_API_KEY`
   - Rotate keys periodically

2. **CORS**: 
   - Scraper endpoints validate API keys
   - Webhook endpoints are protected

3. **Rate Limiting**: 
   - Built-in rate limiting on all API endpoints
   - Scraper respects robots.txt and implements delays

## Monitoring

1. **Vercel Dashboard**: 
   - Monitor function execution
   - Check error logs
   - Track API usage

2. **Render Dashboard**:
   - Monitor scraper health
   - Check deployment status
   - View logs

3. **Upstash Console**:
   - Monitor Redis usage
   - Check data persistence
   - Track KV operations

## Troubleshooting

### Scraper Not Running
1. Check Render deployment status
2. Verify environment variables
3. Check Redis connectivity
4. Review scraper logs

### Data Not Appearing
1. Check cron job execution in Vercel
2. Verify webhook is receiving data
3. Check storage adapter operations
4. Review processing logs

### AI Summaries Failing
1. Verify OpenRouter API key
2. Check AI service integration
3. Review error logs
4. Monitor token usage