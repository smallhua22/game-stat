# Read the change distribution

After loading a comparison JSON, the summary shows increased, unchanged, decreased
and unavailable comparison records for the selected mode, sheet and numeric metric.
The segmented bar shows each category's share of **all comparison records**, with
text counts so color is not the only cue. It is a roster-wide overview, not a
performance score: an ERA decrease and an HR increase have different meanings.

Counts use the same three-decimal displayed differences as the table. IP is compared
in outs. Missing/invalid values, overflow and unmatched records are never treated as
zero; the note separates unmatched records from missing/invalid numeric records.
Baseline-only records are included, so the total is **not a unique-player count**.
The detail table explains each unavailable record. Empty data has an explicit message.

The summary follows unsynced edits, saved legacy matching, metric, sheet and mode
changes. Clearing the baseline hides it. It does not save, reorder, export, or change
player data. No dated history or saved-snapshot controls are introduced. When composed
with future/pending table filters, retain this full-comparison scope and its “全表” label;
filters must not silently redefine the summary denominator.

# 閱讀差值分布

載入比較 JSON 後，摘要呈現目前模式、資料表與數值欄位的增加、不變、減少與無法比較
紀錄。分段長條以所有比較紀錄為分母，並提供文字筆數，不只靠顏色辨識。這是全表概況，
不是表現評分：ERA 減少與 HR 增加的意義不同。

分類沿用表格顯示至小數第三位的差值；IP 依出局數計算。缺值、無效值、溢位及未配對
不當作零，說明分別列出未配對與缺值／無效筆數。只在快照中的列也會計入，因此總數
不是不重複選手人數；無法比較的原因請看明細。空資料會顯示明確提示。

未同步編輯、已儲存的舊資料配對、欄位、資料表與模式切換都會更新摘要；清除快照後
隱藏。不儲存、重排、匯出或修改資料，也不建立多日期歷史或快照控制項。未來與表格
篩選整合時，仍保留全表範圍與標示，不應悄悄改變統計分母。
