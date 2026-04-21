import { Router } from 'express';
import { fetchStorePrices } from '../services/storePrices.js';

const router = Router();

// GET /api/prices/:query — fetch prices for a URL-encoded search query
router.get('/:query', async (req, res) => {
  try {
    const query = decodeURIComponent(req.params.query);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const { tesco: tescoResults, dunnes: dunnesResults } = await fetchStorePrices(query);

    res.json({
      query,
      tesco: tescoResults,
      dunnes: dunnesResults,
    });
  } catch (err) {
    console.error(`[prices GET /${req.params.query}]`, err);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// POST /api/prices/refresh — bulk price refresh (max 10 queries)
router.post('/refresh', async (req, res) => {
  try {
    const { queries } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'queries array is required' });
    }

    const limited = queries.slice(0, 10);

    const results = {};

    await Promise.all(
      limited.map(async (query) => {
        if (!query || typeof query !== 'string') return;

        const { tesco: tescoResults, dunnes: dunnesResults } = await fetchStorePrices(query);

        results[query] = {
          tesco: tescoResults,
          dunnes: dunnesResults,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error('[prices POST /refresh]', err);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
});

export default router;
