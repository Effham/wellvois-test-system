#!/bin/bash

# Script to run all four portals simultaneously on different ports using composer run dev
# Ports: app-portal=8000, practitioner-portal=8001, patient-portal=8002, admin-portal=8003
# Each portal runs: Laravel server + Vite dev server + Queue listener + Logs (via concurrently)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting all portals...${NC}"
echo ""

# Function to run a portal
run_portal() {
    local portal=$1
    local port=$2
    local domain=$3
    
    echo -e "${BLUE}Starting ${portal} on port ${port} (${domain})...${NC}"
    cd "${portal}" || exit 1
    
    # Set environment variables
    export APP_PORT=${port}
    export SERVER_PORT=${port}
    export CENTRAL_DOMAIN=${domain}
    export APP_URL="http://${domain}:${port}"
    
    # Run composer dev script (runs Laravel server + Vite + queue + logs)
    composer run dev &
    
    cd ..
    echo -e "${GREEN}${portal} started on port ${port}${NC}"
    echo ""
}

# Start all portals in background
# App portal uses localhost only (not app.localhost)
run_portal "app-portal" "8000" "localhost"
run_portal "practitioner-portal" "8001" "practitioner.localhost"
run_portal "patient-portal" "8002" "patient.localhost"
run_portal "admin-portal" "8003" "admin.localhost"

echo -e "${GREEN}All portals started!${NC}"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo "  App Portal:        http://localhost:8000"
echo "  Practitioner Portal: http://practitioner.localhost:8001"
echo "  Patient Portal:    http://patient.localhost:8002"
echo "  Admin Portal:      http://admin.localhost:8003"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Wait for all background processes
wait

