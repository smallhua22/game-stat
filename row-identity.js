// Row identity is metadata, independent of display columns and player names.
const RowIdentity = (() => {
  const valid = (id) => typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  function validate(sheets) {
    const seen = new Set();
    Object.values(sheets).forEach((players) => players.forEach((player) => {
      if (!Object.hasOwn(player, "rowId")) return; // Older schemaVersion 2 data.
      if (!valid(player.rowId) || seen.has(player.rowId)) {
        throw new Error("檔案中的選手識別資訊損毀或重複，無法安全載入。請改用應用程式匯出的完整檔案；原有資料未變更。");
      }
      seen.add(player.rowId);
    }));
  }
  function create() { return globalThis.crypto.randomUUID(); }
  function preserve(player) {
    if (Object.hasOwn(player, "rowId") && !valid(player.rowId)) {
      throw new Error("選手識別資訊損毀，無法安全載入；原有資料未變更。");
    }
    return player.rowId ?? create();
  }
  return { valid, validate, create, preserve };
})();
if (typeof module !== "undefined") module.exports = RowIdentity;
