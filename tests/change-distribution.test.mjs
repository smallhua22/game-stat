import test from 'node:test';
import assert from 'node:assert/strict';
import comparison from '../snapshot-comparison.js';
const row = (delta, status = '') => ({ before: 2, after: 2 + delta, delta, status });
test('directions use displayed precision and keep inputs untouched', () => {
  const rows = [row(2), row(-1), row(0), row(0.0001), row(-0.0001), row(0.0006)];
  const before = structuredClone(rows);
  assert.deepEqual(comparison.distribution(rows), { increase: 2, unchanged: 3, decrease: 1,
    unavailable: 0, unmatched: 0, invalid: 0, total: 6 });
  assert.deepEqual(rows, before);
});
test('unmatched, missing and overflow rows never count as unchanged', () => {
  const counts = comparison.distribution([row(1, '快照無此選手'), row(0, '同名，無法配對'),
    row(null, '缺少或無效數值'), row(Infinity), { ...row(0), before: null }]);
  assert.deepEqual(counts, { increase: 0, unchanged: 0, decrease: 0,
    unavailable: 5, unmatched: 2, invalid: 3, total: 5 });
});
test('baseball innings use outs and both-version-only records remain visible', () => {
  const rows = comparison.compare([{ name: 'P', ip: '11.1' }, { name: 'Q', ip: '0.2' }],
    [{ name: 'P', ip: '10.2' }, { name: 'Q', ip: '1.0' }, { name: 'Old', ip: '2.0' }], 'ip');
  const counts = comparison.distribution(rows);
  assert.equal(counts.increase, 1); assert.equal(counts.decrease, 1);
  assert.equal(counts.unmatched, 1); assert.equal(counts.total, 3);
});
test('rates and empty inputs are safe without fabricated zeros', () => {
  const rows = comparison.compare([{ name: 'A', slashLine: '.300/.400/.500' }],
    [{ name: 'A', slashLine: '.2999/.400/.500' }], 'avg');
  assert.equal(comparison.distribution(rows).unchanged, 1);
  assert.deepEqual(comparison.distribution([]), { increase: 0, unchanged: 0, decrease: 0,
    unavailable: 0, unmatched: 0, invalid: 0, total: 0 });
});
