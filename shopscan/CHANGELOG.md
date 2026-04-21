# Changelog

## [1.1.2] - 2026-04-21

### Added

- "Confirm match" button on Needs-review price rows: one tap marks that store's result as correct, overriding the algorithm for that item so it is included in best-store comparison and totals.
- Pin exact product URL per store in the Edit item modal: paste the Tesco or Dunnes product URL and tap "Use this" — the app fetches price from that page directly and uses it for all future refreshes.
- `custom_tesco_url` / `custom_dunnes_url` fields on shopping list items; when set, price refresh fetches that URL directly instead of doing a text search.

### Fixed

- Product matching: Dunnes often omits the brand name (e.g. "Nutella 1000g" vs "Ferrero Nutella"). Matching now uses the higher of brand+name coverage and name-only coverage, so well-known product names like Nutella or Rich Tea match correctly without "Needs review".
- Size comparison: removed `brandMismatch` as a hard veto on exact/size-adjusted matches; thresholds lowered to 0.55 for size comparisons so 1 kg vs 1000 g resolves to exact match as expected.

## [1.1.1] - 2026-04-21

### Fixed

- Tesco 403 errors: updated curl_cffi impersonation to Chrome 131 with full Sec-CH / Sec-Fetch headers that Akamai Bot Manager requires; older Chrome 99/110/120 profiles were being blocked.
- Unit price comparison now recognises "litre", "liter", "litres", "liters" and "per litre" formats from Tesco and Dunnes, fixing cases where €/L could not be calculated and wrong best-store was shown (e.g. Dunnes €/L 1.49 losing to Tesco €/L 1.59 due to missing normalisation).
- Normalised price (€/kg, €/L) now displays on the right side of each price row, next to the total price, so the comparison is immediately visible.
- Store product page popup now opens directly in the external browser instead of an iframe; Tesco and Dunnes block iframes with `X-Frame-Options: DENY` so the embedded view was always blank.

## [1.1.0] - 2026-04-21

### Added

- Edit item modal to correct name, brand, size and description for better price matching.
- Shopping summary modal with totals for Tesco, Dunnes, and the mixed-basket saving.
- In-app store product page popup (iframe) with an "Open outside" fallback for manual verification.
- Bulk "Refresh all prices" with live progress, refreshing by supermarket in sequence and reusing duplicate query results.
- Pull-to-refresh on the list by pulling down from the top.
- Store filter pills (Tesco / Dunnes) showing item counts and highlighting the cheapest-store items.

### Changed

- Product matching now uses normalised tokens, size-unit conversion, and comparable unit price (€/kg, €/L) to detect exact, close, size-adjusted, or needs-review matches.
- Best-store comparison uses the normalised unit price (`comparison_metric`) instead of raw price, and excludes needs-review results.
- Preferred image for each list item is now the one from the cheapest store.
- Price refresh is rate-limited to two windows per day (05:00 and 17:00 Ireland time) while still allowing manual overrides.
- `custom_name`, `custom_brand`, `custom_size`, `custom_description` fields added to list items and editable via PATCH.
- Price history (last 3 results per store) included in every list item response.
- Bulk refresh deduplicates store queries across items with the same search key.
- Single-item refresh timeout raised to 60 s; bulk refresh timeout raised to 180 s.
- Checked items stay in place instead of moving to a separate section.
- Cached prices are now permanent and only replaced on a successful refresh.

## [1.0.19] - 2026-04-21

### Added

- Tapping a Tesco or Dunnes price row now opens an in-app popup with the supermarket product page, plus an option to open it outside the addon for manual verification.

## [1.0.18] - 2026-04-21

### Fixed

- Skipped `curl_cffi` installation on unsupported `armv7` builds and made the fingerprint fetch helper fall back cleanly, so the multi-arch GitHub Actions build can complete instead of failing on that architecture.

## [1.0.17] - 2026-04-21

### Fixed

- Added the native Python build dependencies required by `curl_cffi` so multi-arch addon builds can complete on `armv7` instead of failing during the container image build.

## [1.0.16] - 2026-04-21

### Fixed

- Increased the frontend timeout for `Refresh all prices` and single-item refreshes so long supermarket refresh runs do not fail after 30 seconds.

## [1.0.15] - 2026-04-21

### Changed

- Added price refresh windows at 5:00 AM and 5:00 PM Ireland time so cached prices can only be updated twice per day, even if users press refresh repeatedly.
- Improved product matching by including brand and size/weight in search queries, reducing mismatches like `350g` versus `1kg`.
- Reduced and normalized supermarket logos in the mobile UI and now show brand plus size under each product name.

## [1.0.14] - 2026-04-21

### Changed

- Made cached prices permanent for normal reads so they stay available in the database until a refresh updates them.
- Reworked `Refresh all prices` to refresh by supermarket in sequence, updating Tesco first and then Dunnes while reusing duplicate search results across matching items.

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
