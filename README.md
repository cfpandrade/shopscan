# ShopScan IE

A Home Assistant addon for managing your shopping list with live price comparison across **Tesco Ireland** and **Dunnes Stores**.

## What It Does

- Build and manage a shopping list from within Home Assistant.
- Search products and fetch real-time prices from Tesco IE and Dunnes Stores.
- Compare prices side-by-side to choose the cheapest option per item.
- Track the total basket cost per retailer.
- All data persists across restarts via HA's addon data storage.

## Installation

### Add this Repository to HA

1. Go to **Settings → Add-ons → Add-on Store** in Home Assistant.
2. Click **⋮ → Repositories**.
3. Add:
   ```
   https://github.com/cfpandrade/shopscan
   ```
4. Install **ShopScan IE** from the store.
5. Start the addon — a **ShopScan** entry will appear in your sidebar.

Full installation and configuration docs are in [`shopscan/DOCS.md`](shopscan/DOCS.md).

## Architecture

```
HA Ingress (port 8099)
        │
        ▼
    nginx (port 8099)
    ├── /* → React frontend (static, /app/frontend)
    └── /api/* → Node.js backend (port 3001)
                        │
                        ├── SQLite DB (/data/shopscan.db)
                        └── Puppeteer/Chromium (price scraping)
```

Both nginx and the Node.js backend are managed by **s6-overlay** (the HA base image's process supervisor), which restarts either service automatically if it exits unexpectedly.

### Container Layers

| Stage | Base | Purpose |
|---|---|---|
| `frontend-builder` | `node:20-alpine` | Build React app (`npm run build`) |
| `backend-builder` | `node:20-alpine` | Install production Node dependencies |
| Final | `ghcr.io/hassio-addons/base:14.3.3` | Alpine + s6, runs nginx + Node.js |

### Key Paths

| Path | Description |
|---|---|
| `/app/frontend` | Built React static files |
| `/app/backend` | Node.js backend source + node_modules |
| `/data/shopscan.db` | Persistent SQLite database (HA managed) |
| `/etc/services.d/nginx/` | s6 service scripts for nginx |
| `/etc/services.d/backend/` | s6 service scripts for Node.js backend |

## Supported Architectures

- `amd64`
- `aarch64`
- `armhf`
- `armv7`

## License

MIT
