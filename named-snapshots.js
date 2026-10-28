// Unexposed foundation for dated, account-private player performance history.
const NamedSnapshots = (() => {
  const comparison = typeof module !== "undefined" ? require("./snapshot-comparison.js") : SnapshotComparison;
  const identity = typeof module !== "undefined" ? require("./row-identity.js") : RowIdentity;
  const linking = typeof module !== "undefined" ? require("./legacy-linking.js") : LegacyLinking;
  const modes = ["pawapuro", "prospi"];
  const prefix = "snapshot:";
  const columns = "user_id,table_id,type,data";
  function check(value, message) { if (!value) throw new Error(message); }
  function validId(id) { return typeof id === "string" && id.startsWith(prefix) && identity.valid(id.slice(prefix.length)); }
  function validName(name) {
    return typeof name === "string" && name === name.trim() && name.length > 0 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name);
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value, (_, item) => {
      check(item !== undefined && typeof item !== "function" && typeof item !== "symbol" &&
        (typeof item !== "number" || Number.isFinite(item)), "Snapshot data must be JSON-safe.");
      return item;
    }));
  }
  function validateStats(stats, mode) {
    comparison.validate(stats, mode);
    check(["hitters", "pitchers"].includes(stats.activeSheet), "Invalid snapshot sheet.");
    check(Object.values(stats.sheets).every((rows) => rows.every((row) => identity.valid(row.rowId))), "Snapshot rows need persistent IDs.");
    linking.clean(stats.legacyLinks);
    return stats;
  }
  // Supply buildStorageExport(), not the visibility-filtered buildExport().
  function capture(input, mode) {
    check(modes.includes(mode), "Invalid snapshot mode.");
    const stats = clone({ schemaVersion: input?.schemaVersion, mode: input?.mode,
      activeSheet: input?.activeSheet, sheets: input?.sheets, legacyLinks: input?.legacyLinks ?? {} });
    return validateStats(stats, mode);
  }
  function create(client, { userId, getUserId, now = () => new Date(), uuid = () => globalThis.crypto.randomUUID() }) {
    check(typeof userId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId), "An authenticated account is required.");
    check(typeof getUserId === "function", "A live account accessor is required.");
    const scope = (mode) => {
      check(modes.includes(mode), "Invalid snapshot mode.");
      check(getUserId() === userId, "Account changed; discard this snapshot service.");
    };
    function decode(row, mode, id) {
      check(row && row.user_id === userId && row.type === mode && validId(row.table_id) &&
        (!id || row.table_id === id), "Unexpected snapshot record scope.");
      const data = clone(row.data);
      check(data.snapshotVersion === 1 && validName(data.name) && typeof data.createdAt === "string" &&
        Number.isFinite(Date.parse(data.createdAt)) && new Date(data.createdAt).toISOString() === data.createdAt,
      "Invalid named snapshot metadata.");
      validateStats(data.stats, mode);
      return { id: row.table_id, mode, snapshotVersion: 1, name: data.name, createdAt: data.createdAt, stats: data.stats };
    }
    const query = (mode) => client.from("user_tables").select(columns)
      .eq("user_id", userId).eq("type", mode).like("table_id", `${prefix}%`);
    async function result(request, mode) {
      const response = await request;
      scope(mode); // Never deliver a previous account's result after sign-out/switch.
      if (response.error) throw response.error;
      return response.data;
    }
    return {
      async save(mode, name, input) {
        scope(mode);
        name = typeof name === "string" ? name.trim() : name;
        check(validName(name), "Use a snapshot name of 1–80 characters without control characters.");
        const id = prefix + uuid();
        check(validId(id), "Invalid snapshot ID.");
        const data = { snapshotVersion: 1, name, createdAt: now().toISOString(), stats: capture(input, mode) };
        const row = { user_id: userId, table_id: id, type: mode, data };
        // No upsert/update: an ID collision must fail, never replace history or current stats.
        try {
          const saved = await result(client.from("user_tables").insert(row).select(columns).single(), mode);
          return decode(saved, mode, id);
        } catch (cause) {
          const error = new Error(`Snapshot save not confirmed: ${cause.message}. Reconcile this ID before retrying.`, { cause });
          error.snapshotId = id; // A network/session failure can happen after the insert committed.
          throw error;
        }
      },
      async read(mode, id) {
        scope(mode); check(validId(id), "Invalid snapshot ID.");
        const row = await result(query(mode).eq("table_id", id).maybeSingle(), mode);
        return row ? decode(row, mode, id) : null;
      },
      async list(mode, { after = null, limit = 50 } = {}) {
        scope(mode);
        check(after === null || validId(after), "Invalid snapshot cursor.");
        check(Number.isInteger(limit) && limit >= 1 && limit <= 100, "Snapshot page size must be 1–100.");
        let request = query(mode).order("table_id", { ascending: true }).limit(limit + 1);
        if (after) request = request.gt("table_id", after);
        const rows = await result(request, mode);
        check(Array.isArray(rows), "Missing snapshot list response.");
        const items = rows.map((row) => decode(row, mode));
        const more = items.length > limit;
        return { items: items.slice(0, limit), nextCursor: more ? items[limit - 1].id : null };
      },
      async remove(mode, id) {
        scope(mode); check(validId(id), "Invalid snapshot ID.");
        const rows = await result(client.from("user_tables").delete().eq("user_id", userId)
          .eq("type", mode).eq("table_id", id).select("table_id"), mode);
        check(Array.isArray(rows) && rows.length <= 1 && rows.every((row) => row.table_id === id), "Unexpected snapshot deletion response.");
        return rows.length === 1; // Missing/already deleted is explicit, not fabricated success.
      }
    };
  }
  return { capture, create };
})();
if (typeof module !== "undefined") module.exports = NamedSnapshots;
