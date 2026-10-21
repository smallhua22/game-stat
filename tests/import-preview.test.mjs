import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('    function importJsonFile('), html.indexOf('    function updateComputedCells('));
const data = (mode = 'pawapuro') => ({ mode, sheets: { hitters: [{ name: 'New' }], pitchers: [] } });
function harness(mode = 'pawapuro') {
  const readers = [], writes = [], nodes = new Map();
  const node = (id) => { if (!nodes.has(id)) nodes.set(id, { open: false, showModal() { this.open = true; }, close() { this.open = false; } }); return nodes.get(id); };
  const ctx = vm.createContext({ state: { activeMode: mode, activeSheet: 'pitchers' }, currentUser: { id: 'owner' },
    modes: { pawapuro: { label: 'Pawapuro' }, prospi: { label: 'Prospi' } },
    modeDataCache: { [mode]: { old: true } }, jsonFileEl: { value: 'file.json' },
    document: { querySelector: node }, console: { warn() {} }, cloudSaveTimer: 1,
    window: { clearTimeout() {} }, normalizeModeData: (mode, value) => ({ ...value, mode, activeSheet: 'hitters' }),
    render() { ctx.renders = (ctx.renders || 0) + 1; }, setStatus(text) { ctx.status = text; },
    saveModeToCloud(mode, options) { writes.push({ mode, options }); },
    FileReader: class { constructor() { readers.push(this); } addEventListener(_, callback) { this.load = callback; } readAsText() {} } });
  vm.runInContext(code, ctx);
  const start = (value, name = 'file.json') => { ctx.importJsonFile({ name }); const r = readers.at(-1); r.result = typeof value === 'string' ? value : JSON.stringify(value); return r; };
  return { ctx, writes, node, start };
}
for (const mode of ['pawapuro', 'prospi']) test(`${mode}: preview and cancel do not replace or write; explicit confirmation writes once`, () => {
  const h = harness(mode), original = h.ctx.modeDataCache[mode];
  h.start(data(mode), '<img src=x>').load();
  assert.equal(h.ctx.modeDataCache[mode], original);
  assert.equal(h.writes.length, 0);
  assert.match(h.node('#importSummary').textContent, /<img src=x>.*1 位打者、0 位投手/);
  assert.ok(h.node('#importPreview').open);
  h.ctx.finishImport(false);
  assert.equal(h.ctx.modeDataCache[mode], original);
  assert.equal(h.ctx.renders, undefined);
  assert.equal(h.writes.length, 0);
  h.start(data(mode)).load(); h.ctx.finishImport(true); h.ctx.finishImport(true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].mode, mode);
  assert.equal(h.writes[0].options.overwrite, true);
  assert.equal(h.ctx.state.activeSheet, 'hitters');
  assert.match(h.ctx.status, /正在同步/);
  assert.equal(h.node('#importPreview').open, false);
});
test('explicit target mode is previewed; other mode stays intact; legacy no-mode files use captured mode', () => {
  const h = harness(), original = h.ctx.modeDataCache.pawapuro;
  h.start(data('prospi')).load();
  assert.match(h.node('#importSummary').textContent, /Prospi/);
  assert.equal(h.ctx.state.activeMode, 'pawapuro');
  h.ctx.finishImport(true);
  assert.equal(h.ctx.modeDataCache.pawapuro, original);
  assert.equal(h.ctx.state.activeMode, 'prospi');
  h.start({ sheets: { hitters: [], pitchers: [] } }).load();
  assert.match(h.node('#importSummary').textContent, /Prospi.*0 位打者、0 位投手/);
});
test('invalid files and read errors never preview or mutate', () => {
  for (const value of ['{', null, [], {}, data('wrong'), data(['pawapuro']), data(null), { sheets: { hitters: [null], pitchers: [] } },
    { sheets: { hitters: [], pitchers: {} } }]) {
    const h = harness(), original = h.ctx.modeDataCache.pawapuro;
    h.start(value).load();
    assert.equal(h.ctx.modeDataCache.pawapuro, original);
    assert.equal(h.node('#importPreview').open, false);
    assert.equal(h.writes.length, 0);
    assert.match(h.ctx.status, /原有資料未變更/);
    assert.equal(h.ctx.jsonFileEl.value, '');
  }
  const h = harness(); h.start(data()).onerror();
  assert.match(h.ctx.status, /無法讀取/);
});
test('newest selection wins and stale reads/errors do not change its preview/status', () => {
  const h = harness(); const old = h.start(data(), 'old.json');
  h.start(data(), 'new.json').load(); old.load(); old.onerror();
  assert.match(h.node('#importSummary').textContent, /new.json/);
  assert.equal(h.writes.length, 0);
});
test('mode/account changes during reading or preview reject import', () => {
  for (const phase of ['reading', 'preview']) for (const change of ['mode', 'user']) {
    const h = harness(), r = h.start(data());
    if (phase === 'preview') r.load();
    if (change === 'mode') h.ctx.state.activeMode = 'prospi'; else h.ctx.currentUser = { id: 'other' };
    if (phase === 'reading') r.load(); else h.ctx.finishImport(true);
    assert.equal(h.ctx.modeDataCache.pawapuro.old, true);
    assert.equal(h.writes.length, 0);
    assert.match(h.ctx.status, /已變更/);
  }
});
test('import save waits for earlier in-flight writes and continues after a failure', async () => {
  const writes = [], releases = [];
  const ctx = vm.createContext({ currentUser: { id: 'owner' }, modeDataCache: { pawapuro: { sheets: {} } },
    writeModeToCloud: async (mode, options) => { writes.push(options.version); await new Promise((resolve, reject) => releases.push({ resolve, reject })); } });
  vm.runInContext(html.slice(html.indexOf('    async function saveModeToCloud('), html.indexOf('    async function writeModeToCloud(')), ctx);
  const old = ctx.saveModeToCloud('pawapuro', { version: 'old' });
  await new Promise(setImmediate);
  const imported = ctx.saveModeToCloud('pawapuro', { overwrite: true, version: 'import' });
  await new Promise(setImmediate);
  assert.deepEqual(writes, ['old']);
  releases[0].resolve(); await old; await new Promise(setImmediate);
  assert.deepEqual(writes, ['old', 'import']);
  releases[1].reject(new Error('failed save')); await assert.rejects(imported);
  const retry = ctx.saveModeToCloud('pawapuro', { version: 'retry' });
  await new Promise(setImmediate); releases[2].resolve(); await retry;
  assert.deepEqual(writes, ['old', 'import', 'retry']);
  assert.equal(ctx.saveModeToCloud.queue.size, 0);
});
test('stale older save cannot reload over a confirmed import or change its queued payload', async () => {
  let release, payload, reloads = 0;
  const ctx = vm.createContext({ currentUser: { id: 'owner' }, modeUpdatedAt: { pawapuro: 'before' }, SCHEMA_VERSION: 2,
    modeDataCache: { pawapuro: { sheets: { hitters: [{ name: 'old' }] } } },
    setStatus() {}, console: { warn() {} }, onStaleConflict() { reloads++; },
    supabaseClient: { from() {
      const q = { update() { return q; }, eq() { return q; }, select() { return q; },
        upsert(value) { payload = value.data; q.imported = true; return q; },
        maybeSingle() { return q.imported ? Promise.resolve({ data: { updated_at: 'imported' } }) : new Promise((resolve) => { release = resolve; }); } };
      return q;
    } } });
  vm.runInContext(html.slice(html.indexOf('    async function saveModeToCloud('), html.indexOf('    async function onStaleConflict(')), ctx);
  const old = ctx.saveModeToCloud('pawapuro'); await new Promise(setImmediate);
  ctx.modeDataCache.pawapuro = { sheets: { hitters: [{ name: 'confirmed import' }] } };
  const imported = ctx.saveModeToCloud('pawapuro', { overwrite: true });
  ctx.modeDataCache.pawapuro.sheets.hitters[0].name = 'later edit';
  release({ data: null }); await Promise.all([old, imported]);
  assert.equal(reloads, 0);
  assert.equal(payload.sheets.hitters[0].name, 'confirmed import');
  assert.equal(ctx.modeDataCache.pawapuro.sheets.hitters[0].name, 'later edit');
  assert.equal(ctx.modeUpdatedAt.pawapuro, 'imported');
});
