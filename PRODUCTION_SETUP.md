# PolicyDiff Production Setup Guide

## 🚀 Making PolicyDiff Production-Ready

This guide ensures your PolicyDiff app is fully production-ready with all features enabled.

## Current Status

Your deployment has all the necessary environment variables configured:
- ✅ `OPENROUTER_API_KEY` - AI features enabled
- ✅ `KV_REST_API_URL` & `KV_REST_API_TOKEN` - Redis storage configured
- ✅ `JWT_SECRET` - Authentication enabled
- ✅ `CRON_SECRET` - Scheduled jobs secured
- ✅ `NEXT_PUBLIC_APP_URL` - Set to https://policydiff.vercel.app

## Production Features Checklist

### 1. **Authentication & User Management** ✅
- JWT-based authentication is configured
- Users can sign up, log in, and manage their accounts
- Protected routes require authentication
- Session persistence across browser refreshes

### 2. **Data Storage (Redis/KV)** ✅
- Policy snapshots and diffs are stored persistently
- User preferences and watchlists are saved
- Analytics data is tracked and stored
- Cache for improved performance

### 3. **AI Features (OpenRouter)** ✅
- Policy analysis and summaries
- Advanced AI insights with streaming
- Multiple model support
- Context-aware responses

### 4. **Premium Features**
- **Watchlists**: Track specific companies
- **Alerts**: Get notified of policy changes
- **Webhooks**: Integrate with external services
- **Data Export**: Export analytics and reports

### 5. **Scheduled Jobs (Cron)**
- Daily policy monitoring at 9 AM UTC
- Automatic change detection
- Alert processing

## Verify Production Status

### 1. Check App Mode
Visit: `https://policydiff.vercel.app/api/status`

Expected response:
```json
{
  "mode": "production",
  "services": {
    "ai": true,
    "storage": true,
    "auth": true
  },
  "timestamp": "2025-01-23T..."
}
```

### 2. Test Core Features

#### Public Features (No Login Required)
- Browse companies: `/google`, `/facebook`, `/amazon`
- Search for policies
- View policy changes and diffs
- Get AI summaries (click "Get AI Summary" on any policy)

#### Authenticated Features (Login Required)
1. **Sign Up**: Create an account at `/signup`
2. **Dashboard**: Access `/dashboard` to see your watchlist
3. **Settings**: Configure preferences at `/settings`
4. **Watchlists**: Add companies to track
5. **Alerts**: Set up email notifications

### 3. Test API Endpoints
```bash
# Health check
curl https://policydiff.vercel.app/api/health

# List available models
curl https://policydiff.vercel.app/api/models

# Search companies
curl "https://policydiff.vercel.app/api/search?q=privacy"
```

## Enable Additional Features

### 1. Email Notifications
To enable email alerts, add these environment variables in Vercel:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
FROM_EMAIL=noreply@policydiff.com
```

### 2. Webhook Support
Webhooks are already supported in the code. Users can:
- Configure webhooks in their dashboard
- Receive POST requests when policies change
- Integrate with Slack, Discord, or custom endpoints

### 3. Rate Limiting
Add these optional environment variables for custom limits:
```
RATE_LIMIT_MAX=100        # Requests per window (default: 100)
RATE_LIMIT_WINDOW=60000   # Window in ms (default: 1 minute)
```

### 4. Analytics & Monitoring
Consider adding:
- **Vercel Analytics**: Enable in Vercel dashboard
- **Error Tracking**: Add Sentry or similar
- **Uptime Monitoring**: Use services like UptimeRobot

## Performance Optimization

### 1. Already Implemented
- ✅ Edge runtime for API routes
- ✅ Streaming AI responses
- ✅ Redis caching
- ✅ Static generation where possible
- ✅ Optimized builds with Turbo

### 2. Additional Optimizations
- Enable Vercel's Image Optimization
- Use Vercel's Edge Config for feature flags
- Implement CDN for static assets

## Security Checklist

### Already Implemented
- ✅ JWT authentication with httpOnly cookies
- ✅ CSRF protection
- ✅ XSS protection headers
- ✅ Input validation
- ✅ SQL injection prevention (using Redis)
- ✅ Rate limiting ready

### Additional Security
1. **Enable HTTPS enforcement** (automatic on Vercel)
2. **Set security headers** in vercel.json (already configured)
3. **Regular dependency updates**: Run `npm audit` periodically

## Troubleshooting Production Issues

### If Demo Mode Still Shows
1. Clear browser cache and localStorage
2. Check `/api/status` response
3. Verify latest deployment includes the Edge runtime fix
4. Try incognito/private browsing mode

### If Features Don't Work
1. Check browser console for errors
2. Verify API endpoints return data
3. Ensure cookies are enabled (required for auth)
4. Check Vercel function logs for server errors

### Debug Endpoints
For debugging (protect these in production):
- `/api/debug` - General debug info
- `/api/health` - System health check

## Monitoring & Maintenance

### Daily Tasks
- Monitor Vercel dashboard for errors
- Check Upstash Redis usage
- Review OpenRouter API usage

### Weekly Tasks
- Review user analytics
- Check for policy monitoring accuracy
- Update watched companies if needed

### Monthly Tasks
- Review and optimize costs
- Update dependencies
- Analyze user feedback

## Cost Management

### Current Services
1. **Vercel**: Free tier should handle moderate traffic
2. **Upstash Redis**: Free tier includes 10,000 commands/day
3. **OpenRouter**: Pay per API call, monitor usage

### Cost Optimization Tips
- Use caching aggressively
- Implement request debouncing
- Set up usage alerts in each service
- Consider upgrading tiers as you scale

## Scaling Considerations

Your app is ready to scale with:
- Automatic scaling on Vercel
- Redis connection pooling
- Efficient AI token usage
- Proper error handling

As you grow, consider:
- Upgrading Upstash Redis tier
- Implementing queue for AI requests
- Adding more comprehensive analytics
- Setting up multi-region deployment

## 🎉 Your App is Production-Ready!

PolicyDiff is now fully configured for production use with:
- Real-time policy monitoring
- AI-powered analysis
- User authentication
- Premium features
- Scalable infrastructure

Monitor the deployment at: https://vercel.com/dashboard