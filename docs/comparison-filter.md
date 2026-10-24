# Focus on changes in a growth comparison

## English

After loading an earlier JSON snapshot, select **隱藏零差值** (Hide zero deltas).
The selected metric hides comparable rows whose displayed delta rounds to zero
(at most three decimal places). Baseball IP still compares outs, not decimal
innings. Unmatched players and missing/invalid values always remain visible;
unknown is not zero. Positive and negative changes both remain, without implying
that either is better. Shown/total counts and an empty-state message explain the view.

Uncheck to see all rows again. The choice is temporary, separate for each mode and
hitter/pitcher sheet, and resets on page reload. Changing metrics or editing values
refreshes the view. Clearing the snapshot disables the control and hides counts.
No player data, matching, cloud writes, normal JSON or full-data backups change.
When combined with the comparison CSV feature, that report follows displayed rows.
This is not saved snapshot history; named snapshots remain separate future work.

Verify with `node --test tests/*.test.mjs`; `node tests/browser-smoke.mjs` checks
both modes/sheets using an isolated backend and takes screenshots.

## 繁體中文

載入較早 JSON 快照後，勾選「隱藏零差值」，只隱藏目前欄位差值顯示為零
的可比較列（小數最多三位）。IP 仍以出局數計算；未配對與缺少／無效數值
的列一律保留，未知不等於零。正負差值都保留，不判斷表現好壞。
畫面顯示符合／總列數，沒有結果時另有說明；取消勾選可顯示全部。

選項依模式與打者／投手表分開，僅在本頁暫存，重新整理後重設。
切換欄位或修改數值會更新比較；清除快照後停用選項並隱藏列數。
不修改選手、配對、雲端資料、一般 JSON 或完整備份。搭配比較 CSV 功能時，
報表沿用畫面列；具名快照歷史仍是獨立的後續功能。
