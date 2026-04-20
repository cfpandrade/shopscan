import { chromium } from 'playwright-core';
import { getCached, setCache } from '../cache.js';

const TESCO_SEARCH_URL = 'https://www.tesco.ie/groceries/en-GB/search';
const ERROR_RESULT = [{ store: 'tesco', price: null, error: 'unavailable' }];

function getChromiumPath() {
  return (
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROMIUM_PATH ||
    '/usr/bin/chromium-browser'
  );
}

/**
 * Searches Tesco IE for the given query using a headless browser.
 * Uses Playwright to bypass the Cloudflare 403 that blocks plain fetch().
 */
export async function searchTesco(query) {
  const cached = getCached(query, 'tesco');
  if (cached) {
    return [
      {
        store: 'tesco',
        price: cached.price,
        price_per_unit: cached.price_per_unit,
        product_url: cached.product_url,
        store_product_name: cached.store_product_name,
      },
    ];
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: getChromiumPath(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-IE',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Wait for either product tiles or a "no results" state
    await page
      .waitForSelector('[data-auto="product-tile"], .product-list--list-item, [class*="product-tile"]', {
        timeout: 15000,
      })
      .catch(() => {
        console.warn(`[tesco] Product tiles not found for "${query}" within timeout`);
      });

    const results = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll(
          '[data-auto="product-tile"], .product-list--list-item, [class*="product-tile"]'
        )
      ).slice(0, 3);

      return cards.map((card) => {
        // Name
        const nameEl =
          card.querySelector('.product-details--content .name') ||
          card.querySelector('[class*="titleLink"]') ||
          card.querySelector('a[href*="/products/"] span') ||
          card.querySelector('h3');
        const name = nameEl ? nameEl.textContent.trim() : null;

        // Price (look for €X.XX pattern)
        let priceText = null;
        const priceEl =
          card.querySelector('.price-per-sellable-unit .value') ||
          card.querySelector('.beans-price__text') ||
          card.querySelector('[class*="price-control-wrapper"] p') ||
          card.querySelector('[class*="price"]');
        if (priceEl) priceText = priceEl.textContent.trim();

        const priceMatch = priceText
          ? priceText.replace(/,/g, '').match(/[\d]+\.?\d*/)
          : null;
        const price = priceMatch ? parseFloat(priceMatch[0]) : null;

        // Price per unit
        const ppuEl =
          card.querySelector('.price-per-quantity-weight') ||
          card.querySelector('[class*="subtext"]') ||
          card.querySelector('[class*="price-per"]');
        const price_per_unit = ppuEl ? ppuEl.textContent.trim() : null;

        // URL
        const linkEl = card.querySelector('a[href*="/products/"]');
        const href = linkEl ? linkEl.getAttribute('href') : null;
        const product_url = href
          ? href.startsWith('http')
            ? href
            : `https://www.tesco.ie${href}`
          : null;

        return {
          store: 'tesco',
          price,
          price_per_unit,
          product_url,
          store_product_name: name,
        };
      });
    });

    // Filter out empty results
    const valid = (results || []).filter((r) => r.price != null || r.store_product_name);
    const finalResults = valid.length > 0 ? valid : ERROR_RESULT;

    const toCache = finalResults[0];
    if (!toCache.error && toCache.price != null) {
      setCache(query, 'tesco', toCache);
    }

    return finalResults;
  } catch (err) {
    console.error(`[tesco] Error searching for "${query}":`, err.message);
    return ERROR_RESULT;
  } finally {
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[tesco] Failed to close browser:', e.message)
      );
    }
  }
}
