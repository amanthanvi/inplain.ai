# Deploy Python Scraper to Render (Free)

## Quick Start

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Connect Repository**
   ```bash
   # Push your code to GitHub first
   git add .
   git commit -m "Add Render configuration"
   git push origin main
   ```

3. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Select the repository

4. **Configure Service**
   - **Name**: `inplain-scraper`
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: `packages/scraper`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt && playwright install chromium`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT api_server:app`

5. **Environment Variables**
   Add these in Render dashboard:
   ```
   SCRAPER_API_KEY=<generate-secure-key>
   FRONTEND_URL=https://inplain.ai
   PYTHONUNBUFFERED=1
   SCRAPY_SETTINGS_MODULE=scrapy_settings
   ```

6. **Add Redis (Free via Upstash)**
   - Go to [upstash.com](https://upstash.com)
   - Create free Redis database
   - Copy the Redis URL
   - Add to Render env vars:
   ```
   REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
   ```

7. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete
   - Your scraper will be available at: `https://inplain-scraper.onrender.com`

## Update Vercel Environment

Add to your Vercel project:
```
NEXT_PUBLIC_SCRAPER_API_URL=https://inplain-scraper.onrender.com
SCRAPER_API_KEY=<same-key-as-render>
```

## Free Tier Limits

- **CPU**: Shared
- **RAM**: 512MB
- **Bandwidth**: 100GB/month
- **Build Minutes**: 500/month
- **Uptime**: Spins down after 15 mins of inactivity (auto-starts on request)

## Monitoring

Render provides:
- Real-time logs
- Metrics dashboard
- Deploy webhooks
- Health check monitoring

## Scaling Options

When you need more:
- **Starter**: $7/month (1GB RAM, no spin-down)
- **Standard**: $25/month (2GB RAM, autoscaling)

## Tips

1. **Cold Starts**: First request after inactivity takes ~10-30s
2. **Persistent Storage**: Use Render Disks ($3/month for 1GB)
3. **Cron Jobs**: Available on paid plans
4. **Custom Domains**: Free with all plans