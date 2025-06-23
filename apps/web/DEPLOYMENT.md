# PolicyDiff Vercel Deployment Guide

## Prerequisites

1. A Vercel account
2. An OpenRouter API key (https://openrouter.ai/keys)
3. (Optional) A Resend API key for email alerts (https://resend.com)

## Deployment Steps

### 1. Deploy to Vercel

Click the deploy button or import the repository:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fpolicydiff)

### 2. Create Vercel KV Database

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **Create Database** → **KV**
3. Follow the setup wizard
4. The KV environment variables will be automatically added to your project

### 3. Configure Environment Variables

In your Vercel project settings, go to **Settings** → **Environment Variables** and add:

#### Required Variables:

| Variable | Description | How to Get |
|----------|-------------|------------|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI services | [Get key](https://openrouter.ai/keys) |
| `CRON_SECRET` | Security token for cron jobs | Generate: `openssl rand -base64 32` |
| `JWT_SECRET` | Secret for JWT tokens | Generate: `openssl rand -base64 32` |

#### Recommended Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `https://your-app.vercel.app` |
| `DEFAULT_AI_MODEL` | AI model to use | `google/gemini-2.0-flash-exp:free` |
| `RESEND_API_KEY` | For email alerts | [Get key](https://resend.com) |

### 4. Configure Cron Jobs

1. Go to **Settings** → **Functions** → **Cron Jobs**
2. Add the following cron jobs:

```json
{
  "path": "/api/cron/check-policies",
  "schedule": "0 */6 * * *"
}
```

```json
{
  "path": "/api/cron/process-alerts",
  "schedule": "*/15 * * * *"
}
```

### 5. Redeploy

After setting environment variables:
1. Go to the **Deployments** tab
2. Click the three dots on the latest deployment
3. Select **Redeploy**

## Troubleshooting

### Common Issues

#### 404 Errors for Static Assets
- Ensure the deployment completed successfully
- Check the build logs for any errors
- Verify the `outputDirectory` in `vercel.json`

#### 401 Unauthorized API Errors
- Verify `OPENROUTER_API_KEY` is set correctly
- Check `JWT_SECRET` is configured
- Ensure `CRON_SECRET` matches in cron job headers

#### 500 Internal Server Errors
- Check function logs in Vercel dashboard
- Verify all required environment variables are set
- Ensure KV database is properly connected

#### "Failed to check environment" Error
- Verify KV database is created and connected
- Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Ensure the app can reach external APIs

### Debugging Steps

1. **Check Build Logs**: Vercel Dashboard → Your Project → Deployments → View Build Logs
2. **Check Function Logs**: Vercel Dashboard → Your Project → Functions → View Logs
3. **Verify Environment Variables**: Settings → Environment Variables
4. **Test API Endpoints**: Use the Vercel dashboard to test individual functions

## Performance Optimization

1. **Enable Vercel Analytics**: Automatically tracks Web Vitals
2. **Configure Edge Runtime**: For faster API responses
3. **Set up CDN**: Add `CDN_URL` for static asset caching
4. **Monitor Usage**: Keep track of KV operations and AI API calls

## Security Best Practices

1. **Rotate Secrets Regularly**: Update `JWT_SECRET` and `CRON_SECRET` periodically
2. **Limit API Key Permissions**: Use read-only keys where possible
3. **Enable Vercel Firewall**: Protect against common attacks
4. **Monitor Logs**: Regularly check for suspicious activity

## Cost Considerations

1. **KV Storage**: Free tier includes 30k requests/month
2. **Serverless Functions**: Free tier includes 100GB-hours
3. **AI API Costs**: Monitor OpenRouter usage
4. **Email Costs**: Resend free tier includes 3,000 emails/month

## Support

- Check the [GitHub Issues](https://github.com/your-repo/policydiff/issues)
- Review Vercel's [troubleshooting guide](https://vercel.com/docs/troubleshooting)
- Contact support with deployment logs and error messages