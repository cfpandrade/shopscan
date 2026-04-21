import { searchTesco } from './tesco.js';
import { searchDunnes } from './dunnes.js';

const STORE_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 12000);

function timeoutResult(store) {
  return [{ store, price: null, error: 'timeout' }];
}

function withTimeout(promise, store) {
  let timer;

  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(timeoutResult(store)), STORE_TIMEOUT_MS);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}

export async function fetchStorePrices(query) {
  const [tesco, dunnes] = await Promise.all([
    withTimeout(searchTesco(query), 'tesco'),
    withTimeout(searchDunnes(query), 'dunnes'),
  ]);

  return { tesco, dunnes };
}
