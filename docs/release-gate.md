# Anonymous-access release gate

## English

Private saved player history depends on the same database boundary as current stats.
The existing release gate now passes only when **each** read, insert and deletion-RPC
probe returns HTTP 401/403 with PostgreSQL error code `42501` (insufficient privilege).
An unavailable service, missing endpoint, invalid token, redirect or malformed response
does not prove access isolation and fails closed. Requests time out after 15 seconds;
later probes still run after a failure. Response bodies are never printed, since an
unexpected success may contain private records. No policy, workflow or deployment changes.

`node --test tests/*.test.mjs` uses injected offline responses and makes no production
calls. `node supabase/release-gate-test.mjs` remains the live gate used by the existing
deployment workflow. A passing anonymous gate does not establish authenticated-account
isolation, OAuth correctness, snapshot API behavior or cross-device persistence.

## 繁體中文

私有選手歷史與目前數值依賴相同的資料庫安全邊界。既有發佈檢查現在只接受三項
讀取、新增與刪除 RPC 請求皆回傳 HTTP 401／403 且 PostgreSQL 代碼為 `42501`。
服務故障、端點不存在、權杖錯誤、重新導向或無效回應都不代表權限隔離，必須失敗。
每項請求逾時為 15 秒，失敗後仍檢查後續項目；不輸出可能含私人資料的回應內容。
單元測試使用離線模擬，不連正式資料庫；未修改政策、工作流程或部署。
匿名檢查通過仍不代表已驗證帳戶隔離、OAuth、快照 API 或跨裝置持久性。
