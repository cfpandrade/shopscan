import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import listRouter from './routes/list.js';
import productsRouter from './routes/products.js';
import pricesRouter from './routes/prices.js';
import haRouter from './routes/ha.js';

const PORT = process.env.PORT || 3001;

// Initialise database before starting the server
try {
  initDb();
} catch (err) {
  console.error('Failed to initialise database:', err);
  process.exit(1);
}

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/list', listRouter);
app.use('/api/products', productsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/ha', haRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ShopScan backend listening on port ${PORT}`);
});

export default app;
