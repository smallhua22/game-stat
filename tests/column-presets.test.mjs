import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('    function saveColumnVisibility()'), html.indexOf('    function getColumnWidth('));
function harness() {
  const columns = [{ field: 'name' }, { field: 'hr' }, { field: 'empty' }, { field: 'computed', compute: () => '' }];
  const handlers = {}, stored = [], renders = [], statuses = [];
  const state = { activeMode: 'pawapuro', activeSheet: 'hitters' };
  const columnVisibility = {};
  const context = vm.createContext({ state, columnVisibility, nameColumn: columns[0], COLUMN_VISIBILITY_KEY: 'columns',
    getSheetConfig: () => ({ columns }), getColumnValue: (p, c) => c.compute ? c.compute(p) : p[c.field] ?? '',
    localStorage: { setItem: (key, value) => stored.push(JSON.parse(value)) },
    document: { querySelector: (id) => ({ addEventListener: (type, fn) => { handlers[id] = fn; } }) },
    render: (options) => renders.push(options), setStatus: (text) => statuses.push(text), console: { warn() {} } });
  vm.runInContext(block, context);
  return { context, state, columnVisibility, handlers, stored, renders, statuses, columns };
}
for (const mode of ['pawapuro', 'prospi']) for (const sheet of ['hitters', 'pitchers']) {
  test(`${mode}/${sheet}: all and auto preserve other scopes and expose empty fields`, () => {
    const h = harness(); Object.assign(h.state, { activeMode: mode, activeSheet: sheet });
    h.columnVisibility.other = { hr: false };
    const players = [{ name: 'A', hr: '0', empty: ' ' }];
    const visible = () => Array.from(h.context.getVisibleColumns({ columns: h.columns }, players), (c) => c.field);
    assert.deepEqual(visible(), ['name', 'hr', 'computed']);
    h.handlers['#showAllColumns']();
    assert.deepEqual(visible(), ['name', 'hr', 'empty', 'computed']);
    assert.equal(h.stored.at(-1)[`${mode}:${sheet}`].empty, true);
    h.handlers['#autoColumns']();
    assert.deepEqual(visible(), ['name', 'hr', 'computed']);
    players[0].empty = 'new data';
    assert.ok(visible().includes('empty'), 'automatic is dynamic, not a frozen checkbox list');
    assert.deepEqual(h.columnVisibility.other, { hr: false });
    assert.ok(h.renders.every((options) => options.save === false));
    assert.deepEqual(players, [{ name: 'A', hr: '0', empty: 'new data' }]);
  });
}
test('storage failure still applies the view with an honest recovery message', () => {
  const h = harness(); h.context.localStorage.setItem = () => { throw new Error('storage blocked'); };
  h.handlers['#showAllColumns']();
  assert.equal(h.columnVisibility['pawapuro:hitters'].empty, true);
  assert.match(h.statuses.at(-1), /無法儲存偏好/);
  assert.equal(h.renders.length, 1);
});
test('view-only rendering skips cloud scheduling; data renders keep existing save behavior', () => {
  const block = html.slice(html.indexOf('    function render()'), html.indexOf('    function makeActionButton('));
  let saves = 0;
  const element = () => ({ innerHTML: '', textContent: '', style: { setProperty() {} } });
  const context = vm.createContext({ getSheetConfig: () => ({ label: 'Hitters', columns: [] }), getActivePlayers: () => [],
    getVisibleColumns: () => [], renderHeader() {}, renderColumnChecklist() {}, rowsEl: element(), modeSelectEl: {},
    playerSearchEl: { value: '' }, playerSearchScope: '', playerSearchData: null, getActiveModeData: () => ({}), applyPlayerSearch() {},
    state: { activeMode: 'pawapuro', activeSheet: 'hitters' }, tabButtons: [], addButtonEl: {}, sheetTitleEl: {},
    modes: { pawapuro: { label: 'Pawapuro' } }, outputEl: {}, buildExport: () => ({}), countEl: {}, metadataFolded: false,
    tableWrapEl: element(), getTableMinWidth: () => 520, applyMetadataFold() {}, renderSnapshotComparison() {}, saveState: () => saves++ });
  vm.runInContext(block, context);
  context.render({ save: false }); assert.equal(saves, 0);
  context.render(); assert.equal(saves, 1);
});
