import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import comparison from "../snapshot-comparison.js";

const snapshot = (hitters = []) => ({ schemaVersion: 2, mode: "pawapuro", sheets: { hitters, pitchers: [] } });

test("accepts existing exports for both modes without mutating them", () => {
  for (const mode of ["pawapuro", "prospi"]) {
    const input = JSON.parse(readFileSync(new URL(`../data/${mode}.json`, import.meta.url)));
    const original = JSON.stringify(input);
    assert.equal(comparison.validate(input, mode), input);
    comparison.compare(input.sheets.hitters, input.sheets.hitters, "hr");
    assert.equal(JSON.stringify(input), original);
  }
});

test("rejects wrong mode, unknown schema, missing sheets, and malformed players", () => {
  for (const input of [null, [], {}, { ...snapshot(), schemaVersion: 3 },
    { ...snapshot(), mode: "prospi" }, { ...snapshot(), sheets: { hitters: [] } },
    snapshot([null]), snapshot([[]]), snapshot([{ name: 123 }])]) {
    assert.throws(() => comparison.validate(input, "pawapuro"));
  }
});

test("numeric values are strict, missing stays missing, and zero stays zero", () => {
  for (const hr of [undefined, null, "", " ", "12x", "0x10", "Infinity", [], true, {}]) {
    assert.equal(comparison.value({ hr }, "hr"), null);
  }
  assert.equal(comparison.value({ hr: "0" }, "hr"), 0);
  assert.equal(comparison.value({ hr: 12 }, "hr"), 12);
  assert.equal(comparison.value({ era: " 3.14 " }, "era"), 3.14);
});

test("slash-line rates are compared separately", () => {
  assert.equal(comparison.value({ slashLine: ".300/.400/.500" }, "obp"), .4);
  assert.equal(comparison.value({ slashLine: ".300/.400" }, "avg"), null);
  assert.equal(comparison.value({ slashLine: "oops/.400/.500" }, "avg"), null);
  for (const slashLine of [[], {}, { toString: null }, [".300/.400/.500"], 0.3]) {
    assert.equal(comparison.value({ slashLine }, "avg"), null);
  }
});

test("baseball innings accept and display dot notation while calculating in outs", () => {
  const before = comparison.value({ ip: "10.2" }, "ip");
  const after = comparison.value({ ip: "11.1" }, "ip");
  assert.equal(after - before, 2);
  assert.equal(comparison.format(after - before, "ip", true), "+0.2");
  assert.equal(comparison.format(before - after, "ip", true), "−0.2");
  for (const [ip, outs, display] of [["10.2", 32, "10.2"], [11.1, 34, "11.1"],
    ["0.2", 2, "0.2"], ["0", 0, "0.0"], ["11", 33, "11.0"], ["11.0", 33, "11.0"]]) {
    assert.equal(comparison.value({ ip }, "ip"), outs);
    assert.equal(comparison.format(outs, "ip"), display);
  }
  assert.equal(comparison.format(3, "ip", true), "+1.0");
  assert.equal(comparison.format(0, "ip", true), "0.0");
  for (const ip of ["1.3", "1.9", "1.12", "-1.1", "1x", "", null,
    [], [11.1], {}, { toString: null }, Infinity, "9".repeat(400), Number.MAX_SAFE_INTEGER]) {
    assert.equal(comparison.value({ ip }, "ip"), null);
  }
});

test("matches only unique trimmed names and reports new, removed, unnamed, and duplicate players", () => {
  const current = [{ name: " A ", hr: "3" }, { name: "New", hr: "1" }, { name: "", hr: "0" },
    { name: "Duplicate", hr: "1" }, { name: "Duplicate", hr: "2" }, { name: "Earlier duplicate", hr: "5" }];
  const earlier = [{ name: "A", hr: "1" }, { name: "Removed", hr: "5" },
    { name: "Duplicate", hr: "0" }, { name: "Earlier duplicate", hr: "1" }, { name: "Earlier duplicate", hr: "2" }];
  const rows = comparison.compare(current, earlier, "hr");
  assert.deepEqual(rows[0], { name: "A", before: 1, after: 3, delta: 2, status: "" });
  assert.equal(rows[1].status, "快照無此選手");
  assert.equal(rows[2].status, "未命名，無法配對");
  for (const row of rows.slice(3, 6)) {
    assert.equal(row.status, "同名，無法配對");
    assert.equal(row.delta, null);
  }
  assert.equal(rows[6].status, "目前無此選手");
});

test("missing fields never turn into zero changes or false improvement", () => {
  const rows = comparison.compare([{ name: "A", hr: "0" }], [{ name: "A" }], "hr");
  assert.equal(rows[0].after, 0);
  assert.equal(rows[0].delta, null);
  assert.equal(rows[0].status, "缺少或無效數值");
  assert.equal(comparison.format(null, "hr"), "—");
  assert.equal(comparison.format(.3 - .1, "avg", true), "+0.2");
  assert.equal(comparison.format(-.00001, "avg", true), "0");
  assert.equal(comparison.format(-1, "hr", true), "−1");
});
