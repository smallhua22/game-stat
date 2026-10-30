import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Set LINK_INTEGRATION_HTML to a temporary composition of #7 + #9 to exercise
// #7's actual handler and writer without adding its feature to this branch.
const html = readFileSync(process.env.LINK_INTEGRATION_HTML || new URL('../index.html', import.meta.url), 'utf8');
const wrapper = html.slice(html.indexOf('    async function saveModeToCloud('), html.indexOf('    async function writeModeToCloud('));
const tick = () => new Promise(setImmediate);
for (const result of [true, false, undefined]) test(`queued save propagates ${result} and cleans up after settlement`, async () => {
  const releases = [];
  const ctx = vm.createContext({ currentUser: { id: 'owner' }, modeDataCache: { pawapuro: {} },
    writeModeToCloud: () => new Promise((resolve) => releases.push(resolve)) });
  vm.runInContext(wrapper, ctx);
  const first = ctx.saveModeToCloud('pawapuro');
  await tick();
  const second = ctx.saveModeToCloud('pawapuro');
  releases[0](result);
  assert.equal(await first, result);
  await tick();
  assert.equal(ctx.saveModeToCloud.queue.size, 1);
  releases[1](result);
  assert.equal(await second, result);
  assert.equal(ctx.saveModeToCloud.queue.size, 0);
});
test('writer rejection reaches caller, releases queue, and allows retry', async () => {
  const failure = new Error('writer failed');
  const ctx = vm.createContext({ currentUser: { id: 'owner' }, modeDataCache: { pawapuro: {} },
    writeModeToCloud: async () => { throw failure; } });
  vm.runInContext(wrapper, ctx);
  await assert.rejects(ctx.saveModeToCloud('pawapuro'), (error) => error === failure);
  assert.equal(ctx.saveModeToCloud.queue.size, 0);
  ctx.writeModeToCloud = async () => true;
  assert.equal(await ctx.saveModeToCloud('pawapuro'), true);
});

const handlerStart = html.indexOf('    document.querySelector("#saveLinks").addEventListener("click", async () => {');
if (process.env.LINK_INTEGRATION_HTML) assert.ok(handlerStart >= 0, 'Integration HTML must include PR7 saveLinks handler');
for (const expected of [null, 'previous-version']) test(`PR7 integration: successful ${expected ? 'update' : 'upsert'} closes matching dialog`,
  { skip: handlerStart < 0 ? 'Run with LINK_INTEGRATION_HTML pointing to the temporary #7 + #9 composition' : false }, async () => {
    const nodes = new Map(), writes = [];
    const node = (id) => {
      if (!nodes.has(id)) nodes.set(id, { disabled: false, textContent: '', open: true,
        close() { this.open = false; }, addEventListener(_, callback) { this.click = callback; } });
      return nodes.get(id);
    };
    const current = { sheets: { hitters: [], pitchers: [] } }, snapshot = { key: 'snapshot', data: {} };
    const record = { hitters: [], pitchers: [] };
    const ctx = vm.createContext({ currentUser: { id: 'owner' }, state: { activeMode: 'pawapuro' },
      modeDataCache: { pawapuro: current }, modeUpdatedAt: { pawapuro: expected }, SCHEMA_VERSION: 2,
      comparisonSnapshots: { pawapuro: snapshot }, linkSession: { mode: 'pawapuro', current, snapshot, selections: {} },
      LegacyLinking: { resolve: () => record }, getActiveModeData: () => current,
      document: { querySelector: node, querySelectorAll: () => [] }, linkDialog: node('#linkDialog'),
      outputEl: {}, buildExport: () => current, window: { clearTimeout() {} }, cloudSaveTimer: 1,
      setStatus() {}, console, renderSnapshotComparison() { ctx.rendered = true; },
      supabaseClient: { from() {
        const query = { upsert(value) { writes.push(value.data); return query; }, update(value) { writes.push(value.data); return query; },
          eq() { return query; }, select() { return query; }, maybeSingle: async () => ({ data: { updated_at: 'saved' } }) };
        return query;
      } } });
    vm.runInContext(html.slice(html.indexOf('    async function saveModeToCloud('), html.indexOf('    async function onStaleConflict(')), ctx);
    vm.runInContext(html.slice(handlerStart, html.indexOf('    function toNumber(', handlerStart)), ctx);
    await node('#saveLinks').click();
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(writes[0].legacyLinks)), { snapshot: record });
    assert.equal(ctx.modeUpdatedAt.pawapuro, 'saved');
    assert.equal(node('#linkDialog').open, false);
    assert.equal(node('#linkError').textContent, '');
    assert.equal(node('#saveLinks').disabled, false);
    assert.equal(ctx.rendered, true);
    assert.equal(ctx.saveModeToCloud.queue.size, 0);
  });
