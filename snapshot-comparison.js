// Pure, read-only helpers shared by the browser and dependency-free Node tests.
const SnapshotComparison = (() => {
  function validate(input, mode) {
    if (!input || input.schemaVersion !== 2 || input.mode !== mode ||
        !["hitters", "pitchers"].every((sheet) => Array.isArray(input.sheets?.[sheet]) &&
          input.sheets[sheet].every((player) => player && typeof player === "object" &&
            !Array.isArray(player) && typeof player.name === "string"))) {
      throw new Error("請選擇相同模式、schemaVersion 2 且包含打者與投手資料的 JSON 匯出檔。");
    }
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
    const rows = current.map((player) => {
      const key = name(player);
      const matches = earlierNames.get(key) || [];
      const status = !key ? "未命名，無法配對" : currentNames.get(key).length > 1 || matches.length > 1
        ? "同名，無法配對" : !matches.length ? "快照無此選手" : "";
      const before = status ? null : value(matches[0], field);
      const after = value(player, field);
      return { name: key || "（未命名）", before, after,
        delta: before === null || after === null ? null : after - before,
        status: status || (before === null || after === null ? "缺少或無效數值" : "") };
    });
    earlier.forEach((player) => {
      if (!currentNames.has(name(player))) rows.push({ name: name(player) || "（未命名）",
        before: value(player, field), after: null, delta: null, status: "目前無此選手" });
    });
    return rows;
  }
  return { validate, value, format, compare };
})();
if (typeof module !== "undefined") module.exports = SnapshotComparison;
