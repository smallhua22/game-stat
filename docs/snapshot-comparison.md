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

There are no stable player IDs, so matching uses unique, case-sensitive names within the same mode and sheet,
ignoring surrounding whitespace. Renamed players are separate players; duplicate names are not matched.
Confirm that matched names refer to the same player and statistical period, especially Prospi cards from
different Series. New, snapshot-only, and unmatched players are labeled. Changes compare the two snapshots;
they do not calculate rate statistics for the intervening period.

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

目前資料沒有穩定的選手 ID，因此只依同一模式、同一資料表中的唯一姓名配對，忽略前後空白，
保留大小寫。改名視為不同選手；同名不自動配對。請確認配對的是同一位選手和相同統計期間，
尤其是 Prospi 中不同 Series 的同名卡片。新選手、僅快照有的選手與無法配對的列均會標示。
此功能呈現兩份資料的差異，不推算期間內的比率成績。

缺少、空白或無效的數值顯示 `—`，不當作零。原有 JSON 匯出只包含已顯示的欄位；
若要日後比較某欄位，請在下載快照前將它顯示，或使用[完整備份](full-data-backup.md)保留隱藏的儲存欄位。
成長比較本身不受目前欄位顯示設定影響。
目前支援原始數值欄位及 AVG／OBP／SLG，不包含字母評價、自由文字和計算欄位。

### 測試

在專案根目錄執行 `node --test tests/*.test.mjs`。使用 Node 內建測試工具，
不需要套件安裝或資料庫連線。測試涵蓋數值及配對邏輯，並以記憶體 DOM 執行實際比較與輸入事件處理器；
不取代瀏覽器外觀測試。Pull request 會自動執行這些離線測試；既有的 Supabase release gate 保持不變。
