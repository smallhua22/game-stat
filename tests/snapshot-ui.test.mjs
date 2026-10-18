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
