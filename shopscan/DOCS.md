# ShopScan IE - Home Assistant Addon

ShopScan IE is a Home Assistant addon that provides a shopping list with live price comparison across Tesco Ireland and Dunnes Stores. It runs entirely within your Home Assistant instance and is accessible via the HA sidebar.

## Installation

### Step 1: Add the Repository

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Click the **⋮** (three-dot menu) in the top-right corner.
3. Select **Repositories**.
4. Add the following URL and click **Add**:
   ```
   https://github.com/cfpandrade/shopscan
   ```
5. Close the dialog. The **ShopScan IE** addon will appear in the store.

### Step 2: Install and Start

1. Click **ShopScan IE** in the addon store.
2. Click **Install** and wait for the image to build/pull.
3. Click **Start**.
4. Optionally enable **Start on boot** and **Watchdog**.

## Accessing the UI

ShopScan IE uses **Home Assistant Ingress**, so no port forwarding or separate URL is needed. Once the addon is running, a **ShopScan** entry (cart icon) will appear in the HA sidebar. Click it to open the shopping list interface.

The addon listens internally on port **8099**. HA proxies requests through its ingress tunnel, meaning the UI is available even when HA is accessed remotely via Nabu Casa or a reverse proxy.

## What the Addon Does

- Maintain a persistent shopping list stored in `/data/shopscan.db` (SQLite).
- Search for products and fetch live prices from Tesco Ireland and Dunnes Stores using a headless Chromium browser (Puppeteer).
- Compare prices side-by-side to find the best deal.
- Track total basket cost per retailer.

## Data Persistence

All shopping list data is stored in `/data/shopscan.db`. This directory is mapped to the addon's persistent data folder managed by Home Assistant — data survives addon restarts and updates.

Environment variables set at runtime:

| Variable | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `3001` | Backend API port (internal) |
| `DB_PATH` | `/data/shopscan.db` | SQLite database path |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium-browser` | Chromium for scraping |

## HA REST Sensor (Optional)

You can expose shopping list state to Home Assistant automations using a REST sensor pointed at the backend API. Add the following to your `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: ShopScan Item Count
    resource: http://localhost:8099/api/items
    value_template: "{{ value_json | length }}"
    unit_of_measurement: items
    scan_interval: 300
```

Or to track total basket cost:

```yaml
sensor:
  - platform: rest
    name: ShopScan Tesco Total
    resource: http://localhost:8099/api/basket/total
    value_template: "{{ value_json.tesco }}"
    unit_of_measurement: "EUR"
    scan_interval: 300

  - platform: rest
    name: ShopScan Dunnes Total
    resource: http://localhost:8099/api/basket/total
    value_template: "{{ value_json.dunnes }}"
    unit_of_measurement: "EUR"
    scan_interval: 300
```

> Note: The REST sensor hits the nginx proxy on port 8099. This only works when called from within the HA host (localhost). Adjust the URL if your setup differs.

## Architecture

- **nginx** listens on port 8099, serves the React frontend and proxies `/api/*` to the Node.js backend on port 3001.
- **Node.js backend** handles API requests, SQLite persistence, and Puppeteer-based price scraping.
- **s6-overlay** (provided by the HA base image) supervises both processes and restarts them on failure.
- The React frontend is pre-built at image build time and served as static files.
