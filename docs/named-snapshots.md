# Named snapshot persistence foundation — future dashboard integration

## English

`named-snapshots.js` implements the complete persistence contract for manually dated player
history: `save`, paginated `list`, exact `read`, and `remove`. It is deliberately **not loaded by
the app** and adds no controls. This is a reviewable foundation for #4, not completion of that issue.
A later UI can compare immutable versions rather than infer growth from an overwritten current row.

### Contract and integration

Load after row-identity, snapshot-comparison and legacy-linking, or `require` it in Node.
Supply the authenticated Supabase client and a live account accessor. Create a new service after
sign-in/account change; do not reuse an old one. The future UI should use:

```js
const history = NamedSnapshots.create(supabaseClient, {
  userId: currentUser.id, getUserId: () => currentUser?.id
});
const saved = await history.save(state.activeMode, "Week 1", buildStorageExport());
const page = await history.list(state.activeMode, { limit: 50 });
const next = page.nextCursor && await history.list(state.activeMode, { after: page.nextCursor });
const earlier = await history.read(state.activeMode, saved.id);
const removed = await history.remove(state.activeMode, saved.id);
```

Use `buildStorageExport()`, **not** visibility-filtered `buildExport()`: capture includes current
unsynced edits, both sheets, hidden fields, row IDs and legacy links. Save validates and deep-copies
before awaiting the backend. Names are trimmed, 1–80 characters, without control characters.
Timestamp is client-generated ISO UTC (not proof of server time); display it as snapshot creation,
not a game date. Row IDs must already exist; this service does not invent identity or resolve legacy rows.

The service only inserts `snapshot:<UUID>` rows, with explicit `type=mode`; it never updates/upserts.
Duplicate names are allowed; IDs distinguish them. Returns are independent copies, not writable
storage references. List is ID-ordered with an explicit cursor, not chronological; consume every
page before presenting a complete history. Concurrent inserts/deletes may change later pages:
refresh from the first page after mutation. `read` returns null when absent; `remove` returns false
when absent/already removed. Malformed records fail visibly rather than being silently omitted.

Every operation checks the captured account before request and after response. Errors reject;
there is no automatic retry. A failed save may have committed: its error carries `snapshotId`.
After restoring the **same** account, read that exact ID before offering a retry; do not blindly
create a duplicate. Future UI must also discard stale mode/selection results and communicate errors.

### Database boundary and verification

Uses the existing `public.user_tables` contract in `supabase/setup.sql`: free-form `table_id`,
`type` game-mode FK, JSONB payload and `(user_id, table_id)` primary key. Every read/list/delete
filters account, mode and snapshot namespace. These client filters are **not a security boundary**:
existing server RLS must enforce `auth.uid() = user_id` for select/insert/delete, deny anonymous access,
and grant authenticated access. Existing account-data deletion also removes snapshot rows.
Insert-only describes this API, not a database-level prohibition on updates by other clients.

Verify with `node --test tests/*.test.mjs`. Mocked Supabase tests cover both modes, full immutable
capture, paging, scope isolation, deletion, collisions, corrupt records and network/account failures.
No production requests, schema migration, RLS changes, deployment or browser UI are included.
Production authentication, cross-device persistence and actual RLS isolation remain unverified.
Before UI release, verify them in an authorized test environment and add save/list/delete feedback,
any-two-version selection, race handling and browser coverage. #4 remains open; nothing deferred is exposed.

## 繁體中文

`named-snapshots.js` 提供完整的具名快照儲存介面：儲存、分頁列出、讀取及刪除。
目前**未由應用程式載入，也沒有新增控制項**；這是 #4 的基礎，不代表該議題完成。
未來儀表板可比較不隨目前資料覆寫的歷史版本，呈現選手成長。

登入後以 Supabase client、目前帳號及即時帳號查詢函式建立服務；換帳號須重建。
傳入 `buildStorageExport()`，不可使用會隱藏欄位的 `buildExport()`。儲存前立即深拷貝並
驗證尚未同步編輯、兩資料表、隱藏欄位、持續識別碼及舊資料配對。名稱去除前後空白，
限制 1–80 字元且不得含控制字元；時間為客戶端 UTC 建立時間，不是伺服器證明或比賽日期。

只新增 `snapshot:<UUID>`，明確指定模式，不更新或覆寫；同名以 ID 區別。
清單按 ID 分頁，須取完游標才能稱為完整歷史；增刪後重新整理第一頁。
不存在時讀取回傳 null、刪除回傳 false；損毀資料及後端錯誤均拒絕，不假裝成功或略過。
請求前後檢查帳號，不自動重試；儲存錯誤可能已提交，錯誤含 `snapshotId`，
回到同一帳號後先查該 ID，避免重複建立。後續 UI 還須處理模式切換及舊回應。

沿用 `supabase/setup.sql` 的 user_tables、主鍵及模式外鍵。客戶端篩選不是安全邊界；
必須由既有 RLS 以 auth.uid() 限制帳號並拒絕匿名存取。帳號資料刪除亦涵蓋快照。
僅此介面不提供更新，不代表資料庫禁止其他客戶端更新。

測試以模擬 Supabase 驗證兩模式、完整拷貝、分頁、隔離、刪除、衝突及失敗。
未操作正式資料庫、修改架構/RLS 或部署；正式登入、跨裝置持久性及實際 RLS 尚未驗證。
後續須在獲授權測試環境驗證，並加入具名快照 UI、任兩版比較、錯誤與競態及瀏覽器測試。
