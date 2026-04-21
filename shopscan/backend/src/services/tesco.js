import fetch from 'node-fetch';
import { getCached, setCache } from '../cache.js';
import { createBrowserSession } from './browser.js';
import { fetchHtmlWithBrowserFingerprint } from './htmlFetch.js';
import { extractTescoResultsFromHtml } from './storeParsing.js';

const TESCO_SEARCH_URL = 'https://www.tesco.ie/groceries/en-IE/search';
const ERROR_RESULT = [{ store: 'tesco', price: null, error: 'unavailable' }];

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

async function fetchTescoHtml(query) {
  const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;
  const fingerprintHtml = await fetchHtmlWithBrowserFingerprint('tesco', url);
  if (fingerprintHtml) {
    return fingerprintHtml;
  }

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    console.warn(`[tesco] HTTP ${response.status} for query "${query}"`);
    return null;
  }

  return response.text();
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
        image_url: cached.image_url || null,
      },
    ];
  }

  let browser;
  let context;
  let html = null;
  try {
    html = await fetchTescoHtml(query);

    const session = html ? null : await createBrowserSession(REQUEST_HEADERS['user-agent']);

    if (session && !html) {
      browser = session.browser;
      context = session.context;
      const page = session.page;
      const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      await page
        .waitForFunction(
          () =>
            document.querySelectorAll('li[data-testid][data-auto-available], a[href*="/products/"]').length > 0 ||
            /Showing \d+ to \d+ of \d+ items|No results|Access denied|robot/i.test(document.body.innerText),
          { timeout: 18000 }
        )
        .catch(() => {
          console.warn(`[tesco] Search results not ready for "${query}" within timeout`);
        });

      await page.waitForTimeout(1200).catch(() => {});
      html = await page.content();
    }

    const results = html ? extractTescoResultsFromHtml(html, query) : [];

    // Filter out empty results
    const valid = (results || []).filter((r) => r.price != null || r.store_product_name || r.image_url);
    const finalResults = valid.length > 0 ? valid : ERROR_RESULT;

    const toCache = finalResults[0];
    if (!toCache.error && (toCache.price != null || toCache.image_url || toCache.store_product_name)) {
      setCache(query, 'tesco', toCache);
    }

    return finalResults;
  } catch (err) {
    console.error(`[tesco] Error searching for "${query}":`, err.message);
    return ERROR_RESULT;
  } finally {
    if (context) {
      await context.close().catch((e) =>
        console.warn('[tesco] Failed to close browser context:', e.message)
      );
    }
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[tesco] Failed to close browser:', e.message)
      );
    }
  }
}
