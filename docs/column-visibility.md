# Column visibility shortcuts

## English

Open **欄位** (Columns), then **全選欄位** (Select all) to include every field,
including empty inputs. **恢復自動** (Restore automatic) removes custom selections
for only the current mode and sheet: names and calculated columns stay selected;
other columns appear when any player has a nonblank value (zero counts as data).
Individual checkboxes remain available. **收合資料** independently folds metadata
columns; expand it if selected metadata is not visible.

Preferences stay in this browser across reloads, separately for both modes and
hitter/pitcher sheets. These controls do not edit players or schedule cloud saves.
If browser storage fails, the new view works for this session and a warning appears.
Normal Copy/Download JSON follows the selected columns; full-data backup and growth
comparison retain all stored fields regardless of this view. Use full-data backup
for a complete copy. No new database fields or named snapshots are added.

Run `node --test tests/*.test.mjs`; isolated Chromium checks exercise both modes
and sheets, reload persistence, export selection and no view-triggered cloud writes.

## 繁體中文

開啟「欄位」後，按「全選欄位」可選取所有欄位，包含空白輸入欄。
「恢復自動」只清除目前模式與打者／投手資料表的自訂選擇：姓名與計算
欄位維持選取，其他欄位在任一選手有非空白值時顯示，數字 0 也算有資料。
仍可逐欄勾選。「收合資料」另外控制資料欄的收合，必要時請展開。

偏好依模式與資料表儲存於本瀏覽器，重新整理後保留；不修改選手或排程
雲端儲存。瀏覽器無法儲存時，當次顯示仍會更新並提示警告。
一般複製／下載 JSON 隨欄位選擇變更；完整備份及成長比較不受影響。
需保存完整資料時請使用完整備份。不新增資料庫欄位或具名快照功能。
