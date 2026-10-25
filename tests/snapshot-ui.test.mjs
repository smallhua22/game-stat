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

test("delta ordering is numeric, stable, reversible, and leaves data untouched", async () => {
  const h = harness();
  h.players.hitters = [
    { name: "Ten", hr: "13" }, { name: "Two", hr: "5" }, { name: "Negative", hr: "1" },
    { name: "Tie", hr: "5" }, { name: "Missing", hr: "" }, { name: "New", hr: "9" }
  ];
  const data = snapshot();
  data.sheets.hitters = h.players.hitters.slice(0, 5).map((p) => ({ name: p.name, hr: "3" }));
  data.sheets.hitters.push({ name: "Removed", hr: "8" });
  const original = JSON.stringify(h.players);
  assert.equal(h.el("#snapshotOrder").disabled, true);
  await h.upload(data);
  const names = () => h.el("#snapshotRows").children.map((row) => row.children[0].textContent);
  const order = (value) => { h.el("#snapshotOrder").value = value; h.el("#snapshotOrder").listeners.change(); };
  order("descending");
  assert.deepEqual(names(), ["Ten", "Two", "Tie", "Negative", "Missing", "New", "Removed"]);
  order("ascending");
  assert.deepEqual(names(), ["Negative", "Two", "Tie", "Ten", "Missing", "New", "Removed"]);
  order("original");
  assert.deepEqual(names(), ["Ten", "Two", "Negative", "Tie", "Missing", "New", "Removed"]);
  assert.equal(JSON.stringify(h.players), original);
  assert.equal(h.run("JSON.stringify(comparisonSnapshots.pawapuro.data)"), JSON.stringify(data));
});

test("ordering follows metric edits, uses displayed precision, and is scoped by mode and sheet", async () => {
  const h = harness();
  h.players.hitters = [{ name: "A", hr: "3.0004", slashLine: ".2/.3/.4" },
    { name: "B", hr: "3.0001", slashLine: ".4/.5/.6" }];
  h.players.pitchers = [{ name: "P", ip: "11.1", era: "3" }, { name: "Q", ip: "10.2", era: "1" }];
  const data = snapshot();
  data.sheets.hitters = [{ name: "A", hr: "3", slashLine: ".3/.3/.4" },
    { name: "B", hr: "3", slashLine: ".3/.5/.6" }];
  data.sheets.pitchers = [{ name: "P", ip: "10.2", era: "3" }, { name: "Q", ip: "10.1", era: "3" }];
  await h.upload(data);
  const names = () => h.el("#snapshotRows").children.map((row) => row.children[0].textContent);
  const change = (id, value) => { h.el(id).value = value; h.el(id).listeners.change(); };
  change("#snapshotOrder", "ascending");
  assert.deepEqual(names(), ["A", "B"]); // Both display as zero; retain source order.
  change("#snapshotMetric", "avg");
  assert.deepEqual(names(), ["A", "B"]);
  h.players.hitters[0].slashLine = ".9/.3/.4";
  h.render();
  assert.deepEqual(names(), ["B", "A"]);
  h.state.activeSheet = "pitchers"; h.render();
  assert.equal(h.el("#snapshotOrder").value, "original");
  change("#snapshotMetric", "ip"); change("#snapshotOrder", "descending");
  assert.deepEqual(names(), ["P", "Q"]); // +2 outs before +1 out.
  change("#snapshotOrder", "ascending");
  assert.deepEqual(names(), ["Q", "P"]);
  h.state.activeMode = "prospi"; h.render();
  assert.equal(h.el("#snapshotOrder").value, "original");
  assert.equal(h.el("#snapshotOrder").disabled, true);
  h.state.activeMode = "pawapuro"; h.state.activeSheet = "hitters"; h.render();
  assert.equal(h.el("#snapshotOrder").value, "ascending");
  h.clear();
  assert.equal(h.el("#snapshotOrder").disabled, true);
  await h.upload(data);
  assert.equal(h.el("#snapshotOrder").value, "ascending");
});


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
