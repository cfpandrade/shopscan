import { Router } from 'express';
import { getDb } from '../db.js';
import { lookupBarcode } from '../services/openFoodFacts.js';

const router = Router();

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const db = getDb();
    const { barcode } = req.params;

    let product = db
      .prepare('SELECT * FROM products WHERE barcode = ?')
      .get(barcode);

    if (!product) {
      product = await lookupBarcode(barcode);
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error(`[products GET /barcode/${req.params.barcode}]`, err);
    res.status(500).json({ error: 'Failed to look up product' });
  }
});

// GET /api/products/search?q=
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const db = getDb();
    const like = `%${q.trim()}%`;
    const products = db
      .prepare(
        `SELECT * FROM products
         WHERE name LIKE ? OR brand LIKE ?
         LIMIT 20`
      )
      .all(like, like);

    res.json(products);
  } catch (err) {
    console.error('[products GET /search]', err);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// POST /api/products/manual — add a product manually
router.post('/manual', (req, res) => {
  try {
    const { name, brand, image_url } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const db = getDb();
    const barcode = `manual_${Date.now()}`;

    db.prepare(
      `INSERT INTO products (barcode, name, brand, image_url)
       VALUES (?, ?, ?, ?)`
    ).run(barcode, name.trim(), brand || null, image_url || null);

    const product = db
      .prepare('SELECT * FROM products WHERE barcode = ?')
      .get(barcode);

    res.status(201).json(product);
  } catch (err) {
    console.error('[products POST /manual]', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

export default router;
