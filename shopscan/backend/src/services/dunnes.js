import fetch from 'node-fetch';
import { getCached, setCache } from '../cache.js';
import { createBrowserSession } from './browser.js';
import { fetchHtmlWithBrowserFingerprint } from './htmlFetch.js';
import { extractDunnesResultsFromHtml } from './storeParsing.js';

const DUNNES_SEARCH_URL =
  'https://www.dunnesstoresgrocery.com/sm/delivery/rsid/258/results';

const ERROR_RESULT = [{ store: 'dunnes', price: null, error: 'unavailable' }];
const REQUEST_HEADERS = {
  'accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-IE,en;q=0.9',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

async function fetchDunnesHtml(query) {
  const url = `${DUNNES_SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const fingerprintHtml = await fetchHtmlWithBrowserFingerprint('dunnes', url);
  if (fingerprintHtml) {
    return fingerprintHtml;
  }

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    console.warn(`[dunnes] HTTP ${response.status} for query "${query}"`);
    return null;
  }

  return response.text();
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
        image_url: cached.image_url || null,
      },
    ];
  }

  let browser;
  let context;
  let html = null;
  try {
    html = await fetchDunnesHtml(query);

    const session = html ? null : await createBrowserSession(REQUEST_HEADERS['user-agent']);

    if (session && !html) {
      browser = session.browser;
      context = session.context;
      const page = session.page;

      const searchUrl = `${DUNNES_SEARCH_URL}?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      await page
        .waitForFunction(
          () =>
            document.querySelectorAll('article[data-testid^="ProductCardWrapper-"], a[href*="/product/"]').length > 0 ||
            /Results|No results|Add to Cart|Just a moment/i.test(document.body.innerText),
          { timeout: 18000 }
        )
        .catch(() => {
          console.warn(`[dunnes] Search results not ready for "${query}" within timeout`);
        });

      await page.waitForTimeout(1200).catch(() => {});
      html = await page.content();
    }

    const results = html ? extractDunnesResultsFromHtml(html, query) : [];

    const finalResults =
      results && results.some((result) => result.price != null || result.store_product_name || result.image_url)
        ? results
        : ERROR_RESULT;

    // Cache the first (best) result
    const toCache = finalResults[0];
    if (!toCache.error && (toCache.price != null || toCache.image_url || toCache.store_product_name)) {
      setCache(query, 'dunnes', toCache);
    }

    return finalResults;
  } catch (err) {
    console.error(`[dunnes] Error searching for "${query}":`, err.message);
    return ERROR_RESULT;
  } finally {
    if (context) {
      await context.close().catch((e) =>
        console.warn('[dunnes] Failed to close browser context:', e.message)
      );
    }
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[dunnes] Failed to close browser:', e.message)
      );
    }
  }
}
