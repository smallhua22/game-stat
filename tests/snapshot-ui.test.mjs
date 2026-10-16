import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import comparison from "../snapshot-comparison.js";

// Run the real comparison handlers/rendering with a minimal in-memory DOM.
// No cloud client, save function, network, or browser is supplied.
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
    SnapshotComparison: comparison, modes: { pawapuro: { label: "Pawapuro" }, prospi: { label: "Prospi" } },
    Option: function (label, value) { return { label, value }; },
    getSheetConfig: () => ({ columns: ["hr", "era", "ip"].map((field) => ({ field, label: field })) }),
    getActivePlayers: () => players[state.activeSheet] });
  vm.runInContext(block, context);
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
  assert.deepEqual(row(), ["P", "10⅔", "11⅓", "+0⅔", "可比較"]);
  h.clear();
  assert.equal(h.el("#snapshotResults").hidden, true);
  assert.equal(h.el("#clearSnapshot").disabled, true);
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
