import { getDb } from './db.js';

const DEFAULT_CACHE_TTL_HOURS = Number(process.env.PRICE_CACHE_TTL_HOURS || 24);

/**
 * Returns the latest cached price row for a query/store pair.
 * Cached values remain available until an explicit refresh replaces them.
 * @param {string} searchQuery
 * @param {string} store
 * @returns {object|null}
 */
export function getCached(searchQuery, store) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT search_query, store, price, price_per_unit, product_url, store_product_name, image_url, fetched_at, expires_at
       FROM price_cache
       WHERE search_query = ? AND store = ?
       ORDER BY fetched_at DESC
       LIMIT 1`
    )
    .get(searchQuery, store);

  return row || null;
}

export function getLatestCached(searchQuery, store) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT search_query, store, price, price_per_unit, product_url, store_product_name, image_url, fetched_at, expires_at
       FROM price_cache
       WHERE search_query = ? AND store = ?
       ORDER BY fetched_at DESC
       LIMIT 1`
    )
    .get(searchQuery, store);

  return row || null;
}

export function getLatestCachedByQueries(searchQueries, store) {
  if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
    return null;
  }

  const db = getDb();
  const placeholders = searchQueries.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT search_query, store, price, price_per_unit, product_url, store_product_name, image_url, fetched_at, expires_at
       FROM price_cache
       WHERE store = ?
         AND search_query IN (${placeholders})
       ORDER BY fetched_at DESC
       LIMIT 1`
    )
    .get(store, ...searchQueries);

  return row || null;
}

/**
 * Inserts or replaces the cache entry for the given query/store pair.
 * Expiry is kept only as a freshness marker; cached values remain readable until replaced.
 * @param {string} searchQuery
 * @param {string} store
 * @param {object} data  - { price, price_per_unit, product_url, store_product_name, image_url }
 */
export function setCache(searchQuery, store, data) {
  const db = getDb();

  // Remove any existing entries for this query/store before inserting
  db.prepare(
    `DELETE FROM price_cache WHERE search_query = ? AND store = ?`
  ).run(searchQuery, store);

  db.prepare(
    `INSERT INTO price_cache
       (search_query, store, price, price_per_unit, product_url, store_product_name, image_url, expires_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  ).run(
    searchQuery,
    store,
    data.price ?? null,
    data.price_per_unit ?? null,
    data.product_url ?? null,
    data.store_product_name ?? null,
    data.image_url ?? null,
    `+${DEFAULT_CACHE_TTL_HOURS} hour`
  );
}
