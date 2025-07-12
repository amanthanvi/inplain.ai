# Webhook Integration Setup Guide

## Overview

This guide covers the complete webhook integration between the Render-deployed scraper service and the Vercel-hosted web application.

## Environment Variables

### Vercel Configuration

Add these environment variables to your Vercel project:

```env
# API Key for internal services (already generated)
VERCEL_API_KEY=56a44af2af81c84a41e03a9e14058f5451314d1c59cc8e821270777916f4036c

# Shared scraper API key (generate a secure one)
SCRAPER_API_KEY=<generate-with-openssl-rand-hex-32>
```

### Render Configuration

Add these environment variables to your Render service:

```env
# Vercel Integration
VERCEL_API_URL=https://inplain.ai
VERCEL_API_KEY=56a44af2af81c84a41e03a9e14058f5451314d1c59cc8e821270777916f4036c

# Webhook Configuration
WEBHOOK_URL=https://inplain.ai/api/webhooks/scraper
WEBHOOK_API_KEY=<same-as-SCRAPER_API_KEY-in-vercel>

# Shared scraper API key
SCRAPER_API_KEY=<same-as-SCRAPER_API_KEY-in-vercel>
```

## Data Flow Options

The scraper supports three data storage methods:

### 1. Direct API Storage (Recommended)
- Uses `/api/snapshots/[slug]` endpoint
- Stores data directly in Vercel's system
- Real-time processing
- Configured via `VERCEL_API_URL` and `VERCEL_API_KEY`

### 2. Webhook Notification
- Uses `/api/webhooks/scraper` endpoint
- Sends completion notifications
- Asynchronous processing
- Configured via `WEBHOOK_URL` and `WEBHOOK_API_KEY`

### 3. Redis Storage (Legacy)
- Direct Redis writes
- Requires cron job processing
- Higher latency
- Used as fallback when APIs unavailable

## Setup Steps

### 1. Generate Scraper API Key

```bash
# Generate a secure API key
openssl rand -hex 32
```

### 2. Configure Vercel Environment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following variables:
   - `VERCEL_API_KEY` (use the generated key above)
   - `SCRAPER_API_KEY` (use the key from step 1)

### 3. Configure Render Environment

1. Go to Render Dashboard → Your Service → Environment
2. Add the following variables:
   - `VERCEL_API_URL=https://inplain.ai`
   - `VERCEL_API_KEY` (use the generated key)
   - `WEBHOOK_URL=https://inplain.ai/api/webhooks/scraper`
   - `WEBHOOK_API_KEY` (same as SCRAPER_API_KEY)
   - `SCRAPER_API_KEY` (same as in Vercel)

### 4. Test the Integration

#### Test Direct API Storage
```bash
# From Render service logs, verify you see:
# "Stored snapshot in Vercel: <snapshot-id>"
```

#### Test Webhook Notification
```bash
# Test webhook endpoint
curl -X POST https://inplain.ai/api/webhooks/scraper \
  -H "X-API-Key: <your-scraper-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-123",
    "status": "completed",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "company_slug": "google",
      "url": "https://policies.google.com/privacy",
      "content": "Test content",
      "content_type": "html",
      "content_hash": "test-hash",
      "content_length": 12,
      "scraped_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

#### Trigger Manual Scrape
```bash
# Trigger scraping for a specific company
curl -X POST https://inplain.ai/api/cron/trigger-scraping \
  -H "Authorization: Bearer <your-cron-secret>" \
  -d '{"companies": ["google"]}'
```

## Security Considerations

1. **API Key Rotation**
   - Rotate `VERCEL_API_KEY` and `SCRAPER_API_KEY` every 90 days
   - Update both Vercel and Render environments simultaneously

2. **IP Whitelisting** (Optional)
   - Configure Vercel to only accept requests from Render's IP ranges
   - Add IP validation in webhook handler

3. **Request Validation**
   - All requests are validated with API keys
   - Request payloads are validated with Zod schemas
   - Rate limiting is applied to prevent abuse

## Monitoring

### Vercel Logs
Monitor in Vercel Dashboard → Functions → Logs:
- Successful webhook receipts: "Received scraper webhook"
- Successful storage: "Snapshot stored"
- Errors: "Scraper webhook error"

### Render Logs
Monitor in Render Dashboard → Logs:
- Successful API storage: "Stored snapshot in Vercel"
- Successful webhook: "Webhook notification sent"
- Connection errors: "Webhook request failed"

## Troubleshooting

### Webhook Not Receiving Data
1. Check `WEBHOOK_URL` is correct in Render
2. Verify `WEBHOOK_API_KEY` matches `SCRAPER_API_KEY`
3. Check Vercel function logs for authentication errors

### API Storage Failing
1. Verify `VERCEL_API_KEY` is correct
2. Check `VERCEL_API_URL` doesn't have trailing slash
3. Ensure Vercel deployment is healthy

### Data Not Appearing in Frontend
1. Check storage adapter is reading from correct keys
2. Verify snapshots are being created
3. Check diff calculation is running

## Performance Optimization

1. **Parallel Processing**
   - Both webhook and API storage run in parallel
   - Failure of one doesn't affect the other

2. **Retry Logic**
   - Built-in retry for failed requests
   - Exponential backoff for rate limits

3. **Caching**
   - 1-hour cache for company metrics
   - Snapshot content cached in blob storage