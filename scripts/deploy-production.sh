#!/bin/bash

# Production Deployment Script for Inplain.AI
# 
# This script handles the complete production deployment process
# including health checks, rollback capability, and monitoring

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV=${DEPLOY_ENV:-"production"}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=10

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Running pre-deployment checks..."
    
    # Check Node version
    node_version=$(node -v)
    log "Node version: $node_version"
    
    # Check npm version
    npm_version=$(npm -v)
    log "npm version: $npm_version"
    
    # Verify environment variables
    log "Verifying environment variables..."
    required_vars=(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        "CLERK_SECRET_KEY"
        "OPENROUTER_API_KEY"
        "KV_REST_API_URL"
        "KV_REST_API_TOKEN"
        "SENTRY_DSN"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log "All required environment variables are set"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    # Run unit tests
    npm run test || {
        error "Unit tests failed"
        return 1
    }
    
    # Run type checking
    npm run typecheck || {
        error "Type checking failed"
        return 1
    }
    
    # Run linting
    npm run lint || {
        error "Linting failed"
        return 1
    }
    
    log "All tests passed"
}

# Build application
build_application() {
    log "Building application for $DEPLOY_ENV..."
    
    # Clean previous builds
    rm -rf .next
    
    # Build with production configuration
    NODE_ENV=production npm run build || {
        error "Build failed"
        return 1
    }
    
    # Check build output
    if [ ! -d ".next" ]; then
        error "Build directory .next not found"
        return 1
    fi
    
    log "Build completed successfully"
}

# Deploy to Vercel
deploy_to_vercel() {
    log "Deploying to Vercel..."
    
    # Get current deployment URL for rollback
    PREVIOUS_DEPLOYMENT=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
    
    if [ "$DEPLOY_ENV" = "production" ]; then
        # Deploy to production
        DEPLOYMENT_URL=$(vercel --prod --yes | tail -n 1)
    else
        # Deploy to preview
        DEPLOYMENT_URL=$(vercel --yes | tail -n 1)
    fi
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        error "Deployment failed - no URL returned"
        return 1
    fi
    
    log "Deployed to: $DEPLOYMENT_URL"
    echo "$DEPLOYMENT_URL" > .deployment-url
}

# Health check
health_check() {
    local url=$1
    log "Running health checks on $url..."
    
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        log "Health check attempt $i/$HEALTH_CHECK_RETRIES..."
        
        # Basic connectivity check
        if curl -sf "$url/api/health" > /dev/null; then
            # Detailed health check
            health_response=$(curl -s "$url/api/health")
            health_status=$(echo "$health_response" | jq -r '.status' 2>/dev/null || echo "unknown")
            
            if [ "$health_status" = "healthy" ]; then
                log "Health check passed"
                return 0
            elif [ "$health_status" = "degraded" ]; then
                warning "Service is degraded but operational"
                return 0
            else
                warning "Health check returned status: $health_status"
            fi
        else
            warning "Health check failed to connect"
        fi
        
        if [ $i -lt $HEALTH_CHECK_RETRIES ]; then
            log "Waiting $HEALTH_CHECK_DELAY seconds before retry..."
            sleep $HEALTH_CHECK_DELAY
        fi
    done
    
    error "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Performance check
performance_check() {
    local url=$1
    log "Running performance checks..."
    
    # Check main page load time
    load_time=$(curl -o /dev/null -s -w '%{time_total}' "$url")
    log "Main page load time: ${load_time}s"
    
    # Check if load time is acceptable (under 3 seconds)
    if (( $(echo "$load_time > 3" | bc -l) )); then
        warning "Page load time exceeds 3 seconds"
    fi
    
    # Check API response time
    api_time=$(curl -o /dev/null -s -w '%{time_total}' "$url/api/companies")
    log "API response time: ${api_time}s"
    
    if (( $(echo "$api_time > 1" | bc -l) )); then
        warning "API response time exceeds 1 second"
    fi
}

# Rollback deployment
rollback() {
    if [ -z "$PREVIOUS_DEPLOYMENT" ] || [ "$PREVIOUS_DEPLOYMENT" = "null" ]; then
        error "No previous deployment found for rollback"
        return 1
    fi
    
    log "Rolling back to previous deployment: $PREVIOUS_DEPLOYMENT"
    
    # Alias previous deployment to production
    vercel alias set "$PREVIOUS_DEPLOYMENT" "$DEPLOY_ENV" --yes || {
        error "Rollback failed"
        return 1
    }
    
    log "Rollback completed"
}

# Post-deployment tasks
post_deploy() {
    local deployment_url=$1
    log "Running post-deployment tasks..."
    
    # Update monitoring
    log "Updating monitoring configuration..."
    
    # Send deployment notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"🚀 Deployment successful\",
                \"attachments\": [{
                    \"color\": \"good\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$DEPLOY_ENV\", \"short\": true},
                        {\"title\": \"URL\", \"value\": \"$deployment_url\", \"short\": true},
                        {\"title\": \"Time\", \"value\": \"$(date)\", \"short\": false}
                    ]
                }]
            }" || warning "Failed to send Slack notification"
    fi
    
    # Warm up cache
    log "Warming up cache..."
    curl -s "$deployment_url/api/companies" > /dev/null
    
    # Create deployment record
    echo "{
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"environment\": \"$DEPLOY_ENV\",
        \"url\": \"$deployment_url\",
        \"commit\": \"$(git rev-parse HEAD)\",
        \"branch\": \"$(git rev-parse --abbrev-ref HEAD)\"
    }" > ".deployments/$(date +%Y%m%d-%H%M%S).json"
    
    log "Post-deployment tasks completed"
}

# Main deployment flow
main() {
    log "Starting deployment to $DEPLOY_ENV..."
    
    # Create deployment directory if it doesn't exist
    mkdir -p .deployments
    
    # Pre-deployment checks
    pre_deploy_checks || exit 1
    
    # Run tests
    if ! run_tests; then
        error "Tests failed, aborting deployment"
        exit 1
    fi
    
    # Build application
    if ! build_application; then
        error "Build failed, aborting deployment"
        exit 1
    fi
    
    # Deploy
    if ! deploy_to_vercel; then
        error "Deployment failed"
        exit 1
    fi
    
    # Get deployment URL
    DEPLOYMENT_URL=$(cat .deployment-url)
    
    # Health checks
    if ! health_check "$DEPLOYMENT_URL"; then
        error "Health checks failed"
        
        if [ "$ROLLBACK_ON_FAILURE" = true ] && [ "$DEPLOY_ENV" = "production" ]; then
            warning "Attempting rollback..."
            if rollback; then
                log "Rollback successful"
            else
                error "Rollback failed - manual intervention required"
            fi
        fi
        
        exit 1
    fi
    
    # Performance checks
    performance_check "$DEPLOYMENT_URL"
    
    # Post-deployment tasks
    post_deploy "$DEPLOYMENT_URL"
    
    log "Deployment completed successfully!"
    log "URL: $DEPLOYMENT_URL"
    
    # Clean up
    rm -f .deployment-url
}

# Run main function
main "$@"