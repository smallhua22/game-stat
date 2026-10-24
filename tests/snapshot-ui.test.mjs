import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import comparison from "../snapshot-comparison.js";

// Run the real comparison handlers/rendering with a minimal in-memory DOM.
// No cloud client, persistent storage, network, or browser is supplied.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = html.slice(html.indexOf("    const comparisonSnapshots = {}"), html.indexOf("    function toNumber(raw)"));
const snapshot = (hr = "3", mode = "pawapuro") => ({ schemaVersion: 2, mode,
  sheets: { hitters: [{ name: "A", hr }], pitchers: [{ name: "P", ip: "10.2", era: "3.2" }] } });

function harness() {
  const elements = new Map();
  const node = () => ({ listeners: {}, children: [], value: "",
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; } });
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const state = { activeMode: "pawapuro", activeSheet: "hitters" };
  const players = { hitters: [{ name: "A", hr: "8" }], pitchers: [{ name: "P", ip: "11.1", era: "3" }] };
  const context = vm.createContext({ document: { querySelector: el, createElement: node }, state,
    rowsEl: el("#rows"), outputEl: el("#output"), updateComputedCells() {}, saveState() {},
    buildExport: () => ({ sheets: players }),
    SnapshotComparison: comparison, modes: { pawapuro: { label: "Pawapuro" }, prospi: { label: "Prospi" } },
    Option: function (label, value) { return { label, value }; },
    getSheetConfig: () => ({ columns: ["hr", "era", "ip"].map((field) => ({ field, label: field })) }),
    getActivePlayers: () => players[state.activeSheet] });
  vm.runInContext(block, context);
  vm.runInContext(html.slice(html.indexOf('    rowsEl.addEventListener("input"'),
    html.indexOf("    tabButtons.forEach((button) => button.addEventListener")), context);
  const run = (code) => vm.runInContext(code, context);
  const render = () => run("renderSnapshotComparison()");
  const upload = (data, name = "earlier.json") => {
    el("#snapshotFile").files = [{ name, text: typeof data === "function" ? data : async () =>
      typeof data === "string" ? data : JSON.stringify(data) }];
    return el("#snapshotFile").listeners.change();
  };
  render();
  return { el, state, players, run, render, upload, clear: () => el("#clearSnapshot").listeners.click() };
}

test("real handlers render values, update with edits, switch sheets, and clear without saving", async () => {
  const h = harness();
  assert.equal(h.el("#snapshotMetric").disabled, true);
  await h.upload(snapshot());
  const row = () => h.el("#snapshotRows").children[0].children.map((cell) => cell.textContent);
  assert.deepEqual(row(), ["A", "3", "8", "+5", "可比較"]);
  assert.match(h.el("#snapshotStatus").textContent, /檔案未提供時間/);
  h.players.hitters[0].hr = "10";
  h.render();
  assert.equal(row()[3], "+7");
  h.state.activeSheet = "pitchers";
  h.render();
  h.el("#snapshotMetric").value = "ip";
  h.el("#snapshotMetric").listeners.change();
  assert.deepEqual(row(), ["P", "10.2", "11.1", "+0.2", "可比較"]);
  h.clear();
  assert.equal(h.el("#snapshotResults").hidden, true);
  assert.equal(h.el("#clearSnapshot").disabled, true);
});

test("typing ordinary baseball IP updates the real input handler without fractions", async () => {
  const h = harness();
  await h.upload(snapshot());
  h.state.activeSheet = "pitchers";
  h.render();
  h.el("#snapshotMetric").value = "ip";
  h.el("#snapshotMetric").listeners.change();
  for (const [ip, delta] of [["10.2", "0.0"], ["11.1", "+0.2"], ["0.2", "−10.0"]]) {
    h.el("#rows").listeners.input({ target: { dataset: { index: "0", field: "ip" },
      value: ip, closest: () => null } });
    assert.equal(h.players.pitchers[0].ip, ip);
    const row = h.el("#snapshotRows").children[0].children.map((cell) => cell.textContent);
    assert.deepEqual(row, ["P", "10.2", ip, delta, "可比較"]);
  }
});

test("invalid JSON and wrong-mode files preserve the previous snapshot", async () => {
  const h = harness();
  await h.upload(snapshot());
  await h.upload("{broken");
  assert.match(h.el("#snapshotStatus").textContent, /JSON 格式不正確/);
  await h.upload(snapshot("1", "prospi"));
  assert.match(h.el("#snapshotStatus").textContent, /相同模式/);
  assert.equal(h.run("comparisonSnapshots.pawapuro.data.sheets.hitters[0].hr"), "3");
});

test("damaged identities and cancelled file selection preserve the previous snapshot", async () => {
  const h = harness();
  await h.upload(snapshot());
  const previous = h.run("comparisonSnapshots.pawapuro");
  for (const duplicate of [false, true]) {
    const data = snapshot();
    data.sheets.hitters[0].rowId = duplicate ? "11111111-1111-4111-8111-111111111111" : "broken";
    if (duplicate) data.sheets.pitchers[0].rowId = data.sheets.hitters[0].rowId;
    await h.upload(data);
    assert.equal(h.run("comparisonSnapshots.pawapuro"), previous);
    assert.match(h.el("#snapshotStatus").textContent, /原有資料未變更/);
    assert.doesNotMatch(h.el("#snapshotStatus").textContent, /rowId|UUID|修正/);
  }
  h.el("#snapshotFile").files = [];
  await h.el("#snapshotFile").listeners.change();
  assert.equal(h.run("comparisonSnapshots.pawapuro"), previous);
  assert.doesNotMatch(html.match(/<p id="snapshotHelp">(.*?)<\/p>/)[1], /rowId|UUID/);
});

test("clearing a snapshot invalidates a pending replacement", async () => {
  const h = harness();
  await h.upload(snapshot());
  let finish;
  const pending = h.upload(() => new Promise((resolve) => { finish = resolve; }));
  h.clear();
  finish(JSON.stringify(snapshot("9")));
  await pending;
  assert.equal(h.run("comparisonSnapshots.pawapuro"), undefined);
  assert.equal(h.el("#snapshotResults").hidden, true);
});

test("newest selection wins; stale failures cannot replace its status", async () => {
  for (const oldResult of [JSON.stringify(snapshot("1")), "{broken"]) {
    const h = harness();
    let finish;
    const pending = h.upload(() => new Promise((resolve) => { finish = resolve; }), "old.json");
    await h.upload(snapshot("7"), "new.json");
    finish(oldResult);
    await pending;
    assert.equal(h.run("comparisonSnapshots.pawapuro.name"), "new.json");
    assert.match(h.el("#snapshotStatus").textContent, /new.json/);
  }
});

test("pending reads retain their mode without changing another mode's comparison", async () => {
  const h = harness();
  let finish;
  const pending = h.upload(() => new Promise((resolve) => { finish = resolve; }));
  h.state.activeMode = "prospi";
  await h.upload(snapshot("4", "prospi"), "prospi.json");
  finish(JSON.stringify(snapshot()));
  await pending;
  assert.match(h.el("#snapshotStatus").textContent, /prospi.json/);
  h.state.activeMode = "pawapuro";
  h.render();
  assert.match(h.el("#snapshotStatus").textContent, /earlier.json/);
});

for (const mode of ['pawapuro', 'prospi']) for (const sheet of ['hitters', 'pitchers']) {
  test(`${mode}/${sheet}: hide zero deltas without hiding missing rows or saving`, async () => {
    const h = harness(); Object.assign(h.state, { activeMode: mode, activeSheet: sheet });
    const field = sheet === 'hitters' ? 'hr' : 'ip';
    h.players[sheet] = [{ name: 'Same', [field]: '0' }, { name: 'Changed', [field]: '3' },
      { name: 'Invalid', [field]: '' }, { name: 'New', [field]: '2' }];
    const data = snapshot('3', mode);
    data.sheets[sheet] = [{ name: 'Same', [field]: '0' }, { name: 'Changed', [field]: '1' },
      { name: 'Invalid', [field]: '1' }, { name: 'Removed', [field]: '2' }];
    await h.upload(data);
    h.el('#snapshotMetric').value = field; h.el('#snapshotMetric').listeners.change();
    const before = JSON.stringify(h.players);
    h.run('saveState = () => { throw new Error("filter must not save"); }');
    h.el('#hideUnchanged').checked = true; h.el('#hideUnchanged').listeners.change();
    const names = () => h.el('#snapshotRows').children.map((row) => row.children[0].textContent);
    assert.deepEqual(names(), ['Changed', 'Invalid', 'New', 'Removed']);
    assert.match(h.el('#comparisonFilterStatus').textContent, /4 \/ 5/);
    assert.equal(JSON.stringify(h.players), before);
    h.players[sheet][1][field] = '1'; h.render();
    assert.deepEqual(names(), ['Invalid', 'New', 'Removed'], 'unsynced edits update the view');
    h.el('#hideUnchanged').checked = false; h.el('#hideUnchanged').listeners.change();
    assert.equal(names().length, 5);
  });
}
test('filter uses displayed precision, scopes choices and resets visibility on clear', async () => {
  const h = harness();
  assert.equal(h.el('#hideUnchanged').disabled, true);
  assert.equal(h.el('#comparisonFilterStatus').hidden, true);
  h.players.hitters = [{ name: 'A', hr: '3.0004', slashLine: '.300/.400/.500' }];
  const earlier = snapshot(); earlier.sheets.hitters[0].slashLine = '.300/.400/.500';
  await h.upload(earlier);
  h.el('#hideUnchanged').checked = true; h.el('#hideUnchanged').listeners.change();
  assert.equal(h.el('#snapshotRows').children.length, 0);
  assert.match(h.el('#comparisonFilterStatus').textContent, /全部差值顯示為零/);
  h.el('#snapshotMetric').value = 'avg'; h.el('#snapshotMetric').listeners.change();
  assert.equal(h.el('#snapshotRows').children.length, 0);
  h.players.hitters[0].slashLine = '.301/.400/.500'; h.render();
  assert.equal(h.el('#snapshotRows').children.length, 1);
  h.state.activeSheet = 'pitchers'; h.render(); assert.equal(h.el('#hideUnchanged').checked, false);
  h.state.activeSheet = 'hitters'; h.render(); assert.equal(h.el('#hideUnchanged').checked, true);
  h.state.activeMode = 'prospi'; h.render(); assert.equal(h.el('#hideUnchanged').checked, false);
  h.state.activeMode = 'pawapuro'; h.clear();
  assert.equal(h.el('#hideUnchanged').disabled, true);
  assert.equal(h.el('#comparisonFilterStatus').hidden, true);
  await h.upload(earlier); assert.equal(h.el('#hideUnchanged').checked, true);
});
test('empty and failed replacement snapshots keep honest filter feedback', async () => {
  const h = harness(); h.players.hitters = [];
  const empty = snapshot(); empty.sheets.hitters = [];
  await h.upload(empty); assert.match(h.el('#comparisonFilterStatus').textContent, /沒有可列出的選手/);
  await h.upload('{broken'); assert.match(h.el('#snapshotStatus').textContent, /無法比較/);
  assert.match(h.el('#comparisonFilterStatus').textContent, /0 \/ 0/);
});
