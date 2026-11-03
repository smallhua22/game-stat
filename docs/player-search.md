# Player-name search

Use **搜尋選手姓名** above the editable roster to find a partial name, ignoring case and surrounding search whitespace. Matching is literal, not a regular expression. It works in both game modes and hitter/pitcher sheets, including duplicate names. The shown/total count and no-match message make hidden rows explicit.

This is a temporary view filter, not a data operation. Search and Clear/Escape never save, remove, or reorder players. JSON, full backups, and snapshot comparisons still include the whole roster. Editing, duplicating, and deleting a visible row target its original player, even when earlier rows are hidden. A renamed row is rechecked when the name edit finishes, not while typing. Move-up/down controls are disabled during a nonblank search to avoid moving across unseen rows; clear the filter first.

Switching mode/sheet, adding a player, or replacing data through import/sample reset clears the search. Other rerenders retain it. Search is not stored across reloads or sent to the backend. Saved snapshots and data-source configuration are separate future work, not exposed by this feature.

## 繁體中文

在資料表上方使用「搜尋選手姓名」，輸入部分姓名即可篩選；忽略大小寫與搜尋文字前後空白，不使用正規表示式。兩種模式的打者／投手皆可使用，同名選手會一併顯示。畫面顯示符合人數／總人數，找不到時會提示修改或清除搜尋。

搜尋僅影響暫時顯示，不儲存、刪除或重新排序資料。JSON、完整備份與成長比較仍使用全部選手。修改、複製、刪除會作用於正確的原始列；修改姓名結束後才重新篩選，不會打字到一半消失。搜尋期間停用上下移動，以免跨越隱藏列造成混淆；請先清除搜尋再調整順序。

清除按鈕或 Escape 可還原全部列；切換模式／資料表、新增選手、匯入或重設範例也會清除搜尋。其他重新繪製保留條件，重新載入不保留，且不傳送到後端。具名快照與資料來源設定仍屬未來工作，本功能不顯示相關介面。
