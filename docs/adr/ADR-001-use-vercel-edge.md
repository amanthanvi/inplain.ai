# ADR-001: Use Vercel Edge Functions for API Layer

## Status
Accepted

## Date
2025-06-20

## Context
PolicyDiff needs a scalable API layer that can handle real-time diff generation and AI-powered summaries while maintaining sub-300ms response times. The system must be cost-effective for monitoring 500+ sites with daily checks.

## Decision
We will use Vercel Edge Functions as the primary API layer for PolicyDiff.

## Rationale

### Performance
- Edge Functions run on Vercel's global edge network, providing sub-100ms cold starts
- V8 isolates offer superior performance for CPU-intensive diff operations
- Geographic distribution ensures low latency worldwide

### Cost Efficiency
- Pay-per-request pricing aligns with our usage patterns
- Edge runtime is more cost-effective than traditional serverless for our workload
- Built-in caching reduces redundant processing

### Developer Experience
- TypeScript-first with excellent tooling
- Seamless integration with Next.js frontend
- Built-in deployment and monitoring

### Scalability
- Automatic scaling from 0 to global scale
- No cold start penalties after initial request
- Handles traffic spikes gracefully

## Alternatives Considered

### AWS Lambda
- **Pros**: Mature ecosystem, extensive AWS integrations
- **Cons**: Higher cold start latency, more complex deployment, higher costs at scale

### Cloudflare Workers
- **Pros**: Great performance, competitive pricing
- **Cons**: Limited runtime compatibility, smaller ecosystem

### Traditional Node.js Server
- **Pros**: Full control, familiar patterns
- **Cons**: Infrastructure overhead, scaling complexity, higher operational costs

## Implementation Details
- API routes in `packages/api/src/routes/`
- Edge runtime configuration in `vercel.json`
- Shared utilities in `packages/shared`

## Consequences

### Positive
- Excellent performance for real-time diff generation
- Cost-effective scaling
- Simplified deployment and operations
- Strong TypeScript integration

### Negative
- Vendor lock-in to Vercel platform
- Edge runtime limitations (no file system, limited libraries)
- Learning curve for edge-specific patterns

## Monitoring
- Track response times via Vercel Analytics
- Monitor error rates and edge cache hit ratios
- Set up alerts for performance degradation