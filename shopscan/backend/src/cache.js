import { getDb } from './db.js';

/**
 * Returns a cached price row if it exists and has not expired, otherwise null.
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
         AND expires_at > datetime('now')
       ORDER BY fetched_at DESC
       LIMIT 1`
    )
    .get(searchQuery, store);

  return row || null;
}

/**
 * Inserts or replaces the cache entry for the given query/store pair.
 * Expiry is set to 1 hour from now.
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
       (?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 hour'))`
  ).run(
    searchQuery,
    store,
    data.price ?? null,
    data.price_per_unit ?? null,
    data.product_url ?? null,
    data.store_product_name ?? null,
    data.image_url ?? null
  );
}
