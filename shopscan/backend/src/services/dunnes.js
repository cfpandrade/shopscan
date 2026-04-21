import { existsSync } from 'node:fs';
import fetch from 'node-fetch';
import { load } from 'cheerio';
import { chromium } from 'playwright-core';
import { getCached, setCache } from '../cache.js';

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

function normalise(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  return href.startsWith('http')
    ? href
    : `https://www.dunnesstoresgrocery.com${href}`;
}

function getChromiumPath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROMIUM_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/bin/chromium-browser',
    '/bin/chromium',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function extractDunnesResultsFromHtml(html) {
  const $ = load(html);
  const byUrl = new Map();

  $('a[href*="/product/"]').each((_, link) => {
    const product_url = toAbsoluteUrl($(link).attr('href'));
    if (!product_url) return;

    let container = $(link);
    while (container.length) {
      const text = normalise(container.text());
      if (
        text &&
        /€\s*\d/.test(text) &&
        /(Add to Cart|Open Product Description)/i.test(text) &&
        text.length < 2400
      ) {
        break;
      }
      container = container.parent();
    }

    if (!container.length) {
      container = $(link).parent();
    }

    const lines = container
      .text()
      .split('\n')
      .map(normalise)
      .filter(Boolean);

    let price = null;
    let price_per_unit = null;
    for (const line of lines) {
      if (price == null && /^€\s*\d/.test(line) && !line.includes('/')) {
        const priceMatch = line.match(/€\s*(\d+(?:\.\d+)?)/);
        if (priceMatch) {
          price = Number.parseFloat(priceMatch[1]);
        }
      }

      if (!price_per_unit && /^€\s*\d/.test(line) && line.includes('/')) {
        price_per_unit = line;
      }
    }

    const rawName = normalise(
      $(link).text() ||
      $(link).attr('aria-label') ||
      $(link).find('img').attr('alt')
    );
    const store_product_name =
      rawName ||
      lines.find(
        (line) =>
          line &&
          !/^€\s*\d/.test(line) &&
          !/^(Add to Cart|Open Product Description|View Deal|SAVE )/i.test(line)
      ) ||
      null;

    const image = container.find('img').first();
    const image_url = toAbsoluteUrl(
      image.attr('src') || image.attr('data-src') || image.attr('data-lazy-src')
    );
    const current = byUrl.get(product_url);
    const candidate = {
      store: 'dunnes',
      price,
      price_per_unit,
      product_url,
      store_product_name,
      image_url,
    };

    if (!current) {
      byUrl.set(product_url, candidate);
      return;
    }

    byUrl.set(product_url, {
      ...current,
      price: current.price ?? candidate.price,
      price_per_unit: current.price_per_unit ?? candidate.price_per_unit,
      store_product_name: current.store_product_name || candidate.store_product_name,
      image_url: current.image_url || candidate.image_url,
    });
  });

  return Array.from(byUrl.values())
    .filter((item) => item.price != null || item.store_product_name)
    .slice(0, 3);
}

async function fetchDunnesHtml(query) {
  const response = await fetch(`${DUNNES_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
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
  let html = null;
  try {
    const chromiumPath = getChromiumPath();

    if (chromiumPath) {
      browser = await chromium.launch({
        executablePath: chromiumPath,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        headless: true,
      });

      const context = await browser.newContext({
        userAgent: REQUEST_HEADERS['user-agent'],
        locale: 'en-IE',
      });
      const page = await context.newPage();

      const searchUrl = `${DUNNES_SEARCH_URL}?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      await page
        .waitForFunction(
          () =>
            document.querySelectorAll('a[href*="/product/"]').length > 0 ||
            /Results|No results|Add to Cart/i.test(document.body.innerText),
          { timeout: 15000 }
        )
        .catch(() => {
          console.warn(`[dunnes] Search results not ready for "${query}" within timeout`);
        });

      html = await page.content();
      await context.close();
    }

    if (!html) {
      html = await fetchDunnesHtml(query);
    }

    const results = html ? extractDunnesResultsFromHtml(html) : [];

    const finalResults =
      results && results.length > 0 ? results : ERROR_RESULT;

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
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[dunnes] Failed to close browser:', e.message)
      );
    }
  }
}
