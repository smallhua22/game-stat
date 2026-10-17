// Row identity is metadata, independent of display columns and player names.
const RowIdentity = (() => {
  const valid = (id) => typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  function validate(sheets) {
    const seen = new Set();
    Object.values(sheets).forEach((players) => players.forEach((player) => {
      if (!Object.hasOwn(player, "rowId")) return; // Older schemaVersion 2 data.
      if (!valid(player.rowId) || seen.has(player.rowId)) {
        throw new Error("選手 rowId 無效或重複；請修正檔案中的 ID，資料未匯入。");
      }
      seen.add(player.rowId);
    }));
  }
  function create() { return globalThis.crypto.randomUUID(); }
  function preserve(player) {
    if (Object.hasOwn(player, "rowId") && !valid(player.rowId)) {
      throw new Error("選手 rowId 無效，資料未匯入。");
    }
    return player.rowId ?? create();
  }
  return { valid, validate, create, preserve };
})();
if (typeof module !== "undefined") module.exports = RowIdentity;
