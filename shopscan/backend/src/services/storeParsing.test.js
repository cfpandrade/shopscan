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
