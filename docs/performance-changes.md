# Visualize the size and direction of player changes

## English

Each player in the comparison chart now has a **change** strip beneath the earlier/current bars.
It makes small differences visible even when the original totals are large. All change strips
share a separate, symmetric scale around zero: decreases extend left, increases right. Equal
absolute changes have equal lengths. The chart states both scales; do not compare a change strip
with a total-value bar. Signs describe numerical direction, not whether performance improved.

Exact signed values remain readable without relying on colour. Zero has no bar; missing, invalid,
unmatched and non-finite changes are not plotted; the detail table remains available, and unrepresentable deltas display `—`.
Values use the table's three-decimal display precision. IP geometry uses outs and labels retain
baseball notation. Changing the metric, baseline or current edits recalculates the scale, so only
compare lengths within the current chart. This is two-version change, not a multi-date trend.

This view uses the same identity-resolved rows as the table and CSV. It does not write data,
reorder players, change exports or create snapshots. Named history remains separate future work.
Run `node --test tests/*.test.mjs`; existing isolated Chromium smoke covers both modes/sheets,
signed geometry, zero, missing rows, metric changes, unchanged data and desktop/mobile rendering.
Production sign-in and Supabase are not exercised by these mocked-backend browser tests.

## 繁體中文

每位選手的較早／目前長條下方新增「差值（另尺）」，讓原本總量很大時的小幅變化仍清楚可見。
所有差值列共用獨立的對稱刻度：中央為零，減少向左、增加向右，相同幅度有相同長度。
畫面標明兩種刻度，不可將差值列與總量長條互相比長度；正負只表示數值方向，不代表優劣。

保留完整正負文字，不只依賴顏色。零不畫長條；缺值、無效、未配對及非有限差值不畫成零，
明細表仍保留資料，無法表示的差值顯示 `—`。依明細表最多三位小數；IP 長度用出局數，標籤保留棒球記法。
切換欄位、快照或編輯資料會重算刻度，只比較目前圖內的長度；這不是多日期趨勢。

沿用明細表與 CSV 相同的身分配對，不寫入資料、重排選手、修改匯出或建立快照。
具名歷史仍是獨立後續工作。單元與隔離 Chromium 測試涵蓋兩模式／資料表、正負幅度、零、
缺值、欄位切換、資料不變及桌面／行動版；模擬後端不代表正式登入或 Supabase 已驗證。
