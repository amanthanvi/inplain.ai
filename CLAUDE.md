# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Inplain.AI is a privacy policy monitoring platform that tracks changes in privacy policies and terms of service, providing AI-powered summaries. It's built as a monorepo using Turborepo with Next.js 15, Vercel Edge Functions, and Python Scrapy for scraping.

## Common Development Commands

### Primary Commands
```bash
# Development
npm run dev          # Start development server (Turbo)
make dev            # Start all services including Docker

# Building
npm run build       # Production build with Turbo

# Testing
npm run test        # Run Vitest unit tests
npm run test:coverage  # Tests with coverage (70% threshold)
npm run e2e         # Run Playwright E2E tests
make test           # Run all tests (JS + Python)

# Code Quality
npm run lint        # ESLint
npm run typecheck   # TypeScript checking
npm run format      # Prettier formatting
make lint           # All linters

# Utilities
npm run setup:env   # Interactive environment setup
npm run seed        # Seed database with test data
npm run cron:local  # Run monitoring cron locally
```

### Python Scraper Commands
```bash
cd packages/scraper
pip install -r requirements.txt
python crawl.py --sources ../../companies.csv
pytest                # Run Python tests
```

## Architecture

### Monorepo Structure
```
apps/
  web/                 # Next.js 15 application
    src/
      app/            # App Router (pages, API routes)
        api/          # Edge API endpoints
      components/     # Feature-based components
        ui/           # Reusable UI primitives
      hooks/          # Custom React hooks
      lib/            # Services and utilities
        
packages/
  api/                # Shared API logic
  scraper/            # Python Scrapy service
  shared/             # Shared types and utilities
```

### Key Technologies
- **Frontend**: Next.js 15 App Router, React 19, Tailwind CSS v4 RC, Radix UI, Framer Motion
- **State**: Zustand for client state, SWR for data fetching
- **Backend**: Vercel Edge Functions, Clerk auth, Vercel KV (Redis), Vercel Blob storage
- **AI**: OpenRouter for multi-model support (Gemini, Claude, GPT)
- **Testing**: Vitest + React Testing Library, Playwright for E2E
- **Infrastructure**: Vercel deployment, Docker for local dev, Terraform for IaC

### API Architecture
- RESTful Edge API routes in `app/api/`
- Zod schemas for runtime validation
- Rate limiting with custom middleware
- Comprehensive error handling with boundaries

### Testing Strategy
- Unit tests co-located in `__tests__` directories
- Coverage requirements: 70% minimum
- E2E tests for critical user flows
- Visual regression with Playwright screenshots

### Performance Patterns
- `usePerformanceOptimization` hook for monitoring
- Request throttling and debouncing utilities
- Edge runtime for sub-300ms responses
- Optimistic UI updates with SWR

### Security
- CSP headers on all responses
- Environment variables via Vercel
- Clerk for authentication
- Input validation with Zod schemas

## Development Tips

### Running a Single Test
```bash
# Vitest
npm test -- path/to/file.test.ts
npm test -- --watch

# Playwright
npm run e2e -- --grep "test name"
```

### Working with the Scraper
The Python scraper is a separate service that handles JavaScript-heavy sites:
```bash
cd packages/scraper
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python crawl.py --test  # Test mode
```

### Environment Setup
Use the interactive setup for quick configuration:
```bash
npm run setup:env
```
Choose "Demo Mode" for development without API keys, or "Full Mode" for production features.

### Common API Endpoints
- `/api/health` - System health check
- `/api/companies/[slug]` - Company data and snapshots
- `/api/analysis` - AI-powered change analysis
- `/api/webhooks/*` - Clerk and payment webhooks