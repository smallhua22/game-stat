# Remember legacy snapshot player matches

After loading an older JSON snapshot, use **配對舊快照選手** to review both sheets.
Unique trimmed names are suggested; ambiguous/missing names require a choice of a
current row (name, team and row number), or a separate historical identity. A current
player can only be selected once. Existing identified rows are never remapped.
Cancel/Escape discard unsubmitted choices. No player statistics are changed.

Save synchronizes the choices and current editable mode data to the signed-in account
using the existing optimistic-lock path. Failure keeps the dialog available for retry;
only “已同步至雲端” confirms cloud persistence. After a conflict reload, reopen the dialog.
Choices are isolated by mode and keyed by canonical snapshot content (both sheets),
not filename or export timestamp. Reopening the same content reuses the choices,
including after renames. Changed stats or row order describe different content.
Deleted targets remain unmatched rather than being reassigned by name. You can reopen
the chooser to correct a saved match. Normal JSON export/import retains the choices;
replacing mode data with an older file without them removes them, as does resetting data.
This is not saved snapshot storage: select the historical file again after refresh.
No new database table, access policy or production data migration is introduced.

# 記住舊快照的選手配對

載入舊 JSON 快照後，按「配對舊快照選手」檢視打者與投手。唯一姓名會預選；
同名或無對應者需選擇目前選手（姓名、隊伍與列號），或保留為獨立歷史紀錄。
每位目前選手只能配對一次，已有識別資訊的紀錄不會重新配對。取消／Escape
會捨棄尚未送出的選擇；選手數值不變。

「儲存配對」會連同目前模式資料同步至登入帳戶；失敗可重試，只有「已同步至雲端」
表示儲存成功。若衝突後重新載入資料，請重新開啟配對視窗。相同快照內容換檔名或
匯出時間仍沿用配對；數值或列順序變更則視為不同內容。改名不影響配對，已刪除的
目前選手不會自動改配別人。可重新開啟視窗修正配對。JSON 匯出／匯入保留配對；
匯入不含配對的舊檔或重設資料會移除配對。這不是具名快照儲存，重新整理後仍需
再次選取歷史檔案。不新增資料表或存取權限。
