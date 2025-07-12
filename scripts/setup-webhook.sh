#!/bin/bash

# Webhook Setup Script for Inplain.AI
# This script helps configure the webhook integration between Render and Vercel

set -e

echo "🔧 Inplain.AI Webhook Setup"
echo "=========================="
echo

# Function to generate secure key
generate_key() {
    openssl rand -hex 32
}

# Function to test webhook endpoint
test_webhook() {
    local api_key=$1
    local webhook_url=$2
    
    echo "Testing webhook endpoint..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$webhook_url" \
        -H "X-API-Key: $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "job_id": "test-'$(date +%s)'",
            "status": "completed",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "data": {
                "company_slug": "test-company",
                "url": "https://example.com/privacy",
                "content": "Test webhook content",
                "content_type": "html",
                "content_hash": "test-hash-'$(date +%s)'",
                "content_length": 20,
                "scraped_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
            }
        }')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Webhook test successful!"
        echo "Response: $body"
    else
        echo "❌ Webhook test failed with status $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local api_key=$1
    local api_url=$2
    
    echo "Testing API endpoint..."
    
    snapshot_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$api_url/api/snapshots/test-company" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "id": "'$snapshot_id'",
            "slug": "test-company",
            "url": "https://example.com/privacy",
            "capturedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "contentHash": "test-hash-'$(date +%s)'",
            "contentLength": 20,
            "contentType": "html",
            "content": "Test API content"
        }')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "✅ API test successful!"
        echo "Response: $body"
    else
        echo "❌ API test failed with status $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Main setup flow
main() {
    echo "This script will help you set up the webhook integration."
    echo

    # Check if keys are already set
    if [ -n "$VERCEL_API_KEY" ] && [ -n "$SCRAPER_API_KEY" ]; then
        echo "📌 Detected existing configuration:"
        echo "   VERCEL_API_KEY: ${VERCEL_API_KEY:0:10}..."
        echo "   SCRAPER_API_KEY: ${SCRAPER_API_KEY:0:10}..."
        echo
        read -p "Use existing keys? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            VERCEL_API_KEY=""
            SCRAPER_API_KEY=""
        fi
    fi

    # Generate or use existing VERCEL_API_KEY
    if [ -z "$VERCEL_API_KEY" ]; then
        echo "📝 VERCEL_API_KEY not found."
        echo "   Using generated key: 56a44af2af81c84a41e03a9e14058f5451314d1c59cc8e821270777916f4036c"
        VERCEL_API_KEY="56a44af2af81c84a41e03a9e14058f5451314d1c59cc8e821270777916f4036c"
    fi

    # Generate or use existing SCRAPER_API_KEY
    if [ -z "$SCRAPER_API_KEY" ]; then
        echo "🔐 Generating SCRAPER_API_KEY..."
        SCRAPER_API_KEY=$(generate_key)
        echo "   Generated: $SCRAPER_API_KEY"
    fi

    echo
    echo "🚀 Configuration Summary"
    echo "======================="
    echo
    echo "Add these to Vercel environment variables:"
    echo "  VERCEL_API_KEY=$VERCEL_API_KEY"
    echo "  SCRAPER_API_KEY=$SCRAPER_API_KEY"
    echo
    echo "Add these to Render environment variables:"
    echo "  VERCEL_API_URL=https://inplain.ai"
    echo "  VERCEL_API_KEY=$VERCEL_API_KEY"
    echo "  WEBHOOK_URL=https://inplain.ai/api/webhooks/scraper"
    echo "  WEBHOOK_API_KEY=$SCRAPER_API_KEY"
    echo "  SCRAPER_API_KEY=$SCRAPER_API_KEY"
    echo

    # Ask if user wants to test
    read -p "Would you like to test the endpoints? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo
        echo "🧪 Running Tests"
        echo "==============="
        echo
        
        # Test webhook
        if ! test_webhook "$SCRAPER_API_KEY" "https://inplain.ai/api/webhooks/scraper"; then
            echo "⚠️  Webhook test failed. Make sure the API key is configured in Vercel."
        fi
        
        echo
        
        # Test API
        if ! test_api "$VERCEL_API_KEY" "https://inplain.ai"; then
            echo "⚠️  API test failed. Make sure the API key is configured in Vercel."
        fi
    fi
    
    echo
    echo "✨ Setup complete!"
    echo
    echo "Next steps:"
    echo "1. Add the environment variables to Vercel and Render"
    echo "2. Restart the Render service"
    echo "3. Trigger a test scrape to verify the integration"
    echo
    echo "For more details, see WEBHOOK_SETUP.md"
}

# Run main function
main