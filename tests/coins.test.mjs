import test from 'node:test';
import assert from 'node:assert/strict';
import { coinProgress } from '../coins.mjs';

test('coins appear only at complete $10 thresholds, using unrounded amounts', () => {
  for (const [amount, count] of [[0, 0], [9.999999, 0], [10, 1], [19.999999, 1], [20, 2], [129.4, 12]]) {
    assert.equal(coinProgress(amount).count, count);
  }
});

test('remaining amount rounds upward and resets after each coin', () => {
  assert.deepEqual(coinProgress(0), { count: 0, remaining: 10 });
  assert.deepEqual(coinProgress(9.999999), { count: 0, remaining: .01 });
  assert.deepEqual(coinProgress(10), { count: 1, remaining: 10 });
  assert.deepEqual(coinProgress(12.341), { count: 1, remaining: 7.66 });
});

test('count can be derived again after restoring time or switching courses', () => {
  assert.equal(coinProgress(932.75).count, 93);
  assert.equal(coinProgress(0).count, 0);
  assert.equal(coinProgress(9999999.99).count, 999999);
});
