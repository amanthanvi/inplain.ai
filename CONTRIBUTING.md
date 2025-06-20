# Contributing to PolicyDiff

Thank you for your interest in contributing to PolicyDiff! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- pnpm 8+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/policydiff/policydiff.git
   cd policydiff
   ```

2. **Install dependencies**
   ```bash
   make install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development servers**
   ```bash
   make dev
   ```

5. **Run tests**
   ```bash
   make test
   ```

## Branch Strategy

- **main**: Production branch
- **claude/***: Auto-generated PRs from Claude Code
- **feat/***: Human-developed features

## Conventional Commits

- `feat: ✨ new feature`
- `fix: 🐛 bug fix`
- `chore(ci): 🔧 meta changes`
- `docs: 📝 documentation updates`

## Architecture

PolicyDiff is built as a modern monorepo:

```
policydiff/
├─ apps/web/           # Next.js frontend
├─ packages/
│   ├─ api/            # Edge Functions API
│   ├─ scraper/        # Python Scrapy service
│   └─ shared/         # Shared TypeScript utilities
├─ infrastructure/     # Terraform IaC
└─ docs/              # Documentation
```

### Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **API**: Vercel Edge Functions, TypeScript
- **Scraper**: Python 3.12, Scrapy 2.13.2, Playwright
- **Storage**: Vercel KV, Vercel Blob
- **AI**: Anthropic Claude 4 Opus

## Development Guidelines

### Code Style
- **TypeScript**: ESLint + Prettier
- **Python**: Black + Ruff
- Run: `make lint`

### Testing
- **Frontend**: Vitest + Playwright
- **API**: Vitest with mocks
- **Scraper**: pytest with VCR.py
- Run: `make test && make e2e`

## Security

- Report security issues privately
- No secrets in code
- Use environment variables
- Follow OWASP guidelines

## Getting Help

- **Issues**: GitHub Issues
- **Email**: contact@policydiff.com

Thank you for contributing! 🚀
