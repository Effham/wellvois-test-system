#!/bin/bash
cd patient-portal
export APP_PORT=8002
export SERVER_PORT=8002
export CENTRAL_DOMAIN=patient.localhost
export APP_URL="http://patient.localhost:8002"
composer run dev

