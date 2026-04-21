import { Router } from 'express';
import { getDb } from '../db.js';
import { lookupBarcode } from '../services/openFoodFacts.js';
import { searchStorePrices } from '../services/storePrices.js';
import { getPriceRefreshStatus } from '../services/priceRefreshWindow.js';
import {
  buildSearchQueries,
  buildStoreSearchQueries,
  getPrimarySearchQuery,
} from '../services/searchQueries.js';
import { getLatestCachedByQueries } from '../cache.js';

const router = Router();

function mapCachedPrice(row) {
  if (!row) return null;

  const expiryTimestamp = row.expires_at
    ? Date.parse(row.expires_at.replace(' ', 'T') + 'Z')
    : null;

  return {
    price: row.price,
    price_per_unit: row.price_per_unit,
    product_url: row.product_url,
    store_product_name: row.store_product_name,
    image_url: row.image_url || null,
    search_query: row.search_query,
    fetched_at: row.fetched_at,
    stale: Number.isFinite(expiryTimestamp) ? expiryTimestamp < Date.now() : false,
    ...getPriceRefreshStatus(row.fetched_at),
  };
}

function getLatestPrices(item) {
  const tescoQueries = buildStoreSearchQueries(item, 'tesco');
  const dunnesQueries = buildStoreSearchQueries(item, 'dunnes');

  return {
    tesco: mapCachedPrice(getLatestCachedByQueries(tescoQueries, 'tesco')),
    dunnes: mapCachedPrice(getLatestCachedByQueries(dunnesQueries, 'dunnes')),
  };
}

function getBestStore(prices) {
  const tesco = prices?.tesco?.price;
  const dunnes = prices?.dunnes?.price;

  if (tesco == null && dunnes == null) return null;
  if (tesco == null) return 'dunnes';
  if (dunnes == null) return 'tesco';

  return Number(tesco) <= Number(dunnes) ? 'tesco' : 'dunnes';
}

function getPreferredImage(fallbackImageUrl, prices) {
  const bestStore = getBestStore(prices);
  const preferredOrder = [
    bestStore,
    bestStore === 'tesco' ? 'dunnes' : 'tesco',
  ].filter(Boolean);

  for (const store of preferredOrder) {
    const imageUrl = prices?.[store]?.image_url;
    if (imageUrl) return imageUrl;
  }

  return fallbackImageUrl || null;
}

/**
 * Formats a raw DB row into the public item shape.
 */
function formatItem(row) {
  const name = row.product_name || row.custom_name || 'Unknown';
  const searchQueries = buildSearchQueries(row);
  const prices = getLatestPrices(row);

  return {
    id: row.id,
    name,
    brand: row.brand || null,
    size: row.product_size || null,
    description: row.description || null,
    image_url: getPreferredImage(row.image_url, prices),
    fallback_image_url: row.image_url || null,
    barcode: row.product_barcode || null,
    category: row.category || null,
    quantity: row.quantity,
    unit: row.unit,
    checked: row.checked === 1,
    notes: row.notes || null,
    created_at: row.created_at,
    checked_at: row.checked_at || null,
    search_query: getPrimarySearchQuery(row),
    prices,
  };
}

function getRefreshableListItems() {
  const db = getDb();
  return db
    .prepare(
      `SELECT sl.*, p.name AS product_name, p.brand, p.size AS product_size, p.description
       FROM shopping_list sl
       LEFT JOIN products p ON sl.product_barcode = p.barcode
       WHERE sl.checked = 0
       ORDER BY sl.created_at DESC`
    )
    .all();
}

function buildRefreshEntry(item) {
  const primarySearchQuery = getPrimarySearchQuery(item);
  const searchQueries = buildSearchQueries(item);

  if (!primarySearchQuery || searchQueries.length === 0) {
    return {
      item,
      primarySearchQuery,
      searchQueries,
      skipReason: 'No searchable name for this item',
      storeQueries: {
        tesco: [],
        dunnes: [],
      },
    };
  }

  return {
    item,
    primarySearchQuery,
    searchQueries,
    skipReason: null,
    storeQueries: {
      tesco: buildStoreSearchQueries(item, 'tesco'),
      dunnes: buildStoreSearchQueries(item, 'dunnes'),
    },
  };
}

function getStoreRefreshDecision(entry, store) {
  const storeQueries = entry.storeQueries?.[store] || [];
  const cachedRow = getLatestCachedByQueries(storeQueries, store);
  const refreshStatus = getPriceRefreshStatus(cachedRow?.fetched_at);

  return {
    storeQueries,
    cachedRow,
    refreshStatus,
    forceRefresh: !cachedRow || refreshStatus.canRefresh,
  };
}

// GET /api/list — all items with product info and latest prices
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT sl.*,
                p.name  AS product_name,
                p.brand,
                p.size AS product_size,
                p.description,
                p.image_url,
                p.category
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         ORDER BY sl.created_at DESC`
      )
      .all();

    res.json(rows.map(formatItem));
  } catch (err) {
    console.error('[list GET /]', err);
    res.status(500).json({ error: 'Failed to fetch shopping list' });
  }
});

// POST /api/list — add item (by barcode or custom name)
router.post('/', async (req, res) => {
  try {
    const { barcode, custom_name, quantity = 1, unit = 'unit', notes } = req.body;

    if (!barcode && !custom_name) {
      return res.status(400).json({ error: 'barcode or custom_name is required' });
    }

    const db = getDb();
    let productBarcode = null;

    if (barcode) {
      // Try local DB first
      let product = db
        .prepare('SELECT * FROM products WHERE barcode = ?')
        .get(barcode);

      if (!product) {
        product = await lookupBarcode(barcode);
      }

      if (product) {
        productBarcode = barcode;
      }
      // If still not found, we'll store the barcode reference anyway
      productBarcode = barcode;
    }

    const result = db
      .prepare(
        `INSERT INTO shopping_list (product_barcode, custom_name, quantity, unit, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(productBarcode, custom_name || null, quantity, unit, notes || null);

    const newItem = db
      .prepare(
        `SELECT sl.*, p.name AS product_name, p.brand, p.size AS product_size, p.description, p.image_url, p.category
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         WHERE sl.id = ?`
      )
      .get(result.lastInsertRowid);

    res.status(201).json(formatItem(newItem));
  } catch (err) {
    console.error('[list POST /]', err);
    res.status(500).json({ error: 'Failed to add item to list' });
  }
});

// PATCH /api/list/:id — update quantity, checked, or notes
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { quantity, checked, notes } = req.body;

    const existing = db
      .prepare('SELECT * FROM shopping_list WHERE id = ?')
      .get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates = [];
    const values = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }
    if (checked !== undefined) {
      updates.push('checked = ?');
      values.push(checked ? 1 : 0);
      updates.push('checked_at = ?');
      values.push(checked ? new Date().toISOString() : null);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE shopping_list SET ${updates.join(', ')} WHERE id = ?`).run(
      ...values
    );

    const updated = db
      .prepare(
        `SELECT sl.*, p.name AS product_name, p.brand, p.size AS product_size, p.description, p.image_url, p.category
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         WHERE sl.id = ?`
      )
      .get(id);

    res.json(formatItem(updated));
  } catch (err) {
    console.error(`[list PATCH /${req.params.id}]`, err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/list/checked — remove all checked items
router.delete('/checked', (req, res) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM shopping_list WHERE checked = 1')
      .run();
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error('[list DELETE /checked]', err);
    res.status(500).json({ error: 'Failed to delete checked items' });
  }
});

// DELETE /api/list/:id — remove a single item
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const result = db
      .prepare('DELETE FROM shopping_list WHERE id = ?')
      .run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(`[list DELETE /${req.params.id}]`, err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/list/:id/refresh-prices — re-fetch prices for this item
router.post('/:id/refresh-prices', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const item = db
      .prepare(
        `SELECT sl.*, p.name AS product_name, p.brand
                , p.size AS product_size, p.description
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         WHERE sl.id = ?`
      )
      .get(id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const primarySearchQuery = getPrimarySearchQuery(item);
    const searchQueries = buildSearchQueries(item);
    if (!primarySearchQuery || searchQueries.length === 0) {
      return res.status(400).json({ error: 'No searchable name for this item' });
    }

    const entry = buildRefreshEntry(item);
    const tescoDecision = getStoreRefreshDecision(entry, 'tesco');
    const dunnesDecision = getStoreRefreshDecision(entry, 'dunnes');
    const tescoResults = await searchStorePrices('tesco', item, { forceRefresh: tescoDecision.forceRefresh });
    const dunnesResults = await searchStorePrices('dunnes', item, { forceRefresh: dunnesDecision.forceRefresh });

    res.json({
      id: item.id,
      search_query: primarySearchQuery,
      attempted_queries: searchQueries,
      refresh_policy: {
        tesco: {
          updated: tescoDecision.forceRefresh,
          next_refresh_at: tescoDecision.refreshStatus.nextRefreshAt,
        },
        dunnes: {
          updated: dunnesDecision.forceRefresh,
          next_refresh_at: dunnesDecision.refreshStatus.nextRefreshAt,
        },
      },
      prices: {
        tesco: tescoResults,
        dunnes: dunnesResults,
      },
    });
  } catch (err) {
    console.error(`[list POST /${req.params.id}/refresh-prices]`, err);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
});

// POST /api/list/refresh-prices — re-fetch prices for all unchecked items
router.post('/refresh-prices', async (req, res) => {
  try {
    const entries = getRefreshableListItems().map(buildRefreshEntry);
    const refreshed = [];
    const skipped = [];
    const refreshedById = new Map();
    const resultsByStoreKey = {
      tesco: new Map(),
      dunnes: new Map(),
    };

    for (const entry of entries) {
      if (entry.skipReason) {
        skipped.push({ id: entry.item.id, reason: entry.skipReason });
        continue;
      }

      refreshedById.set(entry.item.id, {
        id: entry.item.id,
        search_query: entry.primarySearchQuery,
        attempted_queries: entry.searchQueries,
        prices: {
          tesco: null,
          dunnes: null,
        },
      });
    }

    for (const store of ['tesco', 'dunnes']) {
      for (const entry of entries) {
        if (entry.skipReason) continue;

        const storeQueries = entry.storeQueries?.[store] || [];
        if (storeQueries.length === 0) continue;

        const queryKey = storeQueries.join(' || ');
        const decision = getStoreRefreshDecision(entry, store);
        const cacheKey = `${queryKey}::${decision.forceRefresh ? 'refresh' : 'locked'}`;
        const existingResults = resultsByStoreKey[store].get(cacheKey);
        const refreshedItem = refreshedById.get(entry.item.id);

        if (!refreshedItem) continue;

        refreshedItem.refresh_policy = refreshedItem.refresh_policy || {};
        refreshedItem.refresh_policy[store] = {
          updated: decision.forceRefresh,
          next_refresh_at: decision.refreshStatus.nextRefreshAt,
        };

        if (existingResults) {
          refreshedItem.prices[store] = existingResults;
          continue;
        }

        const storeResults = await searchStorePrices(store, entry.item, { forceRefresh: decision.forceRefresh });
        resultsByStoreKey[store].set(cacheKey, storeResults);
        refreshedItem.prices[store] = storeResults;
      }
    }

    refreshed.push(
      ...entries
        .filter((entry) => !entry.skipReason)
        .map((entry) => refreshedById.get(entry.item.id))
        .filter(Boolean)
    );

    res.json({
      refresh_order: ['tesco', 'dunnes'],
      refreshed_count: refreshed.length,
      skipped_count: skipped.length,
      refreshed,
      skipped,
    });
  } catch (err) {
    console.error('[list POST /refresh-prices]', err);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
});

export default router;
