#!/bin/bash
cd app-portal
export APP_PORT=8000
export SERVER_PORT=8000
export CENTRAL_DOMAIN=app.localhost
export APP_URL="http://app.localhost:8000"
composer run dev

