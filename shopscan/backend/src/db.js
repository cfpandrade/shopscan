import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || '/data/shopscan.db';

let db;

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((item) => item.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initDb() {
  db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      size TEXT,
      description TEXT,
      image_url TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shopping_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_barcode TEXT,
      custom_name TEXT,
      custom_brand TEXT,
      custom_size TEXT,
      custom_description TEXT,
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
      image_url TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_price_cache_query_store ON price_cache(search_query, store);
  `);

  ensureColumn('price_cache', 'image_url', 'TEXT');
  ensureColumn('products', 'description', 'TEXT');
  ensureColumn('products', 'size', 'TEXT');
  ensureColumn('shopping_list', 'custom_brand', 'TEXT');
  ensureColumn('shopping_list', 'custom_size', 'TEXT');
  ensureColumn('shopping_list', 'custom_description', 'TEXT');

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
