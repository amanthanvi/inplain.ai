# PolicyDiff

> Track, diff, and understand privacy policy changes with AI-powered summaries

[![CI](https://github.com/yourusername/policydiff/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/policydiff/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## 🎯 Overview

PolicyDiff monitors public privacy policies and terms of service pages, automatically tracking changes and providing plain-language summaries of what changed and why it matters. Built on Vercel Edge Functions with Next.js 15 and Claude 4 Opus for intelligent analysis.

## 🏗️ Architecture

- **Frontend**: Next.js 15 (App Router) with Tailwind CSS v4 RC
- **API**: Vercel Edge Functions for sub-300ms responses
- **Scraper**: Python Scrapy 2.13.2 microservice for JS-heavy sites
- **Storage**: Vercel Blob (snapshots) + Vercel KV (metadata)
- **AI**: Claude 4 Opus for change summaries
- **Monitoring**: OpenTelemetry traces + Prometheus metrics

## 📁 Repository Structure

```
policydiff/
├─ apps/
│   └─ web/            # Next.js 15 UI
├─ packages/
│   ├─ api/            # Edge & serverless routes
│   ├─ scraper/        # Scrapy spider, CLI entry
│   └─ shared/         # Zod schemas & utils
├─ infrastructure/     # Terraform IaC
├─ prompts/            # Claude prompt library
├─ scripts/            # Helper scripts
└─ .github/            # CI/CD workflows
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ & pnpm 8+
- Python 3.12+
- Docker & Docker Compose
- Vercel CLI (`npm i -g vercel`)

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/policydiff.git
cd policydiff

# Install dependencies
pnpm install
pip install -r packages/scraper/requirements.txt

# Start development environment
make dev

# In another terminal, start the scraper
cd packages/scraper
python crawl.py --sources ../../companies.csv
```

### Using Dev Container

For a consistent development environment:

```bash
# Open in VS Code with Dev Containers extension
code .
# Then: Cmd/Ctrl+Shift+P → "Dev Containers: Reopen in Container"
```

## 🧪 Testing

```bash
# Run all tests
make test

# Unit tests only
pnpm test

# Python tests
pytest

# E2E tests
pnpm e2e

# Coverage report
pnpm test:coverage
```

## 🛠️ Make Targets

- `make dev` - Start all services in development mode
- `make lint` - Run ESLint, Prettier, and Python linters
- `make test` - Execute full test suite
- `make e2e` - Run Playwright E2E tests
- `make build` - Production build
- `make diff-backfill` - Backfill historical diffs

## 🔐 Security

- All secrets managed via Vercel environment variables
- CSP headers enforced on all responses
- OWASP Top 10 compliance
- SOC 2 ready architecture
- GDPR compliant with data deletion CLI

## 📊 Monitoring

- JSON structured logs to stdout
- OpenTelemetry traces exported to collector
- Prometheus metrics at `/metrics`
- Vercel Analytics integration

## 🚢 Deployment

Automatic deployment via Vercel on push to main:

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod

# Infrastructure updates
cd infrastructure
terraform plan
terraform apply
```

## 📖 Documentation

Full documentation available in `docs/`:

- [Architecture Decision Records](docs/adr/)
- [User Guide](docs/user-guide.md)
- [API Reference](docs/api.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the Apache License 2.0 - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with Claude 4 Opus by Anthropic
- Powered by Vercel Edge Functions
- UI components from shadcn/ui

---

**Questions?** Open an issue or reach out to the maintainers.
