import { searchTesco } from './tesco.js';
import { searchDunnes } from './dunnes.js';
import { buildStoreSearchQueries } from './searchQueries.js';
import { extractTescoProductFromHtml, extractDunnesProductFromHtml } from './storeParsing.js';
import { fetchHtmlWithBrowserFingerprint } from './htmlFetch.js';
import { setCache } from '../cache.js';
import { getPrimarySearchQuery } from './searchQueries.js';
import { scoreStoreResult } from './productMatch.js';

const STORE_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 12000);

function timeoutResult(store) {
  return [{ store, price: null, error: 'timeout' }];
}

function withTimeout(promise, store) {
  let timer;

  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(timeoutResult(store)), STORE_TIMEOUT_MS);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}

function hasAnyUsefulResult(results) {
  return Array.isArray(results) && results.some(
    (result) => !result?.error && (
      result.price != null ||
      result.image_url ||
      result.store_product_name
    )
  );
}

function hasPriceResult(results) {
  return Array.isArray(results) && results.some(
    (result) => !result?.error && result.price != null
  );
}

// scoreStoreResult ≥ this ⇒ confident match, stop trying further query variants.
const GOOD_MATCH_SCORE = 0.75;
// Once a priced candidate exists, try at most this many queries for a better one.
const MAX_QUERIES_AFTER_CANDIDATE = 4;

function rankResultsForItem(item, results, store) {
  return results
    .filter((result) => !result?.error)
    .map((result) => ({ result, score: scoreStoreResult(item, result, store) }))
    .sort((left, right) => right.score - left.score);
}

/**
 * Re-caches the selected result under its query so it becomes the latest
 * cache row (what the list UI reads), when it differs from the first result
 * the store search already cached.
 */
function cacheSelectedResult(store, query, results, selected) {
  if (!selected || selected === results[0]) return;
  if (selected.price != null || selected.store_product_name || selected.image_url) {
    setCache(query, store, selected);
  }
}

async function searchStoreAcrossQueries(store, searchFn, input, options = {}) {
  const queries = Array.isArray(input) ? input : buildStoreSearchQueries(input, store);
  const item = !Array.isArray(input) && typeof input === 'object' && input !== null ? input : null;
  let bestPriced = null;
  let bestNonPriceResult = null;
  let queriesSinceCandidate = 0;

  for (const query of queries) {
    const results = await withTimeout(searchFn(query, options), store);

    if (hasPriceResult(results)) {
      // Without item context (plain string search) keep the old behaviour:
      // first priced result wins.
      if (!item) return results;

      const ranked = rankResultsForItem(item, results, store);
      const ordered = ranked.map((entry) => entry.result);
      const topScore = ranked[0]?.score ?? 0;

      if (topScore >= GOOD_MATCH_SCORE) {
        cacheSelectedResult(store, query, results, ordered[0]);
        return ordered;
      }

      if (!bestPriced || topScore > bestPriced.score) {
        bestPriced = { query, results, ordered, score: topScore };
      }
    } else if (!bestNonPriceResult && hasAnyUsefulResult(results)) {
      bestNonPriceResult = results;
    }

    if (bestPriced) {
      queriesSinceCandidate += 1;
      if (queriesSinceCandidate >= MAX_QUERIES_AFTER_CANDIDATE) break;
    }
  }

  if (bestPriced) {
    cacheSelectedResult(store, bestPriced.query, bestPriced.results, bestPriced.ordered[0]);
    return bestPriced.ordered;
  }

  return bestNonPriceResult || timeoutResult(store);
}

export async function fetchStoreByUrl(store, item, url, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = getPrimarySearchQuery(item) || url;

  const html = await fetchHtmlWithBrowserFingerprint(store, url);
  if (!html) return [{ store, price: null, error: 'unavailable' }];

  const result = store === 'tesco'
    ? extractTescoProductFromHtml(html, url)
    : extractDunnesProductFromHtml(html, url);

  if (!result) return [{ store, price: null, error: 'unavailable' }];

  if (result.price != null || result.store_product_name) {
    setCache(cacheKey, store, result);
  }

  return [result];
}

export async function searchStorePrices(store, input, options = {}) {
  const customUrl = store === 'tesco' ? input?.custom_tesco_url : input?.custom_dunnes_url;
  if (customUrl && typeof input === 'object') {
    return fetchStoreByUrl(store, input, customUrl, options);
  }

  if (store === 'tesco') {
    return searchStoreAcrossQueries('tesco', searchTesco, input, options);
  }

  if (store === 'dunnes') {
    return searchStoreAcrossQueries('dunnes', searchDunnes, input, options);
  }

  throw new Error(`Unsupported store: ${store}`);
}

export async function fetchStorePrices(input, options = {}) {
  const [tesco, dunnes] = await Promise.all([
    searchStorePrices('tesco', input, options),
    searchStorePrices('dunnes', input, options),
  ]);

  return { tesco, dunnes };
}
