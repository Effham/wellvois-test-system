#!/bin/bash
cd admin-portal
export APP_PORT=8003
export SERVER_PORT=8003
export CENTRAL_DOMAIN=admin.localhost
export APP_URL="http://admin.localhost:8003"
composer run dev

