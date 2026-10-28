// Pure, read-only helpers shared by the browser and dependency-free Node tests.
const SnapshotComparison = (() => {
  const identity = typeof module !== "undefined" ? require("./row-identity.js") : RowIdentity;
  function validate(input, mode) {
    if (!input || input.schemaVersion !== 2 || input.mode !== mode ||
        !["hitters", "pitchers"].every((sheet) => Array.isArray(input.sheets?.[sheet]) &&
          input.sheets[sheet].every((player) => player && typeof player === "object" &&
            !Array.isArray(player) && typeof player.name === "string"))) {
      throw new Error("請選擇相同模式、schemaVersion 2 且包含打者與投手資料的 JSON 匯出檔。");
    }
    identity.validate(input.sheets);
    return input;
  }

  function number(raw) {
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    const text = String(raw).trim();
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }

  function value(player, field) {
    if (["avg", "obp", "slg"].includes(field)) {
      if (typeof player.slashLine !== "string") return null;
      const parts = player.slashLine.split("/");
      return parts.length === 3 ? number(parts[["avg", "obp", "slg"].indexOf(field)]) : null;
    }
    if (field === "ip") {
      if (typeof player.ip !== "string" && typeof player.ip !== "number") return null;
      const raw = String(player.ip).trim();
      if (!/^\d+(?:\.[012])?$/.test(raw)) return null;
      const [innings, outs = "0"] = raw.split(".");
      const totalOuts = Number(innings) * 3 + Number(outs);
      return Number.isSafeInteger(totalOuts) ? totalOuts : null; // Compare outs, never decimal innings.
    }
    return number(player[field]);
  }

  function format(value, field, delta = false) {
    if (value === null || !Number.isFinite(value)) return "—";
    const rounded = Number(value.toFixed(3));
    const sign = rounded < 0 ? "−" : delta && rounded > 0 ? "+" : "";
    const absolute = Math.abs(rounded);
    return sign + (field === "ip"
      ? `${Math.floor(absolute / 3)}.${absolute % 3}`
      : String(absolute));
  }

  function compare(current, earlier, field) {
    const name = (player) => player.name.trim();
    const group = (players) => {
      const groups = new Map();
      players.forEach((player) => groups.set(name(player), [...(groups.get(name(player)) || []), player]));
      return groups;
    };
    const currentNames = group(current);
    const earlierNames = group(earlier);
    identity.validate({ current });
    identity.validate({ earlier });
    const earlierIds = new Map(earlier.filter((p) => p.rowId).map((p) => [p.rowId, p]));
    const currentIds = new Set(current.map((p) => p.rowId).filter(Boolean));
    const matched = new Set();
    const rows = current.map((player) => {
      const key = name(player);
      let match = player.rowId ? earlierIds.get(player.rowId) : undefined;
      let status = "";
      if (!match) {
        const candidates = earlierNames.get(key) || [];
        status = !key ? "未命名，無法配對" : currentNames.get(key).length > 1 || candidates.length > 1
          ? "同名，無法配對" : "快照無此選手";
        const candidate = candidates[0];
        // Legacy fallback must never override an ID match or join two different IDs.
        if (key && currentNames.get(key).length === 1 && candidates.length === 1 &&
            (!player.rowId || !candidate.rowId) &&
            !(candidate.rowId && currentIds.has(candidate.rowId)) && !matched.has(candidate)) {
          match = candidate;
        }
      }
      if (match) { matched.add(match); status = ""; }
      const before = match ? value(match, field) : null;
      const after = value(player, field);
      return { name: key || "（未命名）", before, after,
        delta: before === null || after === null ? null : after - before,
        status: status || (before === null || after === null ? "缺少或無效數值" : "") };
    });
    earlier.forEach((player) => {
      if (!matched.has(player)) rows.push({ name: name(player) || "（未命名）",
        before: value(player, field), after: null, delta: null, status: currentNames.has(name(player)) ? "未配對的快照列" : "目前無此選手" });
    });
    return rows;
  }
  // Export displayed comparison rows, not an importable data backup.
  function csv(rows, context) {
    const cell = (value, protect = true) => {
      let text = String(value ?? "");
      // Spreadsheet formula prefixes can hide behind whitespace/control characters.
      if (protect && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const header = ["generated_at_utc", "mode", "sheet", "metric", "baseline_file",
      "baseline_exported_at", "player", "baseline", "current", "current_minus_baseline", "status"];
    const metadata = [context.generatedAt, context.mode, context.sheet, context.metric,
      context.filename, context.exportedAt];
    return "\ufeff" + [header.map((v) => cell(v)).join(","), ...rows.map((row) =>
      [...metadata.map((v) => cell(v)), ...row.map((v, i) => cell(v, i === 0 || i === 4))].join(","))].join("\r\n") + "\r\n";
  }
  // Independent scales keep unlike units out of a misleading combined/radar score.
  function profile(current, earlier, index, columns) {
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return [];
    return columns.map(({ field, label }) => {
      const row = compare(current, earlier, field)[index];
      let bars = null;
      if (!row.status && [row.before, row.after, row.delta].every(Number.isFinite)) {
        const before = Number(row.before.toFixed(3)), after = Number(row.after.toFixed(3));
        const min = Math.min(0, before, after), max = Math.max(0, before, after);
        const magnitude = Math.max(Math.abs(min), Math.abs(max)) || 1;
        const low = min / magnitude, span = max / magnitude - low || 1;
        const position = (value) => (value / magnitude - low) / span * 100;
        const zero = position(0);
        const bar = (value) => ({ left: Math.min(zero, position(value)), width: Math.abs(position(value) - zero) });
        bars = { zero, before: bar(before), after: bar(after) };
      }
      return { field, label, ...row, bars, status: row.status ||
        (row.delta !== null && !Number.isFinite(row.delta) ? "差值超出可計算範圍" : "") };
    });
  }
  return { validate, value, format, compare, csv, profile };
})();
if (typeof module !== "undefined") module.exports = SnapshotComparison;
