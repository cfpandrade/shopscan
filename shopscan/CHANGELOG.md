# Changelog

## [1.0.9] - 2026-04-21

### Changed

- Improved product matching by storing barcode metadata with product descriptions and searching on name, brand, description, and barcode.
- Updated Dunnes branding in the UI and replaced the top supermarket filter text chips with logo-based filters.
- Improved supermarket search queries by combining brand and product name for better price lookup accuracy.

## [1.0.0] - 2026-04-20

### Added

- Initial release of ShopScan IE addon.
- Shopping list management with persistent SQLite storage in `/data/shopscan.db`.
- Live price comparison for Tesco Ireland and Dunnes Stores via headless Chromium (Puppeteer).
- React frontend served via nginx on port 8099 with HA Ingress support.
- Node.js backend API proxied at `/api/`.
- s6-overlay process supervision for nginx and backend services.
- Multi-arch support: `amd64`, `aarch64`, `armhf`, `armv7`.
