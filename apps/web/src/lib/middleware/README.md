# API Middleware System

This directory contains a comprehensive middleware system for securing and managing API endpoints.

## Features

### 1. Rate Limiting
- Configurable rate limits per endpoint type
- User-based and IP-based limiting
- Redis/Vercel KV backed for distributed systems
- Automatic retry-after headers

### 2. Security
- CORS configuration
- Content Security Policy (CSP)
- HSTS, X-Frame-Options, and other security headers
- Request size limiting
- Attack pattern detection (SQL injection, XSS, path traversal)
- IP-based access control

### 3. API Key Management
- Generate and manage API keys
- Permission-based access control
- Usage tracking and analytics
- Key rotation and expiration

## Usage

### Basic Usage

```typescript
import { middleware } from '@/lib/middleware'

// Protected API endpoint
export const GET = middleware.protectedAPI(async (request) => {
  return NextResponse.json({ data: 'Protected data' })
})

// AI endpoint with strict rate limiting
export const POST = middleware.aiAPI(async (request) => {
  const body = await request.json()
  // Process AI request...
  return NextResponse.json({ result: 'AI response' })
})
```

### Custom Configuration

```typescript
import { composeMiddleware } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  return composeMiddleware(
    request,
    {
      rateLimit: { 
        enabled: true, 
        type: 'api' // or 'ai', 'search', 'export', 'webhook'
      },
      security: { 
        enabled: true,
        checkIP: true,
        maxRequestSize: 1048576 // 1MB
      },
      apiKey: { 
        enabled: true,
        requiredPermission: 'write' 
      }
    },
    async (req) => {
      // Your handler logic
      return NextResponse.json({ success: true })
    }
  )
}
```

## Rate Limits

| Endpoint Type | Requests | Window |
|--------------|----------|---------|
| AI           | 10       | 1 min   |
| API          | 60       | 1 min   |
| Search       | 30       | 1 min   |
| Auth         | 5        | 15 min  |
| Export       | 10       | 1 hour  |
| Webhook      | 100      | 1 min   |

## API Key Permissions

- `read` - Read access to data
- `write` - Create/update operations
- `delete` - Delete operations
- `analytics` - Access to analytics data
- `export` - Export data
- `webhook` - Manage webhooks
- `admin` - Full administrative access

## Security Headers

The middleware automatically applies these security headers:

- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

## API Key Management

### Creating an API Key

```bash
POST /api/user/api-keys
{
  "name": "My API Key",
  "permissions": ["read", "analytics"],
  "expiresInDays": 90
}
```

### Using an API Key

Include the key in your requests:

```bash
# Header
X-API-Key: pk_your_api_key_here

# Query parameter
?api_key=pk_your_api_key_here
```

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2024-01-15T10:30:00Z
Retry-After: 30 (only on 429 responses)
```

## Error Responses

### Rate Limit Exceeded (429)
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 30
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### Forbidden (403)
```json
{
  "error": "Access denied",
  "message": "Your IP address is not allowed"
}
```

### Request Too Large (413)
```json
{
  "error": "Request too large",
  "message": "The request body exceeds the maximum allowed size"
}
```

## Best Practices

1. **Use appropriate rate limits** - Choose the right rate limiter for your endpoint
2. **Implement retries** - Respect the Retry-After header
3. **Monitor usage** - Track your API key usage to avoid hitting limits
4. **Rotate keys regularly** - Use the rotation endpoint to refresh keys
5. **Secure your keys** - Never expose API keys in client-side code
6. **Handle errors gracefully** - Implement proper error handling for all status codes