import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import linking from "../legacy-linking.js";
import identity from "../row-identity.js";
import comparison from "../snapshot-comparison.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const between = (start, end) => html.slice(html.indexOf(start), html.indexOf(end));
const id = () => webcrypto.randomUUID();
function harness(mode = "pawapuro") {
  const context = vm.createContext({ RowIdentity: identity, LegacyLinking: linking, SCHEMA_VERSION: 2, console,
    nameColumn: { field: "name" }, modes: {}, state: { activeMode: mode, activeSheet: "hitters" },
    modeDataCache: {}, modeUpdatedAt: {}, currentUser: { id: "test-user" },
    getColumnValue: (player, column) => player[column.field],
    getVisibleColumns: () => [{ field: "name" }], render() {}, setStatus() {},
    rowsEl: { querySelector: () => null } });
  vm.runInContext(between("    function makeSheet(", "    async function loadModeSeed("), context);
  const run = (code) => vm.runInContext(code, context);
  run(`for (const mode of ["pawapuro", "prospi"]) modes[mode] = { sheets: {
    hitters: makeSheet("H", [{ field: "hr" }]), pitchers: makeSheet("P", [{ field: "ip" }]) } };`);
  vm.runInContext(between("    function buildStorageExport(", "    function getActivePlayers("), context);
  vm.runInContext(between("    function addPlayer(", "    function switchSheet("), context);
  vm.runInContext(between("    async function saveModeToCloud(", "    async function onStaleConflict("), context);
  run(`function getActiveModeData() { return modeDataCache[state.activeMode]; }
    function getActivePlayers() { return getActiveModeData().sheets[state.activeSheet]; }`);
  return { context, run };
}

test("real row lifecycle preserves IDs in both modes and both sheets", () => {
  for (const mode of ["pawapuro", "prospi"]) {
    const h = harness(mode);
    h.run(`modeDataCache[state.activeMode] = normalizeModeData(state.activeMode, {});`);
    for (const sheet of ["hitters", "pitchers"]) {
      h.context.state.activeSheet = sheet;
      h.run("addPlayer(); getActivePlayers()[0].name = 'Before';");
      const originalId = h.run("getActivePlayers()[0].rowId");
      assert.ok(identity.valid(originalId));
      h.run("getActivePlayers()[0].name = 'Renamed'; duplicatePlayer(0); movePlayer(0, 1);");
      assert.equal(h.run("getActivePlayers()[1].rowId"), originalId);
      assert.notEqual(h.run("getActivePlayers()[0].rowId"), originalId);
      assert.equal(h.run("buildExport().sheets[state.activeSheet][1].rowId"), originalId);
      h.run(`modeDataCache[state.activeMode] = normalizeModeData(state.activeMode,
        JSON.parse(JSON.stringify(buildStorageExport())));`);
      assert.equal(h.run("getActivePlayers()[1].rowId"), originalId);
      h.run(`modeDataCache[state.activeMode] = normalizeModeData(state.activeMode,
        JSON.parse(JSON.stringify(buildExport())));`);
      assert.equal(h.run("getActivePlayers()[1].rowId"), originalId);
    }
  }
});

test("legacy migration is retained in actual cloud-save payload and reload", async () => {
  for (const mode of ["pawapuro", "prospi"]) {
    const h = harness(mode);
    let payload;
    const query = { eq() { return this; }, select() { return this; },
      async maybeSingle() { return { data: { updated_at: "next" }, error: null }; } };
    h.context.supabaseClient = { from: () => ({ update(value) { payload = value.data; return query; } }) };
    h.run(`modeDataCache[state.activeMode] = normalizeModeData(state.activeMode,
      { sheets: { hitters: [{ name: "A" }], pitchers: [{ name: "A" }] } });
      modeUpdatedAt[state.activeMode] = "previous";`);
    h.run(`modeDataCache[state.activeMode].legacyLinks = { ["a".repeat(64)]: {
      hitters: [getActiveModeData().sheets.hitters[0].rowId], pitchers: [getActiveModeData().sheets.pitchers[0].rowId] } };`);
    await h.run("saveModeToCloud(state.activeMode)");
    assert.deepEqual(JSON.parse(JSON.stringify(payload.legacyLinks)),
      JSON.parse(h.run("JSON.stringify(getActiveModeData().legacyLinks)")));
    assert.ok(identity.valid(payload.sheets.hitters[0].rowId));
    assert.notEqual(payload.sheets.hitters[0].rowId, payload.sheets.pitchers[0].rowId);
    h.context.saved = JSON.parse(JSON.stringify(payload));
    assert.equal(h.run('normalizeModeData(state.activeMode, saved).legacyLinks["a".repeat(64)].hitters[0]'), payload.sheets.hitters[0].rowId);
    assert.equal(h.run("normalizeModeData(state.activeMode, saved).sheets.hitters[0].rowId"),
      payload.sheets.hitters[0].rowId);
  }
});

test("invalid or duplicate imported IDs reject before replacing current data", () => {
  const h = harness();
  const shared = id();
  for (const bad of ["", null, 42, "not-a-uuid", shared.toUpperCase()]) {
    h.context.input = { sheets: { hitters: [{ name: "A", rowId: bad }], pitchers: [] } };
    assert.throws(() => h.run("normalizeModeData('pawapuro', input)"), /識別資訊/);
    assert.throws(() => comparison.validate({ ...h.context.input, schemaVersion: 2, mode: "pawapuro" }, "pawapuro"), /識別資訊/);
  }
  h.context.input = { sheets: { hitters: [{ name: "A", rowId: shared }], pitchers: [{ name: "B", rowId: shared }] } };
  assert.throws(() => h.run("normalizeModeData('pawapuro', input)"), /重複/);
});

test("IDs match renames and duplicate names but never merge distinct identities", () => {
  const a = id(), b = id();
  const before = [{ rowId: a, name: "Same", hr: "1" }, { rowId: b, name: "Same", hr: "2" }];
  const after = [{ rowId: b, name: "Same", hr: "5" }, { rowId: a, name: "Renamed", hr: "7" }];
  assert.deepEqual(comparison.compare(after, before, "hr").map((r) => r.delta), [3, 6]);
  const rows = comparison.compare([{ rowId: a, name: "Same", hr: "4" }],
    [{ rowId: b, name: "Same", hr: "1" }], "hr");
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.delta === null));
});

test("legacy fallback cannot steal an ID match; duplicate IDs fail safely", () => {
  const a = id();
  const rows = comparison.compare([{ name: "Old", hr: "8" }, { rowId: a, name: "New", hr: "6" }],
    [{ rowId: a, name: "Old", hr: "1" }], "hr");
  assert.equal(rows[0].delta, null);
  assert.equal(rows[1].delta, 5);
  assert.equal(comparison.compare([{ rowId: a, name: " A ", hr: "8" }], [{ name: "A", hr: "3" }], "hr")[0].delta, 5);
  assert.throws(() => comparison.compare([{ rowId: a, name: "A" }, { rowId: a, name: "B" }], [], "hr"));
});

test("ambiguous legacy rows are labeled unmatched rather than absent", () => {
  const rows = comparison.compare([{ name: "A" }, { name: "A" }], [{ name: "A" }], "hr");
  assert.equal(rows.at(-1).status, "未配對的快照列");
});

test("real import handler rejects damaged identities without changing data or saving", () => {
  for (const mode of ["pawapuro", "prospi"]) {
    const h = harness(mode), shared = id();
    let status, saves = 0, renders = 0;
    Object.assign(h.context, { jsonFileEl: { value: "selected.json" },
      FileReader: class {
        addEventListener(_event, handler) { this.loaded = handler; }
        readAsText(file) { this.result = JSON.stringify(file); this.loaded(); }
      },
      console: { warn() {} }, setStatus(message) { status = message; },
      render() { renders++; }, saveModeToCloud() { saves++; } });
    h.run(`modeDataCache[state.activeMode] = normalizeModeData(state.activeMode,
      { sheets: { hitters: [{ name: "Existing" }], pitchers: [] } });`);
    const previous = h.run("getActiveModeData()");
    vm.runInContext(between("    function importJsonFile(", "    function updateComputedCells("), h.context);
    for (const players of [[{ name: "A", rowId: "broken" }],
      [{ name: "A", rowId: shared }, { name: "B", rowId: shared }]]) {
      h.context.file = { mode, sheets: { hitters: players, pitchers: [] } };
      h.run("importJsonFile(file)");
      assert.equal(h.run("getActiveModeData()"), previous);
      assert.equal(h.context.state.activeMode, mode);
      assert.equal(h.context.jsonFileEl.value, "");
      assert.match(status, /原有資料未變更/);
      assert.doesNotMatch(status, /rowId|UUID|修正/);
      h.context.file.mode = mode === "pawapuro" ? "prospi" : "pawapuro";
      h.run("importJsonFile(file)");
      assert.equal(h.run("getActiveModeData()"), previous);
      assert.equal(h.run("modeDataCache[file.mode]"), undefined);
      assert.equal(h.context.state.activeMode, mode);
      assert.equal(h.context.state.activeSheet, "hitters");
    }
    assert.equal(saves, 0);
    assert.equal(renders, 0);
  }
});
