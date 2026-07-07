import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTescoResultsFromHtml, isOwnBrand } from './storeParsing.js';

function tescoTile({ href, name, price }) {
  return `
    <li data-testid="product-tile" data-auto-available="true">
      <h2><a href="${href}">${name}</a></h2>
      <div class="ddsweb-price__container"><span class="priceText">€${price}</span></div>
    </li>
  `;
}

function tescoSearchHtml(tiles) {
  return `<ul>${tiles.map(tescoTile).join('')}</ul>`;
}

test('isOwnBrand detects each store own label', () => {
  assert.equal(isOwnBrand('tesco', 'Tesco Dishwasher Tablets 40 Pack'), true);
  assert.equal(isOwnBrand('tesco', 'Finish Quantum Dishwasher Tablets'), false);
  assert.equal(isOwnBrand('dunnes', 'Dunnes Stores Dishwasher Tablets'), true);
  assert.equal(isOwnBrand('dunnes', 'St Bernard Kitchen Roll'), true);
  assert.equal(isOwnBrand('dunnes', 'Finish Quantum Dishwasher Tablets'), false);
});

test('own brand wins when match quality is equal (generic query)', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Finish Quantum Dishwasher Tablets', price: '15.50' },
    { href: '/products/2', name: 'Tesco Dishwasher Tablets', price: '4.00' },
  ]);

  const results = extractTescoResultsFromHtml(html, 'dishwasher tablets');

  assert.equal(results[0].store_product_name, 'Tesco Dishwasher Tablets');
  assert.equal(results[0].price, 4);
});

test('explicit brand query still beats own brand', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Finish Quantum Dishwasher Tablets', price: '15.50' },
    { href: '/products/2', name: 'Tesco Dishwasher Tablets', price: '4.00' },
  ]);

  const results = extractTescoResultsFromHtml(html, 'finish dishwasher tablets');

  assert.equal(results[0].store_product_name, 'Finish Quantum Dishwasher Tablets');
});

test('tokens match whole words only, not substrings', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Graham Crackers Original', price: '2.50' },
    { href: '/products/2', name: 'Cooked Ham Slices', price: '3.00' },
  ]);

  const results = extractTescoResultsFromHtml(html, 'ham');

  assert.equal(results.length, 1);
  assert.equal(results[0].store_product_name, 'Cooked Ham Slices');
});

test('results sharing no words with the query are dropped (suggestion tiles)', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Chocolate Digestives', price: '2.00' },
    { href: '/products/2', name: 'Sparkling Water 2L', price: '1.00' },
  ]);

  const results = extractTescoResultsFromHtml(html, '5011157888897');

  assert.equal(results.length, 0);
});

test('plural and spelling variants still match', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Tesco Greek Style Yogurt 500g', price: '1.80' },
  ]);

  const results = extractTescoResultsFromHtml(html, 'yoghurts greek');

  assert.equal(results.length, 1);
  assert.equal(results[0].store_product_name, 'Tesco Greek Style Yogurt 500g');
});

test('matching size outranks a different pack size', () => {
  const html = tescoSearchHtml([
    { href: '/products/1', name: 'Avonmore Fresh Milk 500ml', price: '1.20' },
    { href: '/products/2', name: 'Avonmore Fresh Milk 2L', price: '2.75' },
  ]);

  const results = extractTescoResultsFromHtml(html, 'Avonmore Fresh Milk 2L');

  assert.equal(results[0].store_product_name, 'Avonmore Fresh Milk 2L');
});

test('no-results pages return no products even when suggestion tiles exist', () => {
  const html = `
    <div><p>Sorry, we couldn't find any results for "gibberish".</p>
    <ul>${tescoTile({ href: '/products/1', name: 'Popular Gibberish Snack', price: '3.00' })}</ul></div>
  `;

  const results = extractTescoResultsFromHtml(html, 'gibberish');

  assert.equal(results.length, 0);
});
