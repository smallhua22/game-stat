# Current player performance

Open **選手表現與成長比較** to compare the current roster visually without preparing a baseline file. Choose the existing metric selector; each valid current value gets one blue bar and its numeric label. This is the whole active mode/sheet, including unsynced edits, not a ranking or a historical trend. Duplicate names remain separate records.

All bars share a zero-inclusive scale; negative values extend left, zero stays visible as a numeric zero, and IP uses outs with baseball notation. Missing/invalid values have no bar and are listed by name with an em dash. Slash-line components and three-decimal display precision match the comparison table. No rates are averaged and no earlier values or deltas are invented.

Loading a baseline restores the existing two-series comparison, identity matching, detail table and CSV. Clearing it returns to current-only view; comparison CSV and legacy linking stay disabled without a baseline. Mode/sheet/metric changes and edits refresh the chart without chart-triggered data writes. Named saved snapshots remain a separate prerequisite-gated feature; this PR does not expose them.

This increment is stacked on PR #15. Run `node --test tests/*.test.mjs`; `node tests/browser-smoke.mjs` additionally requires Playwright Chromium. Browser tests cover both modes/sheets, clear/load transitions, current-only labels, missing values, read-only behavior and 390px/desktop captures. Live authentication and production database behavior are outside this read-only change.

# 目前選手表現

開啟「選手表現與成長比較」，不必先準備快照即可視覺比較目前名單。沿用欄位選單，每筆有效目前數值顯示一條藍色長條與數字。範圍為目前模式／資料表全表，包含尚未同步修改，不是排名或歷史趨勢；同名紀錄仍各自顯示。

所有長條共用包含零的刻度；負值向左、零保留數字，IP 依出局數縮放並用棒球記法顯示。缺少／無效數值不繪長條，而以姓名與破折號列出。AVG/OBP/SLG 與小數第三位精度沿用比較規則，不平均比率、不虛構較早數值或差值。

載入快照後回到既有雙版本長條、身分配對、明細與 CSV；清除後回到目前表現。沒有快照時停用比較 CSV 與舊檔配對。切換模式、資料表、欄位或修改數值會更新圖表，圖表本身不寫入資料。具名快照仍為另項工作，未暴露未完成 UI。

本變更堆疊於 PR #15。單元測試指令見上方；瀏覽器測試另需 Playwright Chromium，涵蓋兩模式與兩資料表、載入／清除、缺值、唯讀行為及桌面／390px 截圖。正式登入與資料庫不在本唯讀變更的驗證範圍。
