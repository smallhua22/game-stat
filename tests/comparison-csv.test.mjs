import test from 'node:test';
import assert from 'node:assert/strict';
import comparison from '../snapshot-comparison.js';
const context = { generatedAt: '2026-10-20T23:00:00Z', mode: 'pawapuro', sheet: 'hitters',
  metric: 'hr', filename: 'earlier.json', exportedAt: '2026-10-19T12:00:00Z' };
test('CSV has UTF-8 BOM, stable context headers, escaped text and CRLF records', () => {
  const rows = [['陳, "A"\nB', '1', '3', '+2', '可比較']];
  const csv = comparison.csv(rows, context);
  assert.ok(csv.startsWith('\ufeff"generated_at_utc","mode","sheet","metric","baseline_file"'));
  assert.ok(csv.endsWith('"陳, ""A""\nB","1","3","+2","可比較"\r\n'));
  assert.ok(csv.includes('"2026-10-20T23:00:00Z","pawapuro","hitters","hr","earlier.json","2026-10-19T12:00:00Z"'));
  assert.equal(rows[0][0], '陳, "A"\nB');
});
test('untrusted player names and source metadata cannot become spreadsheet formulas', () => {
  for (const text of ['=HYPERLINK("x")', '+SUM(1)', '-1+2', '@SUM(1)', '\t =1+1', '\r\n-1', '  +5']) {
    const csv = comparison.csv([[text, '—', '0', '—', '缺少或無效數值']], { ...context, filename: text, exportedAt: text });
    const escaped = '"\'' + text.replace(/"/g, '""') + '"';
    assert.equal(csv.split(escaped).length - 1, 3);
  }
});
test('both modes retain displayed innings, missing values, rates and unmatched rows', () => {
  for (const mode of ['pawapuro', 'prospi']) {
    for (const field of ['ip', 'avg']) {
      const data = comparison.compare([{ name: 'P', ip: '11.1', slashLine: '.300/.400/.500' }],
        [{ name: 'P', ip: '10.2', slashLine: '.250/.350/.450' }, { name: 'Removed', ip: '' }], field);
      const rows = data.map((r) => [r.name, comparison.format(r.before, field), comparison.format(r.after, field),
        comparison.format(r.delta, field, true), r.status || '可比較']);
      const csv = comparison.csv(rows, { ...context, mode, metric: field });
      assert.ok(csv.includes(field === 'ip' ? '"10.2","11.1","+0.2"' : '"0.25","0.3","+0.05"'));
      assert.ok(csv.includes('"Removed","—","—","—","目前無此選手"'));
    }
  }
});
test('empty comparison produces a header only, not a fictitious player or zero', () => {
  const csv = comparison.csv([], context);
  assert.equal(csv.split('\r\n').length, 2);
  assert.ok(csv.endsWith('"status"\r\n'));
});
