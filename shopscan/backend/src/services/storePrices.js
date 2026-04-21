import { searchTesco } from './tesco.js';
import { searchDunnes } from './dunnes.js';
import { buildStoreSearchQueries } from './searchQueries.js';

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

async function searchStoreAcrossQueries(store, searchFn, input, options = {}) {
  const queries = Array.isArray(input) ? input : buildStoreSearchQueries(input, store);
  let bestNonPriceResult = null;

  for (const query of queries) {
    const results = await withTimeout(searchFn(query, options), store);

    if (hasPriceResult(results)) {
      return results;
    }

    if (!bestNonPriceResult && hasAnyUsefulResult(results)) {
      bestNonPriceResult = results;
    }
  }

  return bestNonPriceResult || timeoutResult(store);
}

export async function searchStorePrices(store, input, options = {}) {
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
