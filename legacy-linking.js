// Account-scoped choices are keyed by canonical snapshot content, never by filename.
const LegacyLinking = (() => {
  const identity = typeof module !== "undefined" ? require("./row-identity.js") : RowIdentity;
  const sheets = ["hitters", "pitchers"];
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  async function key(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(canonical({ mode: data.mode, sheets: data.sheets })));
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function validRecord(record) {
    if (!sheets.every((s) => Array.isArray(record?.[s]))) return false;
    const ids = sheets.flatMap((s) => record[s]);
    return ids.every(identity.valid) && new Set(ids).size === ids.length;
  }
  function clean(records = {}) {
    if (!records || typeof records !== "object" || Array.isArray(records) ||
      !Object.entries(records).every(([hash, record]) => /^[a-f0-9]{64}$/.test(hash) && validRecord(record))) {
      throw new Error("檔案中的舊快照配對資訊損毀或重複，無法安全載入。請改用應用程式匯出的完整檔案；原有資料未變更。");
    }
    return Object.fromEntries(Object.entries(records));
  }
  function compatible(data, record) {
    return validRecord(record) && sheets.every((s) => record[s].length === data.sheets[s].length &&
      data.sheets[s].every((p, i) => !p.rowId || p.rowId === record[s][i]));
  }
  function plan(data, current, saved) {
    if (!compatible(data, saved)) saved = null;
    const used = new Set(sheets.flatMap((s) => data.sheets[s].map((p) => p.rowId).filter(Boolean)));
    const result = Object.fromEntries(sheets.map((s) => [s, data.sheets[s].map((p, i) => p.rowId || saved?.[s]?.[i] || "")]));
    sheets.forEach((s) => result[s].forEach((id) => { if (id) used.add(id); }));
    sheets.forEach((s) => data.sheets[s].forEach((p, i) => {
      if (result[s][i]) return;
      const name = p.name.trim();
      const matches = current.sheets[s].filter((row) => row.name.trim() === name);
      if (name && matches.length === 1 && data.sheets[s].filter((row) => row.name.trim() === name).length === 1 && !used.has(matches[0].rowId)) {
        result[s][i] = matches[0].rowId; used.add(matches[0].rowId);
      }
    }));
    return result;
  }
  function apply(data, record) {
    if (!compatible(data, record)) return data;
    const next = { ...data, sheets: Object.fromEntries(sheets.map((s) => [s,
      data.sheets[s].map((p, i) => p.rowId || !record[s]?.[i] ? p : { ...p, rowId: record[s][i] })])) };
    identity.validate(next.sheets);
    return next;
  }
  function resolve(data, current, selections) {
    const record = Object.fromEntries(sheets.map((s) => [s, data.sheets[s].map((p, i) => {
      if (p.rowId) return p.rowId;
      const choice = selections[s][i];
      if (choice === "new") return identity.create();
      if (!identity.valid(choice)) throw new Error("請為每位舊選手選擇配對或獨立紀錄。");
      return choice;
    })]));
    // A target may be used only once, including rows which already have an identity.
    identity.validate(Object.fromEntries(sheets.map((s) => [s, record[s].map((rowId) => ({ rowId }))])));
    return record;
  }
  return { key, clean, plan, apply, resolve };
})();
if (typeof module !== "undefined") module.exports = LegacyLinking;
