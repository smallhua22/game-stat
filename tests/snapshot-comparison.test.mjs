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

test("player profile keeps identity, distinct metric scales, rates, innings and source data", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const current = [{ rowId: id, name: "Renamed", hr: "8", era: "-2", ip: "11.1", slashLine: ".3/.4/.5" }];
  const earlier = [{ rowId: id, name: "Old", hr: "2", era: "4", ip: "10.2", slashLine: ".2/.3/.4" }];
  const original = JSON.stringify({ current, earlier });
  const columns = ["hr", "era", "ip", "avg", "bb"].map((field) => ({ field, label: field }));
  const cards = comparison.profile(current, earlier, 0, columns);
  assert.equal(cards[0].name, "Renamed");
  assert.equal(cards[0].bars.before.width, 25);
  assert.equal(cards[0].bars.after.width, 100);
  assert.ok(Math.abs(cards[1].bars.zero - 100 / 3) < 1e-10);
  assert.equal(cards[1].bars.after.left, 0);
  assert.equal(cards[2].delta, 2);
  assert.equal(comparison.format(cards[2].delta, "ip", true), "+0.2");
  assert.equal(comparison.format(cards[3].delta, "avg", true), "+0.1");
  assert.equal(cards[4].bars, null);
  assert.equal(cards[4].delta, null);
  assert.equal(JSON.stringify({ current, earlier }), original);
  assert.deepEqual(comparison.profile(current, earlier, -1, columns), []);
});

test("profile never plots ambiguous, missing or nonfinite comparisons as zero", () => {
  const columns = [{ field: "hr", label: "HR" }];
  const profile = (current, earlier) => comparison.profile(current, earlier, 0, columns)[0];
  assert.equal(profile([{ name: "A", hr: 1 }], [{ name: "A", hr: 1 }, { name: "A", hr: 2 }]).bars, null);
  assert.equal(profile([{ name: "A", hr: 1 }], [{ name: "A" }]).bars, null);
  const overflow = profile([{ name: "A", hr: "1" + "0".repeat(308) }], [{ name: "A", hr: "-1" + "0".repeat(308) }]);
  assert.equal(overflow.bars, null); assert.match(overflow.status, /超出/);
  const zero = profile([{ name: "A", hr: 0 }], [{ name: "A", hr: 0 }]);
  assert.equal(zero.bars.before.width, 0); assert.equal(zero.bars.after.width, 0);
});
