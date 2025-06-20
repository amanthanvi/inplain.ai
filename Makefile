.PHONY: help install dev lint test e2e build clean diff-backfill docker-up docker-down

# Default target
help:
	@echo "PolicyDiff Development Commands:"
	@echo "  make install        - Install all dependencies"
	@echo "  make dev           - Start development servers"
	@echo "  make lint          - Run all linters"
	@echo "  make test          - Run all tests"
	@echo "  make e2e           - Run E2E tests"
	@echo "  make build         - Build for production"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make diff-backfill - Backfill historical diffs"
	@echo "  make docker-up     - Start Docker services"
	@echo "  make docker-down   - Stop Docker services"

# Install dependencies
install:
	@echo "📦 Installing Node dependencies..."
	pnpm install
	@echo "🐍 Installing Python dependencies..."
	cd packages/scraper && pip install -r requirements.txt
	@echo "✅ Dependencies installed!"

# Development mode
dev: docker-up
	@echo "🚀 Starting development servers..."
	@trap 'make docker-down' EXIT; \
	pnpm run dev

# Linting
lint:
	@echo "🔍 Running ESLint..."
	pnpm run lint
	@echo "🎨 Running Prettier..."
	pnpm run format:check
	@echo "🐍 Running Python linters..."
	cd packages/scraper && ruff check . && black --check .
	@echo "✅ All linters passed!"

# Testing
test:
	@echo "🧪 Running JavaScript tests..."
	pnpm run test
	@echo "🐍 Running Python tests..."
	cd packages/scraper && pytest -v
	@echo "✅ All tests passed!"

# E2E Testing
e2e: docker-up
	@echo "🎭 Running Playwright E2E tests..."
	pnpm run e2e
	@make docker-down

# Production build
build:
	@echo "🏗️  Building for production..."
	pnpm run build
	@echo "🐍 Building scraper image..."
	cd packages/scraper && docker build -t policydiff-scraper:latest .
	@echo "✅ Build complete!"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf apps/web/.next
	rm -rf apps/web/out
	rm -rf packages/*/dist
	rm -rf packages/*/.turbo
	rm -rf node_modules
	rm -rf packages/scraper/__pycache__
	rm -rf packages/scraper/.pytest_cache
	find . -name "*.pyc" -delete
	@echo "✅ Clean complete!"

# Backfill historical diffs
diff-backfill:
	@echo "🔄 Starting diff backfill..."
	@cd packages/scraper && python scripts/backfill.py --days 30
	@echo "✅ Backfill complete!"

# Docker commands
docker-up:
	@echo "🐳 Starting Docker services..."
	docker-compose up -d
	@echo "⏳ Waiting for services to be healthy..."
	@sleep 5
	@echo "✅ Docker services ready!"

docker-down:
	@echo "🐳 Stopping Docker services..."
	docker-compose down
	@echo "✅ Docker services stopped!"

# CI target
ci: lint test
	@echo "✅ CI checks passed!"