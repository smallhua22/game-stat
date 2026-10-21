# Preview before replacing player data

Choose **匯入 JSON**, then review the filename, target mode and hitter/pitcher counts.
Nothing is imported until **取代資料並同步** is selected. **取消，保留原有資料** or
Escape closes the preview without replacing data or requesting an import save.
The cancel button receives initial focus. Ordinary autosaves of existing edits are
not paused by this preview.

Confirmation replaces both sheets in the indicated mode, including unsynced edits.
It is not a merge. Missing fields become empty; the other mode and column visibility
preferences are unchanged. Cancel and back up anything you need before proceeding.
An empty array intentionally replaces that sheet with zero players. Both sheet arrays
are required; malformed rows and invalid identities are rejected before preview.
Older exports without a mode use the mode selected when the file was chosen.

Loading into the editor is not proof of cloud persistence: check the subsequent cloud
status. If a save error appears, keep the source file and retry importing it.
A detected account or mode change while a file is reading or awaiting confirmation requires
selecting the file again. Newer file selections supersede unfinished reads. Filenames
are displayed as text, never HTML. This does not add named snapshots or change storage.

# 取代選手資料前先預覽

選擇「匯入 JSON」後，先確認檔名、目標模式與打者／投手人數。按下「取代資料並同步」
之前不會匯入。「取消，保留原有資料」或 Escape 可關閉預覽，不取代資料，也不發出
匯入儲存要求；初始焦點在取消按鈕。原有修改的一般自動儲存不會因此暫停。

確認後會取代指定模式的兩張表（含尚未同步修改），不是合併；缺少欄位會清空。
另一模式與欄位顯示設定不受影響。需要保留資料時，請先取消並備份。
空陣列代表將該表清空；檔案必須包含兩張表的陣列。無效資料列或識別資訊會在預覽前
被拒絕。舊檔未提供模式時，採用選檔當下的模式。

畫面載入不代表雲端儲存成功，請確認後續同步狀態；失敗時保留來源檔並重試匯入。
讀檔或預覽期間若切換帳號／模式，須重新選檔；新選檔會取代尚未完成的讀取。
檔名僅顯示文字，不執行 HTML。本功能不新增具名快照或變更儲存結構。
