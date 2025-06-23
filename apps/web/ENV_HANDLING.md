# Environment Variable Handling

This document describes how the application handles missing environment variables and provides graceful fallbacks.

## Overview

The application is designed to work in three modes:
- **Production**: Full functionality with all services configured
- **Demo**: Limited functionality with mock data when services are not configured
- **Development**: Full functionality with dev auth bypass and helpful error messages

## Key Environment Variables

### Required for Full Functionality

1. **KV Storage** (Vercel KV)
   - `KV_REST_API_URL`: Vercel KV store REST API URL
   - `KV_REST_API_TOKEN`: Vercel KV authentication token
   - Without these: In-memory storage is used (data won't persist)

2. **AI Service** (OpenRouter)
   - `OPENROUTER_API_KEY`: API key for AI analysis
   - Without this: Mock AI summaries are returned

3. **Blob Storage** (Vercel Blob)
   - `BLOB_READ_WRITE_TOKEN`: Token for blob storage
   - Without this: Large content storage is limited

### Optional Configuration

- `DEFAULT_AI_MODEL`: AI model to use (defaults to `google/gemini-2.5-flash-preview-05-20`)
- `CRON_SECRET`: Secret for authenticating cron jobs
- `NEXT_PUBLIC_DEV_AUTH_BYPASS`: Enable dev auth in development

## API Behavior with Missing Variables

### `/api/snapshot/[slug]`
- **With KV configured**: Returns real snapshot data from storage
- **Without KV**: Returns mock snapshot data with a warning header
- **Authentication**: Required in production, bypassed in dev with auth bypass

### `/api/summary/[slug]`
- **With AI + KV configured**: Generates real AI summaries
- **With AI only**: Returns error (needs storage for diffs)
- **Without AI**: Returns mock summary with demo warning
- **Without KV**: Returns 503 error with helpful message

### `/api/health`
- Always returns 200 in development mode
- Returns 503 if critical services are missing in production
- Provides detailed service status and configuration warnings

## Error Messages

The API routes provide clear, actionable error messages:

```json
{
  "error": "Storage service not configured",
  "message": "Cannot generate summaries without storage. Please configure KV_REST_API_URL and KV_REST_API_TOKEN.",
  "code": "STORAGE_NOT_CONFIGURED"
}
```

## Development Mode

In development (`NODE_ENV=development`):
- Authentication can be bypassed with `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`
- More detailed error messages are provided
- Mock data is clearly marked with headers

## Testing

Run the test script to verify environment handling:

```bash
node scripts/test-api-routes.js
```

This will test all main API routes and report their behavior with current configuration.

## Headers

The API adds helpful headers to indicate the current mode:
- `X-Mock-Data: true` - When returning mock data
- `X-App-Mode: demo|development|production` - Current application mode
- `X-Dev-Auth: enabled|disabled` - Dev auth bypass status

## Best Practices

1. **Local Development**: Set `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` for easier testing
2. **Demo Deployment**: Deploy without API keys for a working demo with mock data
3. **Production**: Configure all environment variables for full functionality
4. **Error Handling**: Check response headers and error codes for proper handling