import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { getCached, setCache } from '../cache.js';

const TESCO_SEARCH_URL = 'https://www.tesco.ie/groceries/en-GB/search';
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-IE,en;q=0.9',
};

const ERROR_RESULT = [{ store: 'tesco', price: null, error: 'unavailable' }];

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
 * Attempts to extract products from ld+json script blocks.
 * @param {import('cheerio').CheerioAPI} $
 * @returns {Array|null}
 */
function extractFromLdJson($) {
  const results = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());

      // Could be a single object or an array / @graph
      const items = Array.isArray(data)
        ? data
        : data['@graph']
        ? data['@graph']
        : [data];

      for (const item of items) {
        if (item['@type'] === 'Product') {
          const name = item.name || null;
          const url = item.url || item.offers?.url || null;
          const price = item.offers?.price
            ? parseFloat(item.offers.price)
            : null;
          const priceCurrency = item.offers?.priceCurrency || '';
          results.push({
            store: 'tesco',
            price,
            price_per_unit: null,
            product_url: url,
            store_product_name: name,
          });
          if (results.length >= 3) break;
        }
      }
    } catch {
      // Ignore malformed JSON blocks
    }
  });

  return results.length > 0 ? results : null;
}

/**
 * Attempts to extract products via CSS selectors.
 * @param {import('cheerio').CheerioAPI} $
 * @returns {Array}
 */
function extractFromSelectors($) {
  const results = [];

  // Tesco product tiles
  $('[data-auto="product-tile"]').each((_, el) => {
    if (results.length >= 3) return false;

    const $el = $(el);
    const name =
      $el.find('.product-details--content .name').text().trim() ||
      $el.find('[class*="product-title"]').text().trim() ||
      null;

    const priceText =
      $el.find('.price-per-sellable-unit .value').text().trim() ||
      $el.find('[class*="price-per-sellable"]').text().trim() ||
      $el.find('[class*="price"]').first().text().trim() ||
      null;

    const price = parsePrice(priceText);

    const pricePerUnit =
      $el.find('.price-per-quantity-weight .weight').text().trim() || null;

    const relUrl =
      $el.find('a[href*="/groceries/"]').attr('href') || null;
    const product_url = relUrl
      ? relUrl.startsWith('http')
        ? relUrl
        : `https://www.tesco.ie${relUrl}`
      : null;

    if (name || price !== null) {
      results.push({
        store: 'tesco',
        price,
        price_per_unit: pricePerUnit,
        product_url,
        store_product_name: name,
      });
    }
  });

  return results;
}

/**
 * Searches Tesco IE for the given query.
 * Returns up to 3 price results (or an error shape on failure).
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchTesco(query) {
  // Check cache first
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

  try {
    const url = `${TESCO_SEARCH_URL}?query=${encodeURIComponent(query)}&count=5`;
    const response = await fetch(url, { headers: FETCH_HEADERS, timeout: 15000 });

    if (!response.ok) {
      console.warn(`[tesco] HTTP ${response.status} for query "${query}"`);
      return ERROR_RESULT;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try structured data first, fall back to selectors
    let results = extractFromLdJson($);
    if (!results || results.length === 0) {
      results = extractFromSelectors($);
    }

    if (!results || results.length === 0) {
      results = ERROR_RESULT;
    } else {
      results = results.slice(0, 3);
    }

    // Cache the first (best) result
    const toCache = results[0];
    if (!toCache.error) {
      setCache(query, 'tesco', toCache);
    }

    return results;
  } catch (err) {
    console.error(`[tesco] Error searching for "${query}":`, err.message);
    return ERROR_RESULT;
  }
}
