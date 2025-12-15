#!/bin/bash

# Script to clear all Laravel caches (optimize:clear) on all four portals
# This clears: config, route, view, event, compiled caches

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Clearing caches for all portals...${NC}"
echo ""

# Function to clear cache for a portal
clear_portal_cache() {
    local portal=$1
    
    echo -e "${BLUE}Clearing cache for ${portal}...${NC}"
    cd "${portal}" || {
        echo -e "${RED}Failed to change directory to ${portal}${NC}"
        return 1
    }
    
    # Run optimize:clear
    php artisan optimize:clear
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${portal} cache cleared successfully${NC}"
    else
        echo -e "${RED}✗ Failed to clear cache for ${portal}${NC}"
    fi
    
    echo ""
    cd ..
}

# Clear caches for all portals
clear_portal_cache "app-portal"
clear_portal_cache "practitioner-portal"
clear_portal_cache "patient-portal"
clear_portal_cache "admin-portal"

echo -e "${GREEN}All portal caches cleared!${NC}"
echo ""
echo -e "${YELLOW}Note: You may want to run 'php artisan config:cache' and 'php artisan route:cache' in production${NC}"



