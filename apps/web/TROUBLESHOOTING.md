# PolicyDiff Troubleshooting Guide

This guide helps you resolve common issues with the PolicyDiff application.

## Table of Contents

1. [Environment Setup Issues](#environment-setup-issues)
2. [Common Browser Console Errors](#common-browser-console-errors)
3. [API and Backend Issues](#api-and-backend-issues)
4. [Authentication Problems](#authentication-problems)
5. [AI Service Issues](#ai-service-issues)
6. [Database and Storage Issues](#database-and-storage-issues)
7. [Performance Issues](#performance-issues)
8. [Deployment Issues](#deployment-issues)

## Environment Setup Issues

### Missing Environment Variables

**Problem**: Application shows warnings about missing configuration or features don't work.

**Solution**:
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in required variables:
   - `OPENROUTER_API_KEY` - Get from [OpenRouter](https://openrouter.ai/keys)
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` - From Vercel KV dashboard
   - `JWT_SECRET` - Generate with: `openssl rand -base64 32`
   - `CRON_SECRET` - Generate with: `openssl rand -base64 32`

3. Optional but recommended:
   - `RESEND_API_KEY` - For email alerts
   - `EMAIL_FROM` - Sender email address

### Demo Mode vs Production Mode

**Problem**: App runs in demo mode with mock data.

**Solution**: The app automatically runs in demo mode when `OPENROUTER_API_KEY` is not set. This is intentional for testing. To enable full features:
1. Set `OPENROUTER_API_KEY` in your environment
2. Restart the development server

## Common Browser Console Errors

### 1. "KV not configured - using in-memory mock"

**Symptom**: Console warning about KV storage not being configured.

**Impact**: Data won't persist between server restarts.

**Solution**:
- For development: This is acceptable, data is stored in memory
- For production: Configure Vercel KV storage in your Vercel dashboard

### 2. "Failed to fetch snapshot" or 404 errors

**Symptom**: 404 errors when loading company pages.

**Impact**: Normal for new companies that haven't been monitored yet.

**Solution**:
- Wait for the daily cron job (9 AM UTC) to capture the first snapshot
- Or manually trigger monitoring via the API

### 3. "Rate limit exceeded"

**Symptom**: 429 errors from OpenRouter API.

**Impact**: AI analysis temporarily unavailable.

**Solution**:
- Wait 60 seconds before retrying
- Check your OpenRouter credits at [OpenRouter Dashboard](https://openrouter.ai/dashboard)
- Consider upgrading your OpenRouter plan

### 4. "Insufficient credits"

**Symptom**: 402 error from OpenRouter.

**Impact**: AI features won't work.

**Solution**:
- Add credits to your OpenRouter account
- Switch to cheaper models in settings
- Use demo mode for testing

## API and Backend Issues

### API Routes Return 500 Errors

**Common Causes**:
1. Missing environment variables
2. Invalid API keys
3. Database connection issues

**Debugging Steps**:
1. Check server logs for detailed error messages
2. Verify all required environment variables are set
3. Test API endpoints individually:
   ```bash
   # Health check
   curl http://localhost:3000/api/health
   
   # Test AI service
   curl http://localhost:3000/api/models
   ```

### CORS Issues

**Symptom**: "CORS policy" errors in browser console.

**Solution**:
- Ensure `NEXT_PUBLIC_API_URL` matches your deployment URL
- For local development, use relative URLs (`/api/...`)

## Authentication Problems

### Development Authentication

**Problem**: Can't access premium features in development.

**Solution**: Use development authentication:
```bash
# Enable dev auth
npm run dev:auth

# Test with default credentials
# Email: dev@policydiff.com
# Password: development
```

### JWT Token Errors

**Symptom**: "Invalid token" or authentication failures.

**Solution**:
1. Ensure `JWT_SECRET` is set and consistent
2. Clear browser cookies and localStorage
3. Log in again

## AI Service Issues

### AI Analysis Fails

**Common Issues**:

1. **"Failed to start streaming analysis"**
   - Try non-streaming mode (click "Use Non-Streaming" button)
   - Check browser console for detailed errors

2. **Empty or Invalid Responses**
   - Model may be overloaded, try a different model
   - Check if content is too long (>500k characters)

3. **Slow Analysis**
   - Switch to faster models (Gemini Flash, GPT-4o Mini)
   - Enable caching (default 24 hours)

### Model Selection

**Best Models by Use Case**:
- **Fast & Cheap**: `google/gemini-2.0-flash-exp:free`
- **Balanced**: `openai/gpt-4o-mini`
- **High Quality**: `anthropic/claude-3.5-sonnet`
- **Long Context**: `google/gemini-2.5-pro-preview`

## Database and Storage Issues

### Vercel KV Connection Failed

**Symptom**: Storage warnings, data not persisting.

**Solution**:
1. Verify KV credentials in Vercel dashboard
2. Ensure your IP is whitelisted (for local dev)
3. Check KV usage limits

### Data Not Persisting

**In Development**: This is normal with mock KV storage.

**In Production**:
1. Check Vercel KV dashboard for errors
2. Verify environment variables are set in Vercel
3. Check KV storage limits

## Performance Issues

### Slow Page Loads

**Solutions**:
1. Enable caching:
   - AI responses cached for 24 hours by default
   - Adjust `AI_CACHE_EXPIRY_HOURS` if needed

2. Optimize API calls:
   - Use streaming for large analyses
   - Enable pagination for lists

3. Check metrics:
   ```bash
   # View performance metrics
   curl http://localhost:3000/api/metrics
   ```

### Memory Issues

**Symptom**: Server crashes or becomes unresponsive.

**Solution**:
1. Limit concurrent AI requests
2. Reduce `AI_MAX_TOKENS` (default 4000)
3. Enable request queuing

## Deployment Issues

### Vercel Deployment Fails

**Common Issues**:

1. **Build errors**
   ```bash
   # Test build locally
   npm run build
   ```

2. **Missing environment variables**
   - Set all required variables in Vercel dashboard
   - Use Vercel CLI to sync: `vercel env pull`

3. **Function timeouts**
   - Upgrade to Vercel Pro for longer timeouts
   - Use streaming responses for long operations

### Cron Jobs Not Running

**Solution**:
1. Verify `CRON_SECRET` is set in Vercel
2. Check Vercel Functions logs
3. Test manually:
   ```bash
   npm run cron:local
   ```

## Quick Fixes

### Reset Everything
```bash
# Clear all caches and restart
rm -rf .next
npm install
npm run dev
```

### Test Configuration
```bash
# Run all tests
npm run test:api
npm run test:auth
npm run test:enhancements
```

### Check System Status
Visit `/api/health` to see:
- Environment configuration
- Service availability
- System warnings

## Getting Help

1. **Check Logs**: Always check browser console and server logs first
2. **API Documentation**: See `/docs/api` for endpoint details
3. **Environment Check**: Use `/api/health` endpoint
4. **GitHub Issues**: Report bugs with full error details

## Common Error Messages Reference

| Error | Cause | Solution |
|-------|-------|----------|
| "KV not configured" | Missing Vercel KV setup | Configure KV or use demo mode |
| "Rate limit exceeded" | Too many API requests | Wait 60 seconds, check limits |
| "Insufficient credits" | OpenRouter balance low | Add credits or use free models |
| "Failed to fetch" | Network or CORS issue | Check API URL configuration |
| "Invalid token" | JWT expired or invalid | Clear cookies and re-login |
| "Model not available" | Model overloaded | Try alternative model |

## Monitoring Tools

### Built-in Debugging
- `/api/health` - System health check
- `/api/debug/auth` - Authentication status
- `/api/metrics` - Performance metrics
- `/api/cache` - Cache statistics

### External Tools
- OpenRouter Dashboard - Monitor AI usage
- Vercel Dashboard - Logs and metrics
- Browser DevTools - Network and console logs