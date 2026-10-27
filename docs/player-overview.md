# One-player performance overview

## English

Load an earlier JSON snapshot, then choose a current player under **單一選手表現總覽**.
Each card compares one supported numeric field, with earlier/current values and a signed delta.
Both modes and hitter/pitcher sheets are supported, regardless of roster-column visibility.
This complements the one-metric roster comparison: inspect one player's complete numeric profile
without changing the metric repeatedly. AVG/OBP/SLG are separate cards; text/grades and computed
fields are excluded, as in the comparison table. These are stored totals/values, not period rates.

Each card has its own zero-inclusive scale. Compare its two bars, never lengths across cards.
Negative values extend left of zero; IP bar lengths use outs and labels use baseball notation.
Labels use up to three decimals. Exact displayed values and deltas accompany colours.
Missing, invalid or unmatched values have no bars or fabricated zero/delta; their reason is shown.
Larger values are not necessarily better. No composite score or multi-date trend is implied.

Selections are temporary per mode/sheet, follow persistent row identity through rename/reorder,
and fall back to the first current row when the selected row is removed. Numbered options
identify same-name rows. Earlier-only rows stay in the existing comparison table, not the selector.
When composing with #7, pass its resolved snapshot data to the overview as well as the roster comparison.
The overview updates with unsynced edits and does not save, import, export or modify player data.
Clearing the snapshot hides it. Named saved snapshots remain separate work in #4, dependent on #3.

Verify with `node --test tests/*.test.mjs` and `node tests/browser-smoke.mjs` (Playwright Chromium).

## 繁體中文

載入較早 JSON 快照後，在「單一選手表現總覽」選擇目前選手。每張卡呈現一個數值欄位的
較早／目前數值及差值；支援兩模式、打者／投手，不受資料表欄位顯示限制。
不必逐次切換欄位即可查看該選手的數值全貌，補充原本單欄位的全隊比較。
AVG／OBP／SLG 分卡呈現；不含文字、等級及計算欄位。這是儲存數值，不是期間專屬比率。

每卡刻度獨立且包含零，只比較同卡兩條長度，不跨卡比較；負值向左，IP 長度依出局數，
標籤保留棒球記法與最多三位小數。不只依賴顏色，缺值、無效或未配對均不畫成零，並顯示原因。
數字較大不一定較好，不合成總分或暗示多日期趨勢。

選擇依模式／資料表暫存，改名、排序仍依識別資訊保留；刪除後回到第一列，同名選項附列號。
僅在較早快照存在的列仍可在原比較表查看。與 #7 組合時，總覽與全隊比較須共用套用配對後的快照。隨尚未同步編輯更新，不修改資料或新增雲端儲存；
清除快照即隱藏總覽。具名快照仍留待 #4，先完成 #3 的依賴。
