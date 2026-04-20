# ShopScan IE — Quick Start

## Local Development (Before HA)

### Prerequisites
- Node.js 20+
- Docker (for final HA addon build)

### Backend

```bash
cd shopscan/backend
npm install
npm run dev
# Runs on http://localhost:3001
# Health check: curl http://localhost:3001/health
```

**Environment variables** (optional, defaults shown):
```bash
DB_PATH=/data/shopscan.db
NODE_ENV=development
PORT=3001
```

### Frontend

```bash
cd shopscan/frontend
npm install
npm run dev
# Opens http://localhost:5173 (Vite dev server)
# API proxy configured to http://localhost:3001
```

### Full Stack Locally

**Terminal 1:**
```bash
cd shopscan/backend && npm install && npm run dev
```

**Terminal 2:**
```bash
cd shopscan/frontend && npm install && npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Test API Endpoints

```bash
# Add item (barcode or custom name)
curl -X POST http://localhost:3001/api/list \
  -H "Content-Type: application/json" \
  -d '{"custom_name": "Milk", "quantity": 2}'

# Get list
curl http://localhost:3001/api/list

# Mark checked
curl -X PATCH http://localhost:3001/api/list/1 \
  -H "Content-Type: application/json" \
  -d '{"checked": 1}'

# Delete item
curl -X DELETE http://localhost:3001/api/list/1

# Search prices
curl "http://localhost:3001/api/prices/milk"

# HA sensor data
curl http://localhost:3001/api/ha/sync
```

---

## Build HA Addon Locally

```bash
cd shopscan

# Build the image (takes ~5 minutes first time, Chromium is large)
docker build -t shopscan:latest .

# Or use the HA addon build system:
docker build \
  --build-arg BUILD_FROM=ghcr.io/hassio-addons/base:14.3.3 \
  -t shopscan:latest \
  shopscan/
```

### Run Addon in Docker Locally

```bash
docker run -it \
  -p 8099:8099 \
  -v shopscan-data:/data \
  shopscan:latest
```

Visit `http://localhost:8099` in your browser (full stack UI).

---

## Troubleshooting

### Backend won't start
```bash
# Check Node version
node --version  # should be 20+

# Clear node_modules and reinstall
rm -rf shopscan/backend/node_modules
npm ci -C shopscan/backend
```

### Frontend won't compile
```bash
# Vite might have stale cache
rm -rf shopscan/frontend/node_modules/.vite
npm run dev -C shopscan/frontend
```

### Prices always unavailable
- Tesco/Dunnes selectors change frequently; check browser console for scraper errors
- Ensure Chromium is installed: `playwright install chromium`
- Check Network tab in DevTools to see if price API calls are hitting `/api/prices/`

### SQLite errors in backend
- Ensure `/data` directory is writable
- Check `DB_PATH` env var points to a valid path
- Try deleting the old DB: `rm /data/shopscan.db` (will start fresh)

---

## Deploy to Home Assistant

1. Push this repo to GitHub (public or private):
   ```bash
   git init
   git add .
   git commit -m "Initial ShopScan IE"
   git push origin main
   ```

2. In **Home Assistant → Settings → Add-ons → Add-on Store → ⋮ → Repositories**, add:
   ```
   https://github.com/cfpandrade/shopscan
   ```

3. Install **ShopScan IE** from the addon store.

4. The UI will be accessible from your HA sidebar under **ShopScan**.

---

## Next Steps

- Customize price formatting or add more supermarkets in `backend/src/services/`
- Tweak colors/fonts in `frontend/src/styles/index.css` + `tailwind.config.js`
- Add webhook integration for HA automations (use `/api/ha/sync` endpoint)

See [`shopscan/DOCS.md`](shopscan/DOCS.md) for full HA configuration options.
