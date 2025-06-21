# PolicyDiff Deployment Guide

## Required Environment Variables

You MUST configure these environment variables in your Vercel deployment:

### 1. OpenRouter AI API (CRITICAL)
```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
DEFAULT_AI_MODEL=google/gemini-2.0-flash-exp:free
```

**To get an OpenRouter API key:**
1. Go to https://openrouter.ai/
2. Sign up for an account
3. Navigate to Keys section
4. Create a new API key
5. Add it to Vercel: Settings → Environment Variables

### 2. Vercel KV Storage
```
KV_REST_API_URL=https://your-kv-url.upstash.io
KV_REST_API_TOKEN=your-kv-token
```

**These are automatically set when you:**
1. Go to your Vercel project
2. Storage → Create Database → KV
3. Follow the setup wizard

### 3. Cron Security
```
CRON_SECRET=your-super-secret-key-here
```

Generate a secure random string for cron job authentication.

## Quick Setup Commands

### 1. Clone and Install
```bash
git clone https://github.com/amanthanvi/policydiff.git
cd policydiff
npm install
```

### 2. Set Environment Variables in Vercel
```bash
vercel env add OPENROUTER_API_KEY
vercel env add DEFAULT_AI_MODEL
vercel env add CRON_SECRET
```

### 3. Deploy
```bash
vercel --prod
```

## Troubleshooting

### Check Environment Configuration
Visit: `https://your-app.vercel.app/api/debug/env?secret=YOUR_CRON_SECRET`

### Test AI Service
```bash
curl -X POST https://your-app.vercel.app/api/debug/ai-test?secret=YOUR_CRON_SECRET
```

### Common Issues

1. **500 Error on AI Summary Generation**
   - Cause: Missing OPENROUTER_API_KEY
   - Fix: Add the API key in Vercel environment variables

2. **"Analyzing..." Stuck Forever**
   - Cause: AI service not configured or API key invalid
   - Fix: Verify OPENROUTER_API_KEY is correct

3. **No Data Showing**
   - Cause: Cron job hasn't run yet
   - Fix: Wait for daily cron (9 AM UTC) or manually trigger

## Manual Data Seeding

To populate initial data without waiting for cron:

```bash
# Trigger manual monitoring
curl -X POST https://your-app.vercel.app/api/cron/monitor \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

- Check cron job status in Vercel dashboard: Functions → Cron
- View logs: Functions → Logs
- Monitor KV usage: Storage → Your KV Database

## Cost Optimization

- Default model uses free tier: `google/gemini-2.0-flash-exp:free`
- KV storage free tier: 30k requests/month
- Cron runs once daily to minimize costs