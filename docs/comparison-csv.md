# Download a comparison report

Choose a historical JSON snapshot, sheet and metric, then **下載比較 CSV**. The UTF-8
CSV includes every displayed result, including unmatched players and missing values,
plus mode, sheet, metric, baseline filename, supplied baseline export time and report
creation time in UTC. It captures current unsynced edits at the moment of download.
Only the selected sheet and metric are included; switch them and download again for
another report. No cloud write occurs. This is not a backup and cannot be imported
as player data. Named saved snapshots remain separate future work.

Values match the comparison table: current minus baseline, signs show direction
rather than improvement, and missing values are `—`, never zero. IP is baseball
innings notation (`+0.2` means two outs), not decimal arithmetic. Import CSV columns
as **text** in spreadsheets to preserve signs, innings, names and timestamps exactly.
Untrusted text beginning with a formula prefix is escaped with an apostrophe, which
some CSV readers display. Quotes, commas, newlines and Traditional Chinese are retained.
An empty comparison produces column headers only. Invalid replacement snapshots leave
previous results intact, so the report identifies the last successfully loaded file.

“已開始下載” means the browser download was initiated, not that saving to disk is
confirmed. Check the browser's downloads; retry after a reported error. Clear or reload
removes the temporary baseline and disables report download. Reports may contain
private player data: review them before sharing. No automatic upload or sharing occurs.

# 下載比較報表

選擇歷史 JSON 快照、資料表與欄位後，按「下載比較 CSV」。UTF-8 CSV 包含畫面上的
所有比較結果（含未配對與缺值）、模式、資料表、欄位、來源檔名、來源提供的匯出時間，
以及 UTC 報表產生時間。下載當下的未同步修改也會納入。一次僅匯出目前資料表與欄位；
切換後可再下載。不寫入雲端，不是備份，不能作為選手資料匯入；具名快照仍為後續功能。

數值與比較表一致：目前減去快照，正負只代表方向，缺值為 `—` 而非零。IP 使用棒球
記法（`+0.2` 代表兩個出局數），不是十進位計算。試算表請將欄位以「文字」匯入，
保留正負號、局數、姓名與時間。可能被解讀為公式的文字會加單引號；部分 CSV 閱讀器
會顯示此符號。空比較只有標題列；無效的替換檔案不影響舊比較，報表會標示上次成功
載入的檔名。清除或重新整理後，暫存快照與下載功能會移除。

「已開始下載」只表示已交給瀏覽器，不保證磁碟儲存成功，請確認下載結果；錯誤可重試。
報表可能含私人選手資料，分享前請自行確認；不會自動上傳或分享。
