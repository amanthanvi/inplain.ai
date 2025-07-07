# Python Scraper Deployment Guide for Railway

This guide walks you through deploying the Inplain.AI Python scraper to Railway as a separate service that communicates with your Vercel-hosted frontend.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Vercel         │         │  Railway         │
│                 │         │                  │
│  Next.js App    │ <-----> │  Python Scraper  │
│  Edge Functions │  HTTPS  │  Flask API       │
│  Vercel KV      │         │  Redis           │
└─────────────────┘         └──────────────────┘
```

## Prerequisites

1. Railway account (https://railway.app)
2. Railway CLI installed: `npm install -g @railway/cli`
3. Environment variables from your Vercel app

## Step 1: Set Up Railway Project

```bash
# Login to Railway
railway login

# Create a new project
railway init

# Link to the scraper directory
cd packages/scraper
```

## Step 2: Configure Environment Variables

Set these environment variables in Railway dashboard:

```env
# API Security
SCRAPER_API_KEY=<generate-secure-key>
FRONTEND_URL=https://inplain.ai

# Redis (automatically set by Railway)
REDIS_HOST=${{REDIS.REDIS_PRIVATE_URL}}
REDIS_PORT=6379
REDIS_PASSWORD=${{REDIS.REDIS_PASSWORD}}

# Frontend Webhook (optional)
FRONTEND_WEBHOOK_URL=https://inplain.ai/api/webhooks/scraper

# Python Settings
PYTHONUNBUFFERED=1
SCRAPY_SETTINGS_MODULE=scrapy_settings
```

## Step 3: Deploy to Railway

```bash
# Deploy the service
railway up

# Check deployment logs
railway logs

# Get the deployment URL
railway open
```

Your scraper API will be available at: `https://your-app.railway.app`

## Step 4: Configure Vercel Frontend

Add these environment variables to your Vercel project:

```env
# Scraper API Configuration
NEXT_PUBLIC_SCRAPER_API_URL=https://your-app.railway.app
SCRAPER_API_KEY=<same-key-as-railway>
```

## Step 5: Create Frontend Integration

Create a new file in your Vercel app:

```typescript
// apps/web/src/lib/scraper/client.ts
import { z } from 'zod'

const ScraperJobSchema = z.object({
  job_id: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  message: z.string().optional(),
})

const ScraperResultSchema = z.object({
  job_id: z.string(),
  company_slug: z.string(),
  url: z.string(),
  scraped_at: z.string(),
  content: z.any(),
})

export class ScraperClient {
  private apiUrl: string
  private apiKey: string
  
  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || ''
    this.apiKey = process.env.SCRAPER_API_KEY || ''
    
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('Scraper API configuration missing')
    }
  }
  
  async triggerScrape(slug: string, url: string, priority: 'normal' | 'high' = 'normal') {
    const response = await fetch(`${this.apiUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ slug, url, priority }),
    })
    
    if (!response.ok) {
      throw new Error(`Scraper API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return ScraperJobSchema.parse(data)
  }
  
  async getJobStatus(jobId: string) {
    const response = await fetch(`${this.apiUrl}/status/${jobId}`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    })
    
    if (!response.ok) {
      throw new Error(`Scraper API error: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  async getLatestResults(companySlug: string) {
    const response = await fetch(`${this.apiUrl}/results/${companySlug}`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Scraper API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return ScraperResultSchema.parse(data)
  }
}

// Export singleton instance
export const scraperClient = new ScraperClient()
```

## Step 6: Create Webhook Handler

Create a webhook endpoint in your Vercel app:

```typescript
// apps/web/src/app/api/webhooks/scraper/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kv } from '@/app/api/lib/kv-wrapper'

const WebhookPayloadSchema = z.object({
  job_id: z.string(),
  status: z.enum(['completed', 'failed']),
  timestamp: z.string(),
  data: z.any(),
})

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.SCRAPER_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse webhook payload
    const payload = WebhookPayloadSchema.parse(await request.json())
    
    // Handle completed scrape
    if (payload.status === 'completed') {
      const { company_slug, content } = payload.data
      
      // Process and store the scraped content
      await processScrapedContent(company_slug, content)
      
      // Notify users if needed
      await notifyUsersOfUpdate(company_slug)
    }
    
    // Log the webhook event
    await kv.lpush('scraper:webhooks', JSON.stringify({
      ...payload,
      received_at: new Date().toISOString(),
    }))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Scraper webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processScrapedContent(companySlug: string, content: any) {
  // Your content processing logic here
  // e.g., store in database, calculate diff, etc.
}

async function notifyUsersOfUpdate(companySlug: string) {
  // Your notification logic here
}
```

## Step 7: Add Monitoring

Create a monitoring dashboard in your Vercel app:

```typescript
// apps/web/src/app/api/admin/scraper-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scraperClient } from '@/lib/scraper/client'

export async function GET(request: NextRequest) {
  try {
    // Check scraper health
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SCRAPER_API_URL}/health`,
      { 
        headers: { 'X-API-Key': process.env.SCRAPER_API_KEY! },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!response.ok) {
      throw new Error('Scraper unhealthy')
    }
    
    const health = await response.json()
    
    return NextResponse.json({
      scraper: health,
      configured: true,
      url: process.env.NEXT_PUBLIC_SCRAPER_API_URL,
    })
  } catch (error) {
    return NextResponse.json({
      scraper: { status: 'unhealthy' },
      configured: false,
      error: error.message,
    })
  }
}
```

## Railway-Specific Features

### Auto-scaling
Railway automatically scales your service based on traffic. Configure in `railway.json`:

```json
{
  "deploy": {
    "numReplicas": {
      "min": 1,
      "max": 3
    }
  }
}
```

### Persistent Storage
For storing scraped data files:

```json
{
  "volumes": [
    {
      "mount": "/app/data",
      "name": "scraper-data"
    }
  ]
}
```

### Cron Jobs
Add to `railway.json` for scheduled scraping:

```json
{
  "crons": [
    {
      "schedule": "0 9 * * *",
      "command": "python scheduled_scrape.py"
    }
  ]
}
```

## Monitoring & Debugging

### View Logs
```bash
railway logs -f
```

### SSH into Container
```bash
railway run bash
```

### Check Redis
```bash
railway run redis-cli
```

## Cost Optimization

1. **Use Sleep Mode**: Railway can sleep services when not in use
2. **Optimize Workers**: Start with 2 workers, scale as needed
3. **Set Memory Limits**: Add to railway.json:
   ```json
   {
     "deploy": {
       "memoryLimitMB": 512
     }
   }
   ```

## Security Best Practices

1. **Rotate API Keys**: Change `SCRAPER_API_KEY` regularly
2. **IP Allowlisting**: Configure Railway to only accept requests from Vercel IPs
3. **Rate Limiting**: Implement rate limiting in the Flask API
4. **Monitoring**: Set up alerts for failed scrapes and high error rates

## Troubleshooting

### Common Issues

1. **Playwright Installation Fails**
   - Solution: The Dockerfile already includes all necessary dependencies

2. **Redis Connection Errors**
   - Check if Redis service is running: `railway status`
   - Verify environment variables are set correctly

3. **High Memory Usage**
   - Playwright can be memory-intensive
   - Consider using headless mode and limiting concurrent scrapers

4. **Webhook Failures**
   - Check Vercel function logs
   - Verify API key matches between services
   - Test with curl:
     ```bash
     curl -X POST https://inplain.ai/api/webhooks/scraper \
       -H "X-API-Key: your-api-key" \
       -H "Content-Type: application/json" \
       -d '{"job_id":"test","status":"completed","data":{}}'
     ```

## Next Steps

1. Set up monitoring alerts in Railway
2. Configure custom domain if needed
3. Implement scheduled scraping for regular updates
4. Add more sophisticated error handling and retry logic