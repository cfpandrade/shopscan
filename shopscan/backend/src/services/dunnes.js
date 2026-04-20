import { chromium } from 'playwright-core';
import { getCached, setCache } from '../cache.js';

const DUNNES_SEARCH_URL =
  'https://www.dunnesstoresgrocery.com/sm/planning/rsid/5018/results';

const ERROR_RESULT = [{ store: 'dunnes', price: null, error: 'unavailable' }];

/**
 * Parses a price string like "€1.49" or "1.49" into a float.
 * Returns null if parsing fails.
 */
function parsePrice(str) {
  if (!str) return null;
  const match = str.replace(/,/g, '').match(/[\d]+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Searches Dunnes Stores IE for the given query using a headless browser.
 * Returns up to 3 price results (or an error shape on failure).
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchDunnes(query) {
  // Check cache first
  const cached = getCached(query, 'dunnes');
  if (cached) {
    return [
      {
        store: 'dunnes',
        price: cached.price,
        price_per_unit: cached.price_per_unit,
        product_url: cached.product_url,
        store_product_name: cached.store_product_name,
      },
    ];
  }

  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROMIUM_PATH ||
    '/usr/bin/chromium-browser';

  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      locale: 'en-IE',
    });
    const page = await context.newPage();

    const searchUrl = `${DUNNES_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait for product cards to appear (up to 15s)
    await page
      .waitForSelector('.product-card, .shelfProductTile', { timeout: 15000 })
      .catch(() => {
        console.warn(`[dunnes] Product cards not found for "${query}" within timeout`);
      });

    const results = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('.product-card, .shelfProductTile')
      ).slice(0, 3);

      return cards.map((card) => {
        // Name
        const nameEl =
          card.querySelector('.product-card-name, .shelfProductTile-title, [class*="product-name"], [class*="title"]');
        const name = nameEl ? nameEl.textContent.trim() : null;

        // Price
        const priceEl =
          card.querySelector(
            '.product-card .price, .shelfProductTile-price, [class*="price"]'
          );
        const priceText = priceEl ? priceEl.textContent.trim() : null;
        const priceMatch = priceText
          ? priceText.replace(/,/g, '').match(/[\d]+\.?\d*/)
          : null;
        const price = priceMatch ? parseFloat(priceMatch[0]) : null;

        // Price per unit
        const ppu =
          card.querySelector('[class*="price-per"], [class*="pricePerUnit"]');
        const price_per_unit = ppu ? ppu.textContent.trim() : null;

        // URL
        const linkEl = card.querySelector('a[href]');
        const href = linkEl ? linkEl.getAttribute('href') : null;
        const product_url = href
          ? href.startsWith('http')
            ? href
            : `https://www.dunnesstoresgrocery.com${href}`
          : null;

        return {
          store: 'dunnes',
          price,
          price_per_unit,
          product_url,
          store_product_name: name,
        };
      });
    });

    const finalResults =
      results && results.length > 0 ? results : ERROR_RESULT;

    // Cache the first (best) result
    const toCache = finalResults[0];
    if (!toCache.error) {
      setCache(query, 'dunnes', toCache);
    }

    return finalResults;
  } catch (err) {
    console.error(`[dunnes] Error searching for "${query}":`, err.message);
    return ERROR_RESULT;
  } finally {
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[dunnes] Failed to close browser:', e.message)
      );
    }
  }
}
