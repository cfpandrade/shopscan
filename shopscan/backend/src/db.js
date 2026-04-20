import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || '/data/shopscan.db';

let db;

export function initDb() {
  db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      image_url TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shopping_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_barcode TEXT,
      custom_name TEXT,
      quantity INTEGER DEFAULT 1,
      unit TEXT DEFAULT 'unit',
      checked INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checked_at DATETIME,
      FOREIGN KEY (product_barcode) REFERENCES products(barcode)
    );

    CREATE TABLE IF NOT EXISTS price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_query TEXT NOT NULL,
      store TEXT NOT NULL,
      price REAL,
      price_per_unit TEXT,
      product_url TEXT,
      store_product_name TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_price_cache_query_store ON price_cache(search_query, store);
  `);

  console.log(`Database initialised at ${DB_PATH}`);
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return db;
}

export default { initDb, getDb };
