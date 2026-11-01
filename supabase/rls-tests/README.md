# Private player-history database contract

## English

Run the committed SQL against **real PostgreSQL in WebAssembly**, not a mocked query
builder. This supports the private saved-history foundation in #17 and the future
player-growth dashboard in #4. It does not expose unfinished snapshot controls.

```sh
npm ci --prefix supabase/rls-tests --ignore-scripts
npm test --prefix supabase/rls-tests
node --test tests/*.test.mjs
```

Requires Node.js 22+ and a one-time package download. The isolated test-only package
pins [PGlite](https://pglite.dev/docs/about) with a lockfile; the browser application
has no new dependency. Each test creates and closes a fresh in-memory database.
No URLs, tokens, user credentials, hosted database connections or disk database are
accepted. `setup.sql` is read as-is and executed **only in that ephemeral database**.
Do not run these fixtures against a Supabase project.

The fixture supplies minimal `auth.users` and an `auth.uid()` function reading a
locally set claim (simulating an already verified JWT identity, not validating one).
The simplified JSON fixtures test policy, not the NamedSnapshots payload contract. Assertions run as `anon` or `authenticated`, not the schema owner,
and verify those roles are neither superusers nor RLS-bypass roles and RLS is active.
Fixtures include both accounts using identical current/history keys in both modes.
The tests verify:

- Owner history insert/read/delete and independence from editable current data.
- Unfiltered and guessed-ID reads cannot see another account; foreign updates/deletes
  affect no rows; forged ownership inserts and ownership transfers are rejected.
- Anonymous CRUD/RPC denial, even with a claim; missing-user authenticated isolation.
- Account-data deletion removes only the caller's current/history rows, retaining users.
- Duplicate keys and invalid game modes reject; legacy current writes still default type.

This proves the **committed SQL contract in embedded PostgreSQL**, not deployed RLS
configuration; the embedded PostgreSQL version may differ from the hosted version.
It does not test Supabase JWT validation, OAuth, PostgREST/JS-client
behavior, cross-device persistence, or the full #17 snapshot API. Insert-only history
is an API contract, not a database prohibition on owner updates. The existing mock
snapshot tests and an authorized hosted integration test remain necessary before
snapshot UI release. This standalone suite is not added to CI by this PR; existing
CI still covers the application tests/browser flows, not these database assertions.

## 繁體中文

本測試以 WebAssembly 中的**真正 PostgreSQL** 執行現有 `setup.sql`，不是模擬
查詢介面；支援 #17 的私有快照基礎與 #4 的選手成長儀表板，不顯示未完成的快照 UI。
以上指令需要 Node.js 22+；首次安裝會下載套件。測試專用 PGlite 版本及鎖檔固定，
瀏覽器程式沒有新增相依。每個測試使用獨立記憶體資料庫，結束即關閉；不接受正式
網址、金鑰或憑證，不連接遠端資料庫。**不得將測試資料執行於 Supabase 專案。**

測試以最小 auth.users 與讀取本地 claim 的 auth.uid() 提供身分環境，實際斷言使用
非擁有者的 anon/authenticated，確認無超級使用者或略過 RLS 權限，且 RLS 生效。
涵蓋兩帳號、兩模式、相同歷史識別碼、本人儲存/讀取/刪除、目前資料與快照獨立、
跨帳號讀寫隔離、偽造帳號、匿名 CRUD/RPC、缺少身分、帳號資料刪除、主鍵衝突及模式限制。

身分 fixture 模擬已驗證 JWT 的使用者，不驗證 JWT；簡化 JSON 僅測政策，不測快照 API 格式。
嵌入式 PostgreSQL 與正式服務版本可能不同。結果只驗證已提交 SQL 在嵌入式 PostgreSQL 的行為，不代表正式 RLS 設定、JWT、OAuth、
PostgREST/JS client 或跨裝置持久性已驗證。只新增快照是 API 契約，不代表資料庫禁止
本人更新。#17 模擬測試與獲授權的實際服務整合測試仍是 UI 上線前提。
本 PR 不修改 CI；此獨立資料庫測試須手動執行，既有 CI 僅驗證應用程式與瀏覽器流程。
