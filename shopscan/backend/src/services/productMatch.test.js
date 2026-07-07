import test from 'node:test';
import assert from 'node:assert/strict';
import { assessStoreMatch, scoreStoreResult } from './productMatch.js';

const milkItem = {
  brand: 'Avonmore',
  product_name: 'Fresh Milk',
  product_size: '2L',
};

test('scoreStoreResult ranks the right product above lookalikes', () => {
  const exact = { store_product_name: 'Avonmore Fresh Milk 2L', price: 2.75 };
  const wrongSize = { store_product_name: 'Avonmore Fresh Milk 500ml', price: 1.2 };
  const wrongBrand = { store_product_name: 'Tesco Fresh Milk 2L', price: 2.19 };
  const unrelated = { store_product_name: 'Chocolate Digestives', price: 2.0 };

  const exactScore = scoreStoreResult(milkItem, exact, 'tesco');
  assert.ok(exactScore >= 0.75, `expected confident score, got ${exactScore}`);
  assert.ok(exactScore > scoreStoreResult(milkItem, wrongSize, 'tesco'));
  assert.ok(exactScore > scoreStoreResult(milkItem, wrongBrand, 'tesco'));
  assert.equal(scoreStoreResult(milkItem, unrelated, 'tesco'), 0);
});

test('scoreStoreResult tolerates plural/spelling variants', () => {
  const item = { product_name: 'Greek Yoghurts' };
  const result = { store_product_name: 'Tesco Greek Yogurt 500g', price: 1.8 };

  assert.ok(scoreStoreResult(item, result, 'tesco') > 0.9);
});

test('brand mismatch is flagged for review', () => {
  const item = { brand: 'Finish', product_name: 'Dishwasher Tablets' };
  const result = { store_product_name: 'Fairy Dishwasher Tablets 60 Pack', price: 9.0 };

  const assessment = assessStoreMatch(item, result, 'tesco');

  assert.equal(assessment.needs_review, true);
  assert.equal(assessment.match_label, 'Different brand');
});

test('own-brand substitution across stores is not flagged as brand mismatch', () => {
  const item = { brand: 'Tesco', product_name: 'Dishwasher Tablets', product_size: '40 pack' };
  const result = { store_product_name: 'Dunnes Stores Dishwasher Tablets 40 Pack', price: 4.5 };

  const assessment = assessStoreMatch(item, result, 'dunnes');

  assert.equal(assessment.needs_review, false);
  assert.notEqual(assessment.match_label, 'Different brand');
});

test('matching brand keeps exact match status', () => {
  const result = { store_product_name: 'Avonmore Fresh Milk 2L', price: 2.75 };

  const assessment = assessStoreMatch(milkItem, result, 'tesco');

  assert.equal(assessment.match_status, 'exact');
  assert.equal(assessment.needs_review, false);
});
