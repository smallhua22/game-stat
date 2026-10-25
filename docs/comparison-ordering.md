# Comparison delta ordering

## English

Use **差值排序** in the growth comparison panel to switch between original order,
largest numeric delta first, and smallest first. This changes only the comparison view,
not the editable roster, saved data, JSON exports or full backups. When combined with the
comparison CSV feature, its report follows this displayed order.

Deltas mean current minus earlier, not improvement: a lower ERA can be desirable.
Missing, invalid and unmatched rows remain visible after comparable rows in either direction.
Ties keep their original relative order, using the same three-decimal precision as the display.
IP sorts by outs, not decimal innings. Select **原始順序** to restore the comparison's source order.

The choice is temporary and separate for each mode and hitter/pitcher sheet. Changing metrics,
editing values or selecting another baseline recomputes the ordering. Clearing the baseline disables
sorting; loading a new one reuses the current page's choice. Refreshing resets it.
No named-snapshot storage, new matching behavior, backend changes or deferred controls are included.

## 繁體中文

在成長比較的「差值排序」選擇原始順序、由大到小或由小到大，只改變比較畫面，
不改動編輯表格順序、雲端資料、JSON 匯出或完整備份；搭配比較 CSV 功能時，報表沿用畫面順序。

差值為目前減去較早快照，不判斷表現好壞，例如 ERA 較低可能更好。
缺少／無效數值與未配對列保留在可比較列之後；相同顯示差值維持原本相對順序，
依畫面小數最多三位判斷相同，IP 以出局數排序。選「原始順序」即可還原。

偏好依模式與打者／投手表分開暫存，切換欄位、修改數值或更換快照會重新排序。
清除快照後停用，重新載入快照會沿用本頁偏好，重新整理則重設。
不包含具名快照儲存、新配對方式、後端修改或尚未實作的控制項。
