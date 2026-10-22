import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const storage = html.slice(html.indexOf('    function buildStorageExport()'), html.indexOf('    function pickPlayerFields('));
const handlers = html.slice(html.indexOf('    function buildBackup()'), html.indexOf('    function importJsonFile('));
function harness(mode = 'pawapuro') {
  const data = { sheets: { hitters: [{ name: 'A', hr: '8', hidden: 'preserved', rowId: 'existing-id' }],
    pitchers: [{ name: 'P', ip: '10.2' }] } };
  const calls = [], timers = [];
  const link = { click() { calls.push('click'); }, remove() { calls.push('remove'); } };
  const context = vm.createContext({ state: { activeMode: mode, activeSheet: 'pitchers' },
    SCHEMA_VERSION: 2, getActiveModeData: () => data, Blob, Date,
    document: { createElement: () => link, body: { append() { calls.push('append'); } },
      querySelector: () => ({ addEventListener(type, fn) { context.click = fn; } }) },
    URL: { createObjectURL(blob) { context.blob = blob; return 'blob:backup'; },
      revokeObjectURL(url) { calls.push(url); } },
    setTimeout(fn) { timers.push(fn); }, console: { warn() {} },
    setStatus(text) { context.status = text; } });
  vm.runInContext(storage + handlers, context);
  return { data, calls, timers, link, context };
}
for (const mode of ['pawapuro', 'prospi']) test(`${mode}: backup includes both sheets, hidden fields, current edits and IDs`, async () => {
  const h = harness(mode);
  h.context.click();
  const backup = JSON.parse(await h.context.blob.text());
  assert.deepEqual(backup.sheets, h.data.sheets);
  assert.equal(backup.mode, mode);
  assert.equal(backup.activeSheet, 'pitchers');
  assert.equal(backup.schemaVersion, 2);
  assert.equal(new Date(backup.exportedAt).toISOString(), backup.exportedAt);
  assert.match(h.link.download, new RegExp(`^game-stat-${mode}-backup-.*\\.json$`));
  h.data.sheets.hitters[0].hr = '99';
  assert.equal(JSON.parse(await h.context.blob.text()).sheets.hitters[0].hr, '8');
  assert.deepEqual(h.calls, ['append', 'click', 'remove']);
  h.timers[0]();
  assert.equal(h.calls.at(-1), 'blob:backup');
});
test('failed download cleans up and does not change data or report success', () => {
  const h = harness(), before = JSON.stringify(h.data);
  h.link.click = () => { throw new Error('download blocked'); };
  h.context.click();
  assert.match(h.context.status, /無法建立備份/);
  assert.equal(JSON.stringify(h.data), before);
  assert.equal(h.calls.at(-1), 'remove');
  h.timers[0]();
  assert.equal(h.calls.at(-1), 'blob:backup');
});
test('unloaded data is not exported as an empty backup', () => {
  const h = harness();
  h.context.getActiveModeData = () => undefined;
  h.context.click();
  assert.match(h.context.status, /無法建立備份/);
  assert.equal(h.context.blob, undefined);
  assert.equal(h.timers.length, 0);
});
