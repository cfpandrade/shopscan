#!/bin/sh
set -e

export NODE_ENV=production
export PORT=3001
export DB_PATH="${DB_PATH:-/data/shopscan.db}"

if [ -f /data/options.json ]; then
  export SHOPSCAN_COUNTRY="$(
    python3 - <<'PY'
import json
from pathlib import Path

options_path = Path('/data/options.json')
country = 'Ireland'

try:
    with options_path.open('r', encoding='utf-8') as handle:
        data = json.load(handle)
        country = str(data.get('country') or country)
except Exception:
    pass

print(country)
PY
  )"
else
  export SHOPSCAN_COUNTRY="Ireland"
fi

mkdir -p "$(dirname "$DB_PATH")"

echo "[shopscan] Starting backend on port 3001..."
echo "[shopscan] Country configuration: ${SHOPSCAN_COUNTRY}"
node /app/backend/src/index.js &
BACKEND_PID=$!

echo "[shopscan] Starting nginx on port 8099..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Exit if either process dies
wait $BACKEND_PID $NGINX_PID
