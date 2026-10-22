# Full-data JSON backup

## English

Choose **下載完整備份** (Download full backup) to capture the current mode's hitters and
pitchers, including hidden stored fields and edits that have not synced yet. Download each
mode separately. Normal Copy/Download JSON still exports visible columns only.

The schemaVersion 2 file includes mode, activeSheet, sheets and exportedAt (UTC ISO time).
It uses the same stored data as cloud saving, without calculated display columns, account
credentials, column-visibility preferences or the other mode. Existing stored row IDs, if
present, are retained. Downloading does not save, modify or upload data. Check your browser's
downloads: starting a download does not prove that the file was saved to disk.

Use the file as an earlier growth-comparison snapshot, or restore with **匯入 JSON** (Import
JSON). Import replaces that mode's current data and uses the existing cloud-save flow;
back up current data first. Stored player fields and the active sheet round-trip through
normalization; exportedAt describes the file and is not retained as current-table metadata.
Unknown fields and computed columns are not restored by the existing importer. This is a
local file backup, not named cloud snapshots or automatic history.

Run `node --test tests/*.test.mjs`. The dedicated browser check runs on pull requests with
mock authentication/storage and blocked external requests; no live account data is used.

## 繁體中文

按「下載完整備份」保存目前模式的打者、投手、隱藏欄位與尚未同步的修改。
兩種模式需分別下載。原有複製／下載 JSON 仍只包含可見欄位。

檔案使用 schemaVersion 2，含 mode、activeSheet、sheets 及 UTC 匯出時間 exportedAt。
內容與雲端儲存所用資料相同，保留已存在的選手列 ID，不含計算欄位、登入憑證、
欄位顯示偏好或另一模式。下載不修改或上傳資料；請在瀏覽器確認檔案確實已儲存。

可將檔案用於成長比較，或用「匯入 JSON」還原。匯入會取代該模式目前資料，並沿用
既有雲端儲存流程，請先備份。支援的選手欄位與作用中資料表可還原；匯出時間僅屬於
檔案，不保留為目前資料表的中繼資料。未知欄位與計算欄位不會還原。
這是本機檔案備份，不是具名雲端快照或自動歷史紀錄。
