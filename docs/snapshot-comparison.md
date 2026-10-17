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

Rows now have a `rowId` (a lowercase UUID v4), independent of visible columns. IDs survive edits,
renames, reordering, cloud saves and JSON exports/imports; duplicating or creating a row creates a new ID.
Comparisons use IDs first within the same mode and sheet, so renames and duplicate names can match.
Different IDs never match solely by name. Invalid or repeated IDs reject a file instead of merging rows.

Older schemaVersion 2 tables receive IDs on load; the normal cloud save persists them. Until synchronization
succeeds, export a backup before leaving the page. Existing optimistic conflict handling still applies.
An older ID-less comparison file uses unique, case-sensitive trimmed names; ambiguous or absent matches
remain unmatched. Confirm that legacy matched names refer to the same player and statistical period,
especially Prospi cards from different Series. Keep the exported IDs when editing files outside the app.

This is the row-identity foundation for issue #3, not its complete legacy-linking workflow. A saved chooser
for ambiguous/renamed historical rows and reusable historical linking decisions remain future work.
Importing an ID-less file as the current table creates fresh identities, not links to the replaced table.
Comparisons do not calculate rate statistics for the intervening period.
Missing, blank, or invalid values show `—`, never zero. Existing JSON exports contain only visible columns;
show a metric before downloading a snapshot if you want to compare it later. Comparison itself is independent
of current column visibility. Raw numeric fields and AVG/OBP/SLG are supported; letter grades, free text,
and computed columns are excluded.

### Tests

Run `node --test tests/*.test.mjs` from the project root. Tests use Node's built-in runner with no package
installation or database connection. They cover numerical and matching logic and execute the real comparison
and input handlers in an in-memory DOM; they do not replace visual browser testing. These offline tests run
automatically on pull requests. The existing Supabase release gate is unchanged.

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

每列現在都有獨立於可見欄位的 `rowId`（小寫 UUID v4）。編輯、改名、排序、雲端儲存及
JSON 匯出／匯入均保留 ID；新增或複製列則產生新 ID。比較優先依同模式、同資料表的 ID 配對，
因此改名或同名列也能正確比較。不同 ID 不會只因姓名相同而合併；無效或重複 ID 會拒絕載入檔案。

舊版 schemaVersion 2 資料表載入時會取得 ID，並由一般雲端儲存流程保存。同步成功前，
離開頁面前請先匯出備份；既有的版本衝突保護仍然適用。沒有 ID 的舊比較檔仍使用唯一姓名，
忽略前後空白但保留大小寫；同名或找不到的列維持未配對。請確認舊檔配對的是同一選手與統計期間，
尤其是 Prospi 中不同 Series 的同名卡片。在應用程式外修改檔案時，請保留匯出的 ID。

這是 issue #3 的列識別基礎，尚未完成全部舊資料連結流程。同名／改名歷史列的選擇介面與
連結決定的永久保存將另行實作。將無 ID 檔案匯入成目前資料表會建立新身分，並非連結被替換的資料。
比較不推算期間內的比率成績。
缺少、空白或無效的數值顯示 `—`，不當作零。原有 JSON 匯出只包含已顯示的欄位；
若要日後比較某欄位，請在下載快照前將它顯示。成長比較本身不受目前欄位顯示設定影響。
目前支援原始數值欄位及 AVG／OBP／SLG，不包含字母評價、自由文字和計算欄位。

### 測試

在專案根目錄執行 `node --test tests/*.test.mjs`。使用 Node 內建測試工具，
不需要套件安裝或資料庫連線。測試涵蓋數值及配對邏輯，並以記憶體 DOM 執行實際比較與輸入事件處理器；
不取代瀏覽器外觀測試。Pull request 會自動執行這些離線測試；既有的 Supabase release gate 保持不變。
