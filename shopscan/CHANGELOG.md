# Changelog

## [1.0.13] - 2026-04-21

### Added

- Added a shopping summary button in the app header with totals for the active list, Tesco-only total, Dunnes-only total, and the savings from splitting the basket across both supermarkets.

## [1.0.12] - 2026-04-21

### Fixed

- Kept checked items in their current position instead of moving them to a separate section at the bottom, so they remain easy to track after tapping the check button.

## [1.0.11] - 2026-04-21

### Fixed

- Kept cached Tesco and Dunnes prices visible in the list even after cache expiry, so prices and supermarket images do not disappear between refreshes.
- Tightened the mobile price rows so Dunnes prices stay inside the card and reduced supermarket logo sizes for smaller screens.
- Centered the product image vertically in the card layout and kept supermarket images preferred whenever they are available.

### Changed

- Added a `Refresh all prices` action for unchecked items so the full list can be updated in one tap.
- Improved Tesco own-brand matching by searching Dunnes with a brandless equivalent query instead of the literal Tesco product name.
- Extended the fresh-cache window to 24 hours while still allowing manual refresh at any time.

## [1.0.10] - 2026-04-21

### Fixed

- Restored live Tesco and Dunnes price fetching in the addon by adding a browser-fingerprint HTML fallback that works inside the container.
- Fixed supermarket product images so the app keeps the original scan image as a fallback when a store image fails.
- Moved the checked toggle to the top-right controls area, enlarged the product image, and right-aligned store prices for a cleaner mobile card layout.
- Improved price lookup accuracy by trying barcode, brand, name, and description candidates before giving up on a store search.

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
