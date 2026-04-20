import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

/**
 * Finds the best (lowest) price for a given search query across tesco and dunnes.
 * Only considers non-expired cache entries.
 * @param {string} searchQuery
 * @returns {{ best_price: number|null, best_store: string|null }}
 */
function getBestPrice(searchQuery) {
  if (!searchQuery) return { best_price: null, best_store: null };

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT store, price
       FROM price_cache
       WHERE search_query = ?
         AND price IS NOT NULL
         AND expires_at > datetime('now')
       ORDER BY price ASC
       LIMIT 1`
    )
    .all(searchQuery);

  if (rows.length === 0) return { best_price: null, best_store: null };

  return { best_price: rows[0].price, best_store: rows[0].store };
}

// GET /api/ha/sync — Home Assistant REST sensor payload
router.get('/sync', (req, res) => {
  try {
    const db = getDb();

    const allItems = db
      .prepare(
        `SELECT sl.*,
                p.name  AS product_name,
                p.brand
         FROM shopping_list sl
         LEFT JOIN products p ON sl.product_barcode = p.barcode
         ORDER BY sl.created_at DESC`
      )
      .all();

    const uncheckedCount = allItems.filter((r) => r.checked === 0).length;

    let totalEstimated = 0;
    const items = allItems
      .filter((r) => r.checked === 0)
      .map((r) => {
        const name = r.product_name || r.custom_name || 'Unknown';
        const searchQuery = r.product_name || r.custom_name || null;
        const { best_price, best_store } = getBestPrice(searchQuery);

        if (best_price !== null) {
          totalEstimated += best_price * (r.quantity || 1);
        }

        return {
          name,
          quantity: r.quantity || 1,
          checked: false,
          best_price: best_price,
          best_store: best_store,
        };
      });

    res.json({
      state: uncheckedCount,
      attributes: {
        items,
        total_estimated: Math.round(totalEstimated * 100) / 100,
        last_updated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[ha GET /sync]', err);
    res.status(500).json({ error: 'Failed to generate HA sync payload' });
  }
});

export default router;
