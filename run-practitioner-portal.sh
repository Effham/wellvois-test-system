#!/bin/bash
cd practitioner-portal
export APP_PORT=8001
export SERVER_PORT=8001
export CENTRAL_DOMAIN=practitioner.localhost
export APP_URL="http://practitioner.localhost:8001"
composer run dev

