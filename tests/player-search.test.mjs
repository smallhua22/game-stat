import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function harness(names) {
  const players = names.map((name) => ({ name }));
  const elements = {};
  const el = (id) => elements[id] ||= { value: '', listeners: {}, focus() { this.focused = true; },
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  const rows = el('#rows');
  rows.children = names.map(() => ({ hidden: false,
    buttons: ['up', 'down'].map((move) => ({ dataset: { move } })),
    querySelectorAll() { return this.buttons; } }));
  const context = vm.createContext({ document: { querySelector: el }, rowsEl: rows,
    getActivePlayers: () => players });
  vm.runInContext(html.slice(html.indexOf('    const playerSearchEl ='), html.indexOf('    function render()')), context);
  const search = (value) => { el('#playerSearch').value = value; el('#playerSearch').listeners.input(); };
  return { el, rows, players, search, visible: () => rows.children.flatMap((r, i) => r.hidden ? [] : [i]) };
}
test('search is literal, trimmed, case-insensitive, and preserves duplicate original indices', () => {
  const h = harness(['Hidden', 'Alex', 'ALEX', '陳小明', '[A]']);
  h.search(' aLeX ');
  assert.deepEqual(h.visible(), [1, 2]);
  assert.match(h.el('#playerSearchStatus').textContent, /2 \/ 5/);
  assert.ok(h.rows.children.every((r) => r.buttons.every((b) => b.disabled)));
  h.search('小'); assert.deepEqual(h.visible(), [3]);
  h.search('['); assert.deepEqual(h.visible(), [4]);
  h.search('absent'); assert.deepEqual(h.visible(), []);
  assert.match(h.el('#playerSearchStatus').textContent, /沒有符合/);
  assert.equal(h.players.length, 5); // No persistence API exists in this harness.
});
test('clear and Escape restore boundaries, and whitespace is not an active filter', () => {
  const h = harness(['A', 'B', 'C']);
  h.search('B'); h.el('#clearPlayerSearch').listeners.click();
  assert.deepEqual(h.visible(), [0, 1, 2]);
  assert.equal(h.el('#playerSearch').focused, true);
  assert.equal(h.rows.children[0].buttons[0].disabled, true);
  assert.equal(h.rows.children[0].buttons[1].disabled, false);
  assert.equal(h.rows.children[2].buttons[1].disabled, true);
  h.search('missing'); let prevented = false;
  h.el('#playerSearch').listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.deepEqual(h.visible(), [0, 1, 2]);
  h.search('   '); assert.deepEqual(h.visible(), [0, 1, 2]);
  assert.equal(h.el('#playerSearchStatus').textContent, '');
});
test('renamed rows are rechecked on change rather than during typing', () => {
  const h = harness(['A', 'B']); h.search('B');
  h.players[1].name = 'C'; assert.deepEqual(h.visible(), [1]);
  h.rows.listeners.change({ target: { dataset: { field: 'name' } } });
  assert.deepEqual(h.visible(), []);
});
