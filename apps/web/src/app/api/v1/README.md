# InPlain.AI API v1

## Overview

The InPlain.AI API provides programmatic access to privacy policy analysis, monitoring, and management features. This RESTful API enables developers to integrate privacy intelligence into their applications.

## Authentication

All API requests require authentication using an API key. Include your API key in the `x-api-key` header:

```http
x-api-key: pk_your_api_key_here
```

## Base URL

```
https://inplain.ai/api/v1
```

## Available Endpoints

### Companies

- `GET /companies/{slug}` - Get company information
- `GET /companies/{slug}/policies` - Get company privacy policies  
- `GET /companies/{slug}/score` - Get privacy score
- `GET /companies/{slug}/changes` - Get policy change history

### Policy Analysis

- `POST /policies/summarize` - Generate AI-powered policy summary

### Change Monitoring

- `GET /changes/recent` - Get recent policy changes across all companies

### Watchlist Management

- `GET /watchlist` - Get user watchlists
- `POST /watchlist` - Create watchlist or add/remove companies

### Notification Settings

- `GET /notifications/settings` - Get notification preferences
- `PUT /notifications/settings` - Update notification preferences

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "metadata": {
    "timestamp": "2024-01-20T12:00:00Z",
    "version": "1.0"
  }
}
```

Error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional error details */ }
}
```

## Rate Limiting

- Standard: 1,000 requests/day
- Pro: 10,000 requests/day  
- Enterprise: Custom limits

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Example Usage

### Get Company Information

```bash
curl -H "x-api-key: YOUR_KEY" \
  https://inplain.ai/api/v1/companies/facebook
```

### Summarize a Privacy Policy

```bash
curl -X POST \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "policyText": "Privacy policy text here...",
    "options": {
      "targetAudience": "general"
    }
  }' \
  https://inplain.ai/api/v1/policies/summarize
```

### Get Recent Changes

```bash
curl -H "x-api-key: YOUR_KEY" \
  "https://inplain.ai/api/v1/changes/recent?limit=10&severity=critical"
```

### Add Company to Watchlist

```bash
curl -X POST \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "companySlug": "google",
    "tags": ["search", "advertising"]
  }' \
  https://inplain.ai/api/v1/watchlist
```

## SDKs

Official SDKs are available for:
- JavaScript/TypeScript
- Python
- Ruby
- Go

## Support

- Documentation: https://inplain.ai/api/v1/docs
- Email: api-support@inplain.ai
- Status: https://status.inplain.ai

## Changelog

### v1.0.0 (2024-01-20)
- Initial API release
- Company information endpoints
- Policy summarization
- Change monitoring
- Watchlist management
- Notification preferences