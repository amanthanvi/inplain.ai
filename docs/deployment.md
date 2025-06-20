# PolicyDiff Production Deployment Guide

This guide provides step-by-step instructions for deploying PolicyDiff to production using Vercel, Terraform, and associated services.

## Prerequisites

Before starting, ensure you have:

- Node.js 20+ and pnpm 8+
- Vercel CLI (`npm install -g vercel`)
- Terraform CLI (`brew install terraform` or [download](https://www.terraform.io/downloads))
- GitHub account with repository access
- Domain name (optional, can use Vercel's generated domain)

## 1. OpenRouter Setup

### Get OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up or log in to your account
3. Navigate to "API Keys" in your dashboard
4. Create a new API key with these settings:
   - **Name**: `PolicyDiff Production`
   - **Usage Limit**: Set appropriate monthly limit ($50-100 recommended)
   - **Models**: Ensure access to Legal category models
5. Copy your API key (starts with `sk-or-v1-`)

### Configure Rate Limits

OpenRouter provides built-in rate limiting, but PolicyDiff adds additional protection:

- **Application Rate Limit**: 60 requests/minute
- **Cache Duration**: 24 hours for AI summaries
- **Token Limits**: 4000 tokens max per request

## 2. GitHub Repository Setup

### Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/yourusername/policydiff.git
cd policydiff

# Install dependencies
pnpm install
```

### GitHub Secrets

Navigate to your repository's Settings → Secrets and Variables → Actions, and add:

```
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=your_vercel_org_id_here
VERCEL_PROJECT_ID=your_vercel_project_id_here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

To get Vercel credentials:

```bash
# Install Vercel CLI and authenticate
npm install -g vercel
vercel login

# Get org and project IDs
vercel env ls
```

## 3. Vercel Project Setup

### Create Vercel Project

```bash
# Link your local project to Vercel
vercel link

# Or create a new project
vercel --name policydiff

# Set up environment variables
vercel env add OPENROUTER_API_KEY
vercel env add DEFAULT_AI_MODEL
vercel env add CRON_SECRET
```

### Environment Variables

Add these environment variables in the Vercel dashboard:

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-key-here
DEFAULT_AI_MODEL=google/gemini-2.5-flash-preview-05-20

# AI Service Configuration  
AI_CACHE_EXPIRY_HOURS=24
AI_RATE_LIMIT_PER_MINUTE=60
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.3

# Security
CRON_SECRET=generate-random-32-char-string

# Optional: Custom Domain
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### Generate Secure Secrets

```bash
# Generate a secure cron secret
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vercel Storage Setup

1. **Enable Vercel KV** (for metadata storage):
   ```bash
   # In your Vercel dashboard
   # Go to Storage → Create Database → KV
   # Name: policydiff-kv
   # Region: Same as your functions (us-east-1 recommended)
   ```

2. **Enable Vercel Blob** (for snapshot storage):
   ```bash
   # In your Vercel dashboard  
   # Go to Storage → Create Database → Blob
   # Name: policydiff-blob
   # Region: Same as your functions
   ```

The storage environment variables will be automatically added to your project.

## 4. Domain Configuration (Optional)

### Custom Domain Setup

1. **Purchase/Configure Domain**: Use your preferred domain registrar
2. **Add Domain to Vercel**:
   ```bash
   # Via CLI
   vercel domains add yourdomain.com
   
   # Or via dashboard: Settings → Domains → Add Domain
   ```

3. **DNS Configuration**: Point your domain to Vercel:
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```

4. **SSL Certificate**: Vercel automatically provisions Let's Encrypt certificates

## 5. Terraform Infrastructure (Optional)

For infrastructure-as-code management:

### Setup Terraform

```bash
cd infrastructure

# Initialize Terraform
terraform init

# Create terraform.tfvars file
cp terraform.tfvars.example terraform.tfvars
```

### Configure Variables

Edit `terraform.tfvars`:

```hcl
# Vercel Configuration
vercel_api_token = "your_vercel_token"
vercel_team_id = "your_team_id"

# OpenRouter Configuration  
openrouter_api_key = "sk-or-v1-your-key-here"
default_ai_model = "google/gemini-2.5-flash-preview-05-20"

# Domain Configuration
domain_name = "yourdomain.com"  # or use Vercel's generated domain

# Monitoring
alert_email = "alerts@yourdomain.com"
```

### Deploy Infrastructure

```bash
# Plan the deployment
terraform plan

# Apply the infrastructure
terraform apply

# Confirm with 'yes' when prompted
```

This creates:
- Vercel project with environment variables
- Edge Config for company data
- Custom domain (if specified)
- Monitoring configuration

## 6. Initial Deployment

### Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or push to main branch for automatic deployment
git add .
git commit -m "Initial production setup"
git push origin main
```

### Verify Deployment

1. **Check Application**: Visit your domain or Vercel URL
2. **Test API Endpoints**:
   ```bash
   # Test health endpoint
   curl https://yourdomain.com/api/health
   
   # Test diff generation (should show "no changes yet")
   curl https://yourdomain.com/api/diff/google
   ```

3. **Verify Storage**: Check Vercel dashboard for KV and Blob usage

## 7. Monitoring & Scraper Setup

### GitHub Actions

The repository includes CI/CD workflows that automatically:
- Run tests on pull requests  
- Deploy to Vercel on push to main
- Run security scans
- Update dependencies

### Scraper Deployment

The scraper runs as a separate service. Deploy options:

#### Option A: Railway

1. Connect GitHub repository to Railway
2. Set environment variables:
   ```
   VERCEL_API_URL=https://yourdomain.com/api
   SCRAPER_INTERVAL=86400
   ```

#### Option B: Docker on VPS

```bash
# Build and deploy scraper
cd packages/scraper
docker build -t policydiff-scraper .
docker run -d --name scraper \
  -e VERCEL_API_URL=https://yourdomain.com/api \
  -e SCRAPER_INTERVAL=86400 \
  policydiff-scraper
```

#### Option C: Cron Job

Set up the cron endpoint to run daily:

```bash
# Add to your server's crontab
0 9 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/monitor
```

## 8. Initial Data Population

### Add Companies to Monitor

Update the Edge Config with companies to monitor:

```bash
# Via Terraform (recommended)
terraform apply

# Or via Vercel CLI
vercel env add EDGE_CONFIG_COMPANIES --value '[
  {
    "slug": "google",
    "name": "Google", 
    "url": "https://policies.google.com/privacy",
    "checkInterval": 86400,
    "active": true
  }
]'
```

### Trigger Initial Scraping

```bash
# Manually trigger the monitor
curl -X GET https://yourdomain.com/api/cron/monitor \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 9. Post-Deployment Verification

### Health Checks

```bash
# API Health
curl https://yourdomain.com/api/health

# Database Connectivity
curl https://yourdomain.com/api/debug/db-status

# Storage Access
curl https://yourdomain.com/api/debug/storage-status
```

### Performance Testing

```bash
# Load test the API
npx autocannon https://yourdomain.com/api/diff/google

# Test AI summary generation
curl -X POST https://yourdomain.com/api/summary/google \
  -H "Content-Type: application/json" \
  -d '{"diffId": "test", "force": true}'
```

### Monitor Logs

```bash
# View Vercel function logs
vercel logs --follow

# Monitor OpenRouter usage
# Check OpenRouter dashboard for API usage and costs
```

## 10. Cost Optimization

### OpenRouter Usage

- **Expected Costs**: $10-50/month depending on traffic
- **Model Selection**: Use Gemini Flash (cheapest) for most requests
- **Caching**: 24-hour cache reduces API calls by ~90%
- **Rate Limiting**: Prevents runaway costs

### Vercel Usage

- **Edge Functions**: Usually within free tier for small projects
- **Storage**: KV and Blob have generous free tiers
- **Bandwidth**: Monitor for high traffic

### Monitoring Costs

```bash
# Set up billing alerts in both platforms
# OpenRouter: Dashboard → Billing → Alerts
# Vercel: Dashboard → Settings → Billing → Usage Alerts
```

## 11. Maintenance

### Regular Updates

```bash
# Update dependencies monthly
pnpm update

# Update infrastructure
terraform plan && terraform apply

# Monitor security advisories
npm audit
```

### Backup Strategy

- **Code**: Version controlled in GitHub
- **Data**: Vercel KV/Blob have built-in replication
- **Configuration**: Managed via Terraform

### Security Updates

- Monitor GitHub security advisories
- Keep dependencies updated
- Rotate API keys annually
- Review access logs monthly

## Troubleshooting

### Common Issues

1. **"OpenRouter API Error"**:
   - Check API key validity
   - Verify rate limits not exceeded
   - Confirm model availability

2. **"Vercel Function Timeout"**:
   - Check function logs
   - Verify KV/Blob connectivity
   - Monitor cold start times

3. **"Scraper Not Running"**:
   - Check cron job configuration
   - Verify scraper deployment
   - Test manual trigger

### Debug Commands

```bash
# Check environment variables
vercel env ls

# View function logs
vercel logs --follow

# Test local development
make dev

# Validate Terraform configuration
terraform validate
```

### Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Refer to docs/ directory
- **Community**: Check discussions tab

---

## Summary

After following this guide, you'll have:

✅ OpenRouter API configured with multiple AI models  
✅ Vercel project deployed with Edge Functions  
✅ Storage (KV + Blob) configured and connected  
✅ GitHub Actions CI/CD pipeline active  
✅ Optional: Custom domain and Terraform infrastructure  
✅ Monitoring and alerting configured  
✅ Scraper service running daily checks  

Your PolicyDiff instance will be monitoring privacy policies and generating AI summaries using the most cost-effective models available through OpenRouter.