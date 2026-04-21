import fetch from 'node-fetch';
import { getDb } from '../db.js';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';

/**
 * Looks up a product by barcode via Open Food Facts.
 * Saves the result to the products table.
 * @param {string} barcode
 * @returns {object|null} { barcode, name, brand, size, description, image_url, category } or null
 */
export async function lookupBarcode(barcode) {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(barcode)}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ShopScan-IE/1.0 (home-assistant-addon)',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      console.warn(`[openFoodFacts] HTTP ${response.status} for barcode ${barcode}`);
      return null;
    }

    const json = await response.json();

    if (json.status !== 1 || !json.product) {
      console.info(`[openFoodFacts] Product not found for barcode ${barcode}`);
      return null;
    }

    const p = json.product;

    const name = p.product_name || p.product_name_en || null;
    if (!name) {
      console.info(`[openFoodFacts] No name for barcode ${barcode}`);
      return null;
    }

    const brand = p.brands || null;
    const size = p.quantity || null;
    const description =
      p.generic_name ||
      p.generic_name_en ||
      p.packaging_text ||
      null;
    const image_url = p.image_front_url || p.image_url || null;
    const rawCategory = Array.isArray(p.categories_tags) && p.categories_tags.length > 0
      ? p.categories_tags[0]
      : null;
    // Strip language prefix (e.g. "en:beverages" → "beverages")
    const category = rawCategory ? rawCategory.replace(/^[a-z]{2}:/, '') : null;

    const product = { barcode, name, brand, size, description, image_url, category };

    // Persist to products table
    try {
      const db = getDb();
      db.prepare(
        `INSERT OR REPLACE INTO products (barcode, name, brand, size, description, image_url, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(barcode, name, brand, size, description, image_url, category);
    } catch (dbErr) {
      console.error('[openFoodFacts] Failed to save product to DB:', dbErr.message);
    }

    return product;
  } catch (err) {
    console.error(`[openFoodFacts] Network/parse error for barcode ${barcode}:`, err.message);
    return null;
  }
}
