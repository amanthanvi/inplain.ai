# ADR-002: Scrapy Microservice Architecture

## Status
Accepted

## Date
2025-06-20

## Context
PolicyDiff needs to scrape privacy policies from hundreds of websites, including JavaScript-heavy sites and PDFs. The scraping component must be reliable, scalable, and isolated from the main application to handle failures gracefully.

## Decision
We will implement the scraping functionality as a separate Python microservice using Scrapy 2.13.2 with Playwright integration.

## Rationale

### Separation of Concerns
- Isolates scraping logic from the web application
- Allows independent scaling and deployment
- Reduces blast radius of scraping failures

### Technology Fit
- **Scrapy**: Battle-tested framework for large-scale web scraping
- **Playwright**: Handles JavaScript-heavy sites and modern web apps
- **Python**: Rich ecosystem for text processing and PDF handling

### Reliability
- Built-in retry mechanisms and error handling
- Configurable rate limiting and politeness policies
- Robust middleware system for custom behaviors

### Scalability
- Horizontal scaling through container orchestration
- Asynchronous processing with Twisted
- Efficient resource utilization

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Edge Cron     │───▶│   Redis Queue   │◀───│  Scrapy Worker  │
│   (Scheduler)   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Vercel KV      │    │  Vercel Blob    │
                       │  (Metadata)     │    │  (Snapshots)    │
                       └─────────────────┘    └─────────────────┘
```

## Implementation Details

### Core Components
- **Spider**: `packages/scraper/spiders/policy_spider.py`
- **Middlewares**: User-agent rotation, Playwright integration
- **Pipelines**: Validation, storage, notification
- **Docker**: Containerized deployment with Playwright dependencies

### Key Features
- Automatic content type detection (HTML, PDF, text)
- Smart policy page identification
- Configurable crawl intervals per site
- Content deduplication via SHA-256 hashing

## Alternatives Considered

### Puppeteer + Node.js
- **Pros**: JavaScript ecosystem consistency
- **Cons**: Less mature scraping ecosystem, memory overhead

### Beautiful Soup + Requests
- **Pros**: Simple, lightweight
- **Cons**: No JavaScript support, limited scalability features

### Commercial Scraping Service
- **Pros**: Fully managed, handles anti-bot measures
- **Cons**: High costs, less control, potential compliance issues

## Trade-offs

### Benefits
- Specialized tooling for web scraping challenges
- Proven scalability for large crawling operations
- Rich middleware ecosystem
- Excellent error handling and retry logic

### Drawbacks
- Additional language/runtime to maintain
- Container orchestration complexity
- Network communication between services

## Monitoring and Operations
- Structured JSON logging for observability
- Prometheus metrics via custom middleware
- Health checks for container orchestration
- Automatic restarts on failure

## Security Considerations
- Configurable user agents and rate limiting
- Respect for robots.txt
- No storage of sensitive data in logs
- Secure communication with storage backends