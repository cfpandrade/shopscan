import { Router } from 'express';
import { getDb } from '../db.js';
import { lookupBarcode } from '../services/openFoodFacts.js';
import { searchTesco } from '../services/tesco.js';
import { searchDunnes } from '../services/dunnes.js';

const router = Router();

/**
 * Fetches the latest price cache entries for a given search query.
 * Returns { tesco: {...}|null, dunnes: {...}|null }
 */
function getLatestPrices(searchQuery) {
  if (!searchQuery) return { tesco: null, dunnes: null };

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT store, price, price_per_unit, product_url, store_product_name, fetched_at
       FROM price_cache
       WHERE search_query = ?
         AND expires_at > datetime('now')
       ORDER BY fetched_at DESC`
    )
    .all(searchQuery);

  const prices = { tesco: null, dunnes: null };
  for (const row of rows) {
    if (!prices[row.store]) {
      prices[row.store] = {
        price: row.price,
        price_per_unit: row.price_per_unit,
        product_url: row.product_url,
        store_product_name: row.store_product_name,
        fetched_at: row.fetched_at,
      };
    }
  }
  return prices;
}

/**
 * Formats a raw DB row into the public item shape.
 */
function formatItem(row) {
  const name = row.product_name || row.custom_name || 'Unknown';
  const searchQuery = row.product_name || row.custom_name || null;
  const prices = getLatestPrices(searchQuery);

  return {
    id: row.id,
    name,
    brand: row.brand || null,
    image_url: row.image_url || null,
    barcode: row.product_barcode || null,
    category: row.category || null,
    quantity: row.quantity,
    unit: row.unit,
    checked: row.checked === 1,
    notes: row.notes || null,
    created_at: row.created_at,
    checked_at: row.checked_at || null,
    prices,
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
        `SELECT sl.*, p.name AS product_name, p.brand, p.image_url, p.category
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
        `SELECT sl.*, p.name AS product_name, p.brand, p.image_url, p.category
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
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         WHERE sl.id = ?`
      )
      .get(id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const searchQuery = item.product_name || item.custom_name;
    if (!searchQuery) {
      return res.status(400).json({ error: 'No searchable name for this item' });
    }

    const [tescoResults, dunnesResults] = await Promise.all([
      searchTesco(searchQuery),
      searchDunnes(searchQuery),
    ]);

    res.json({
      id: item.id,
      search_query: searchQuery,
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

export default router;
