import { existsSync } from 'node:fs';
import fetch from 'node-fetch';
import { load } from 'cheerio';
import { chromium } from 'playwright-core';
import { getCached, setCache } from '../cache.js';

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

function normalise(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `https://www.tesco.ie${href}`;
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

function extractTescoResultsFromHtml(html) {
  const $ = load(html);
  const byUrl = new Map();

  $('a[href*="/products/"]').each((_, link) => {
    const product_url = toAbsoluteUrl($(link).attr('href'));
    if (!product_url) return;

    let container = $(link);
    while (container.length) {
      const text = normalise(container.text());
      if (
        text &&
        /€\s*\d/.test(text) &&
        /(Add|Quantity controls)/i.test(text) &&
        text.length < 2200
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
      if (price == null && /clubcard price/i.test(line)) {
        const offerMatch = line.match(/€\s*(\d+(?:\.\d+)?)/);
        if (offerMatch) {
          price = Number.parseFloat(offerMatch[1]);
        }
      }

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
          !/^(Add|Quantity controls|Write a review|Aldi Price Match|Rest of )/i.test(line)
      ) ||
      null;

    const image = container.find('img').first();
    const image_url = toAbsoluteUrl(
      image.attr('src') || image.attr('data-src') || image.attr('data-lazy-src')
    );
    const current = byUrl.get(product_url);
    const candidate = {
      store: 'tesco',
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

async function fetchTescoHtml(query) {
  const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;
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
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();
      const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

      await page
        .waitForFunction(
          () =>
            document.querySelectorAll('a[href*="/products/"]').length > 0 ||
            /Showing \d+ to \d+ of \d+ items|No results/i.test(document.body.innerText),
          { timeout: 15000 }
        )
        .catch(() => {
          console.warn(`[tesco] Search results not ready for "${query}" within timeout`);
        });

      html = await page.content();
      await context.close();
    }

    if (!html) {
      html = await fetchTescoHtml(query);
    }

    const results = html ? extractTescoResultsFromHtml(html) : [];

    // Filter out empty results
    const valid = (results || []).filter((r) => r.price != null || r.store_product_name);
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
    if (browser) {
      await browser.close().catch((e) =>
        console.warn('[tesco] Failed to close browser:', e.message)
      );
    }
  }
}
