#!/bin/sh
set -e

export NODE_ENV=production
export PORT=3001
export DB_PATH="${DB_PATH:-/data/shopscan.db}"

mkdir -p "$(dirname "$DB_PATH")"

echo "[shopscan] Starting backend on port 3001..."
node /app/backend/src/index.js &
BACKEND_PID=$!

echo "[shopscan] Starting nginx on port 8099..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Exit if either process dies
wait $BACKEND_PID $NGINX_PID
