#!/bin/bash

# End-to-End Pipeline Test Script
# Tests the complete data flow from scraping to frontend display

set -e

echo "🧪 Inplain.AI Pipeline Test"
echo "==========================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${VERCEL_API_URL:-https://inplain.ai}"
TEST_COMPANY="google"

# Function to check API health
check_health() {
    echo "1️⃣  Checking API health..."
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL/api/health")
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ API is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ API health check failed (status: $http_code)${NC}"
        return 1
    fi
}

# Function to check company data
check_company() {
    local slug=$1
    echo "2️⃣  Checking company data for '$slug'..."
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL/api/companies/$slug")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Company data found${NC}"
        echo "   Details: $(echo "$body" | jq -r '.name // "Unknown"') ($(echo "$body" | jq -r '.category // "Unknown"'))"
        return 0
    else
        echo -e "${RED}❌ Company not found (status: $http_code)${NC}"
        return 1
    fi
}

# Function to check snapshots
check_snapshots() {
    local slug=$1
    echo "3️⃣  Checking snapshots for '$slug'..."
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL/api/snapshot/$slug")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        snapshot_count=$(echo "$body" | jq -r '.snapshots | length // 0')
        if [ "$snapshot_count" -gt 0 ]; then
            echo -e "${GREEN}✅ Found $snapshot_count snapshot(s)${NC}"
            latest_date=$(echo "$body" | jq -r '.snapshots[0].capturedAt // "Unknown"')
            echo "   Latest: $latest_date"
            return 0
        else
            echo -e "${YELLOW}⚠️  No snapshots found${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to fetch snapshots (status: $http_code)${NC}"
        return 1
    fi
}

# Function to check metrics
check_metrics() {
    local slug=$1
    echo "4️⃣  Checking metrics for '$slug'..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/companies/metrics" \
        -H "Content-Type: application/json" \
        -d '{"companySlugs": ["'$slug'"]}')
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        metrics=$(echo "$body" | jq -r ".metrics.$slug")
        if [ "$metrics" != "null" ] && [ -z "$(echo "$metrics" | jq -r '.error // empty')" ]; then
            score=$(echo "$metrics" | jq -r '.privacyScore // "N/A"')
            grade=$(echo "$metrics" | jq -r '.grade // "N/A"')
            risk=$(echo "$metrics" | jq -r '.riskLevel // "N/A"')
            echo -e "${GREEN}✅ Metrics available${NC}"
            echo "   Score: $score | Grade: $grade | Risk: $risk"
            return 0
        elif [ -n "$(echo "$metrics" | jq -r '.pending // empty')" ]; then
            echo -e "${YELLOW}⚠️  Data collection in progress${NC}"
            return 2
        else
            echo -e "${RED}❌ No metrics available${NC}"
            echo "   Error: $(echo "$metrics" | jq -r '.error // "Unknown error"')"
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to fetch metrics (status: $http_code)${NC}"
        return 1
    fi
}

# Function to trigger scraping
trigger_scraping() {
    local slug=$1
    echo "5️⃣  Triggering scraping for '$slug'..."
    
    if [ -z "$CRON_SECRET" ]; then
        echo -e "${YELLOW}⚠️  CRON_SECRET not set, skipping scraping trigger${NC}"
        echo "   Set CRON_SECRET environment variable to test scraping"
        return 2
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/cron/trigger-scraping" \
        -H "Authorization: Bearer $CRON_SECRET")
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Scraping triggered successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to trigger scraping (status: $http_code)${NC}"
        return 1
    fi
}

# Main test flow
main() {
    echo "Testing pipeline for company: $TEST_COMPANY"
    echo "API URL: $API_URL"
    echo
    
    # Check health
    if ! check_health; then
        echo -e "${RED}Pipeline test failed at health check${NC}"
        exit 1
    fi
    echo
    
    # Check company
    if ! check_company "$TEST_COMPANY"; then
        echo -e "${RED}Pipeline test failed at company check${NC}"
        exit 1
    fi
    echo
    
    # Check snapshots
    has_snapshots=true
    if ! check_snapshots "$TEST_COMPANY"; then
        has_snapshots=false
    fi
    echo
    
    # Check metrics
    metrics_status=0
    check_metrics "$TEST_COMPANY" || metrics_status=$?
    echo
    
    # If no data, offer to trigger scraping
    if [ "$has_snapshots" = false ] || [ "$metrics_status" -ne 0 ]; then
        if [ "$metrics_status" -eq 2 ]; then
            echo -e "${YELLOW}📊 Data collection is already in progress${NC}"
            echo "   Wait a few minutes and run this test again"
        else
            echo -e "${YELLOW}📊 No data available for $TEST_COMPANY${NC}"
            echo
            
            if [ -n "$CRON_SECRET" ]; then
                read -p "Would you like to trigger scraping? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    trigger_scraping "$TEST_COMPANY"
                    echo
                    echo "⏳ Scraping triggered. Data should be available in 2-5 minutes."
                    echo "   Run this test again to check the results."
                fi
            else
                echo "To trigger scraping, set the CRON_SECRET environment variable:"
                echo "  export CRON_SECRET=your-cron-secret"
                echo "  $0"
            fi
        fi
    else
        echo -e "${GREEN}🎉 Pipeline test completed successfully!${NC}"
        echo "   All components are working correctly."
    fi
    
    echo
    echo "📝 Summary:"
    echo "   - API: ✅ Operational"
    echo "   - Company Data: ✅ Available"
    if [ "$has_snapshots" = true ]; then
        echo "   - Snapshots: ✅ Available"
    else
        echo "   - Snapshots: ❌ Not available"
    fi
    
    case $metrics_status in
        0)
            echo "   - Metrics: ✅ Available"
            ;;
        2)
            echo "   - Metrics: ⏳ Processing"
            ;;
        *)
            echo "   - Metrics: ❌ Not available"
            ;;
    esac
}

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Run main function
main