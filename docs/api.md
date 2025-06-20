# PolicyDiff API Reference

## Overview

The PolicyDiff API provides access to policy change data, diff generation, and AI summaries. All endpoints are built on Vercel Edge Functions for optimal performance.

## Base URL

- **Production**: `https://policydiff.com/api`
- **Development**: `http://localhost:3000/api`

## Authentication

Most endpoints are public and don't require authentication. Administrative endpoints use API keys.

```http
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Get Diff

Generates or retrieves a diff between the latest two snapshots for a company.

```http
GET /diff/{slug}
```

**Parameters:**
- `slug` (path): Company identifier (e.g., "google", "facebook")
- `from` (query, optional): Source snapshot ID
- `to` (query, optional): Target snapshot ID

**Response:**
```json
{
  "diff": {
    "id": "uuid",
    "slug": "google",
    "fromSnapshotId": "uuid",
    "toSnapshotId": "uuid",
    "createdAt": "2025-06-20T10:00:00Z",
    "changeCount": 15,
    "changeType": "moderate",
    "additions": 10,
    "deletions": 5,
    "diffBlobKey": "diffs/google/2025-06-20T10:00:00Z.json"
  },
  "htmlDiff": "<ins class=\"diff-addition\">new text</ins>...",
  "fromSnapshot": {
    "id": "uuid",
    "capturedAt": "2025-06-20T09:00:00Z"
  },
  "toSnapshot": {
    "id": "uuid", 
    "capturedAt": "2025-06-20T10:00:00Z"
  }
}
```

### Generate Summary

Creates or retrieves an AI-powered summary of policy changes using OpenRouter AI models.

```http
POST /summary/{slug}
```

**Request Body:**
```json
{
  "diffId": "uuid",
  "model": "google/gemini-2.5-flash-preview-05-20",
  "force": false
}
```

**Available Models:**
- `google/gemini-2.5-flash-preview-05-20` (default, fastest)
- `meta-llama/llama-3.3-70b-instruct`
- `openai/gpt-4o-mini`
- `anthropic/claude-3-haiku-20240307`
- `google/gemma-2-9b-it`
- And 5 more legal-specialized models

**Response:**
```json
{
  "summary": {
    "id": "uuid",
    "diffId": "uuid",
    "createdAt": "2025-06-20T10:01:00Z",
    "model": "google/gemini-2.5-flash-preview-05-20",
    "summary": "Google updated their data retention policies...",
    "highlights": [
      "Data retention reduced to 18 months",
      "New opt-out mechanisms added"
    ],
    "riskLevel": "medium",
    "categories": ["data_retention", "user_rights"],
    "tokensUsed": 1500,
    "cached": false
  },
  "cached": false
}
```

### Real-time Feed

Server-sent events stream of recent policy changes.

```http
GET /feed
```

**Response Stream:**
```
data: {"type":"connected","timestamp":"2025-06-20T10:00:00Z"}

data: {"type":"diff","slug":"google","diff":{...},"summary":{...}}

data: {"type":"error","message":"Failed to fetch updates"}
```

### Cron Monitor

Triggers the policy monitoring job (protected endpoint).

```http
GET /cron/monitor
```

**Headers:**
```http
Authorization: Bearer CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "checked": 5,
  "successful": 4,
  "failed": 1,
  "timestamp": "2025-06-20T10:00:00Z"
}
```

## Data Types

### Company
```typescript
{
  slug: string
  name: string
  url: string
  category?: string
  checkInterval: number  // seconds
  lastChecked?: string   // ISO datetime
  active: boolean
}
```

### SnapshotMeta
```typescript
{
  id: string            // UUID
  slug: string
  url: string
  capturedAt: string    // ISO datetime
  blobKey: string
  contentHash: string   // SHA-256
  contentLength: number
  contentType: 'html' | 'pdf' | 'text'
  headers: Record<string, string>
  status: 'pending' | 'processed' | 'failed'
  error?: string
}
```

### DiffMeta
```typescript
{
  id: string            // UUID
  slug: string
  fromSnapshotId: string
  toSnapshotId: string
  createdAt: string     // ISO datetime
  changeCount: number
  changeType: 'minor' | 'moderate' | 'major'
  additions: number
  deletions: number
  diffBlobKey: string
  summaryId?: string
}
```

### Summary
```typescript
{
  id: string            // UUID
  diffId: string
  createdAt: string     // ISO datetime
  model: string
  prompt: string
  summary: string
  highlights: string[]
  riskLevel: 'low' | 'medium' | 'high'
  categories: Array<
    'data_collection' | 'data_sharing' | 'data_retention' |
    'user_rights' | 'security' | 'cookies' | 'third_parties' |
    'children' | 'other'
  >
  tokensUsed: number
  cached: boolean
}
```

## Error Responses

All errors return a JSON object with an error message:

```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

- Public endpoints: 60 requests per minute per IP
- AI summary endpoints: 60 requests per minute (shared across all models)
- Authenticated endpoints: 1000 requests per minute per API key
- Cron endpoints: 1 request per minute

Rate limit headers:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

## AI Model Selection

PolicyDiff uses OpenRouter to provide access to multiple AI models optimized for legal document analysis:

### Available Models (sorted by cost)

1. **Google Gemini 2.5 Flash** (default) - $0.00015/1k input, $0.0006/1k output
2. **Meta Llama 3.3 70B Instruct** - $0.00015/1k input, $0.0015/1k output  
3. **OpenAI GPT-4o Mini** - $0.00015/1k input, $0.0006/1k output
4. **Anthropic Claude 3 Haiku** - $0.00025/1k input, $0.00125/1k output
5. **Google Gemma 2 9B** - $0.0002/1k input, $0.0002/1k output

All models are specialized for legal document analysis and provide consistent summary formats.

## Caching

Responses are cached for optimal performance:

- **Diffs**: 5 minutes (300 seconds)
- **AI Summaries**: 24 hours (86400 seconds) - cached by model and diff combination
- **Static data**: 24 hours

Cache headers:
```http
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

**AI Summary Caching:**
- Summaries are cached per model-diff combination
- Rate limiting prevents excessive API calls to OpenRouter
- Cache invalidation occurs automatically after 24 hours

## Webhooks (Coming Soon)

Subscribe to real-time notifications of policy changes:

```http
POST /webhooks/subscribe
```

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["diff.created", "summary.generated"],
  "filter": {
    "slugs": ["google", "facebook"],
    "riskLevel": ["medium", "high"]
  }
}
```

## SDKs

### JavaScript/TypeScript

```bash
npm install @policydiff/sdk
```

```typescript
import { PolicyDiffClient } from '@policydiff/sdk'

const client = new PolicyDiffClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://policydiff.com/api'
})

const diff = await client.getDiff('google')
const summary = await client.generateSummary('google', diff.id)
```

### Python

```bash
pip install policydiff
```

```python
from policydiff import PolicyDiffClient

client = PolicyDiffClient(api_key='your-api-key')
diff = client.get_diff('google')
summary = client.generate_summary('google', diff['id'])
```

## Examples

### Monitor Policy Changes

```javascript
// Subscribe to real-time updates
const eventSource = new EventSource('/api/feed')

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.type === 'diff') {
    console.log(`${data.slug} policy updated:`, data.diff)
  }
}
```

### Generate Batch Summaries

```bash
#!/bin/bash
for company in google facebook amazon microsoft apple; do
  curl -X POST "https://policydiff.com/api/summary/$company" \
    -H "Content-Type: application/json" \
    -d '{"force": true}'
done
```

### Backfill Historical Data

```bash
# Run the backfill script
cd packages/scraper
python scripts/backfill.py --days 30 --companies ../../companies.csv
```