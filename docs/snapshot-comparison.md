# Growth comparison (JSON snapshots)

## English

1. In “成長比較（JSON 快照）”, select an earlier JSON export from the same mode.
2. Choose a metric; switching between hitters and pitchers also switches the comparison.
3. The change is “current screen − earlier snapshot” and updates as you edit.
   Signs indicate numerical direction, not whether performance improved.

IP input and display use baseball notation: `10.2` means 10 innings and 2 outs; no fractions need typing.
Calculations use outs: `11.1 − 10.2 = +0.2` (2 outs), and `−0.2` means 2 fewer outs, not a decimal fraction.
Whole innings display as `.0`. Enter whole innings or a final `.0`, `.1`, or `.2` digit.

Snapshots stay in this page's memory, separately by mode, until cleared or refreshed. They are not imported,
saved to the cloud, or written back to the original file. Current values include unsynced edits.
Existing `schemaVersion: 2` exports are supported; both sheets must be present. The `exportedAt` time is
shown if supplied and valid; otherwise “檔案未提供時間” (file has no timestamp) is shown. Dates are not guessed.

The app recognizes the same player record across edits, renames, reordering, cloud saves and JSON
exports/imports. Creating or duplicating a row starts a separate record. This uses internal `rowId`
metadata (a lowercase UUID v4), independent of visible columns; users do not need to manage it.
Comparisons use IDs first within the same mode and sheet, so renames and duplicate names can match.
Different IDs never match solely by name. Damaged or repeated identity information prevents safe loading;
the app explains the problem, suggests a complete app export, and leaves existing data unchanged.

Older schemaVersion 2 tables receive IDs on load; the normal cloud save persists them. Until synchronization
succeeds, export a backup before leaving the page. Existing optimistic conflict handling still applies.
An older ID-less comparison file uses unique, case-sensitive trimmed names; ambiguous or absent matches
remain unmatched. Confirm that legacy matched names refer to the same player and statistical period,
especially Prospi cards from different Series. A complete, unmodified app export retains the record links.

This is the row-identity foundation for issue #3, not its complete legacy-linking workflow. A saved chooser
for ambiguous/renamed historical rows and reusable historical linking decisions remain future work.
Importing an ID-less file as the current table creates fresh identities, not links to the replaced table.
Comparisons do not calculate rate statistics for the intervening period.
Missing, blank, or invalid values show `—`, never zero. Existing JSON exports contain only visible columns;
show a metric before downloading a snapshot if you want to compare it later, or use the
[full-data backup](full-data-backup.md) to retain hidden stored fields. Comparison itself is independent
of current column visibility. Raw numeric fields and AVG/OBP/SLG are supported; letter grades, free text,
and computed columns are excluded.

### Tests

Run `node --test tests/*.test.mjs` from the project root. Tests use Node's built-in runner with no package
installation or database connection. They cover numerical and matching logic and execute the real comparison
and input handlers in an in-memory DOM; they do not replace visual browser testing. These offline tests run
automatically on pull requests. The existing Supabase release gate is unchanged.

CI also runs `tests/browser-smoke.mjs` in real Chromium on a GitHub-hosted runner, independently of the
user's computer. It installs pinned Playwright 1.57.0 and Chromium, serves the real app, mocks only
authentication/backend storage, and blocks other external requests. Screenshots are retained for seven
days. This covers UI behavior; it does not verify live sign-in, Supabase permissions, or deployment.

## 繁體中文

### 成長比較（JSON 快照）

1. 在「成長比較（JSON 快照）」選擇較早下載的同模式 JSON。
2. 選擇比較欄位；切換打者／投手時也會切換比較資料。
3. 差值是「目前畫面 − 較早快照」，會隨編輯更新。
   正負號只表示數值方向，不判斷表現好壞。

IP 輸入與顯示均使用棒球記法：`10.2` 表示 10 局又 2 個出局數，不必輸入分數。
計算使用出局數：`11.1 − 10.2 = +0.2`（2 個出局數）；`−0.2` 表示少了 2 個出局數，並非小數局。
整局顯示為 `.0`；輸入可為整局，或以 `.0`、`.1`、`.2` 結尾。

快照按模式暫存在此頁記憶體，清除或重新整理後消失，不會匯入、儲存至雲端或修改原始檔案。
目前數值包含尚未同步的修改。可接受現有 `schemaVersion: 2` 匯出檔；兩個資料表都必須存在。
若檔案提供有效的 `exportedAt` 時間則顯示該時間，否則標示「檔案未提供時間」，不猜測快照日期。

應用程式會在編輯、改名、排序、雲端儲存及 JSON 匯出／匯入後辨識同一筆選手紀錄；
新增或複製列則建立獨立紀錄。這透過內部 `rowId`（小寫 UUID v4）記錄，獨立於可見欄位，
使用者不需要管理。比較優先依同模式、同資料表的 ID 配對，因此改名或同名列也能正確比較。
不同 ID 不會只因姓名相同而合併。識別資訊損毀或重複時，應用程式會說明無法安全載入，
建議改用完整匯出檔，並保留原有資料。

舊版 schemaVersion 2 資料表載入時會取得 ID，並由一般雲端儲存流程保存。同步成功前，
離開頁面前請先匯出備份；既有的版本衝突保護仍然適用。沒有 ID 的舊比較檔仍使用唯一姓名，
忽略前後空白但保留大小寫；同名或找不到的列維持未配對。請確認舊檔配對的是同一選手與統計期間，
尤其是 Prospi 中不同 Series 的同名卡片。完整且未修改的應用程式匯出檔會保留紀錄間的連結。

這是 issue #3 的列識別基礎，尚未完成全部舊資料連結流程。同名／改名歷史列的選擇介面與
連結決定的永久保存將另行實作。將無 ID 檔案匯入成目前資料表會建立新身分，並非連結被替換的資料。
比較不推算期間內的比率成績。
缺少、空白或無效的數值顯示 `—`，不當作零。原有 JSON 匯出只包含已顯示的欄位；
若要日後比較某欄位，請在下載快照前將它顯示，或使用[完整備份](full-data-backup.md)保留隱藏的儲存欄位。
成長比較本身不受目前欄位顯示設定影響。
目前支援原始數值欄位及 AVG／OBP／SLG，不包含字母評價、自由文字和計算欄位。

### 測試

在專案根目錄執行 `node --test tests/*.test.mjs`。使用 Node 內建測試工具，
不需要套件安裝或資料庫連線。測試涵蓋數值及配對邏輯，並以記憶體 DOM 執行實際比較與輸入事件處理器；
不取代瀏覽器外觀測試。Pull request 會自動執行這些離線測試；既有的 Supabase release gate 保持不變。

CI 另以 GitHub 雲端執行器的真正 Chromium 執行 `tests/browser-smoke.mjs`，不依賴使用者的電腦。
流程安裝固定版本 Playwright 1.57.0 與 Chromium，載入實際應用程式，只模擬登入及後端儲存，
並阻擋其他對外請求。截圖保留七天；這驗證操作流程，不驗證正式登入、Supabase 權限或部署。
