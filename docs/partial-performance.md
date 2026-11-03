# Available values in performance comparisons

The chart includes a record when either version has a valid value, so newly added players, removed players and incomplete metrics remain visible. Each available value uses the same zero-inclusive scale. A missing side has **無可用數值** and an em dash, not a zero-length bar. A real zero still has a numeric zero and a zero marker.

Unmatched identities stay separate records even when names are identical; their status is shown and no difference is calculated. Missing metrics and unrepresentable differences likewise show no delta. Both finite values can still be shown when their subtraction overflows. Records with no finite values remain in the detail table, with a chart coverage count. Counts refer to records, not unique people. No identity, stored data, CSV or matching behavior changes.

This increment is stacked on #15. It adds no controls or saved-snapshot UI. Run `node --test tests/*.test.mjs`; `node tests/browser-smoke.mjs` requires Playwright Chromium and checks both modes/sheets, single-sided values, long names, baseline clearing, unchanged data and desktop/390px layouts. Live authentication and production storage are outside this read-only change.

# 比較圖中的可用數值

任一版本有有效數值就顯示該筆紀錄，讓新增、移除選手及缺少部分欄位的資料仍可見。所有可用值共用含零刻度；缺少的一側顯示「無可用數值」及破折號，不畫零長度長條。真正的零保留數字與零標記。

未配對身分即使同名仍各自顯示，標明狀態且不計差值。缺少欄位或差值超出計算範圍同樣不顯示差值；若兩值有限但相減溢位，仍可顯示兩值。兩側均無有限數值的紀錄保留於明細表，圖表標明未繪圖筆數。筆數不是不重複人數，不改身分、儲存資料、CSV 或配對規則。

本變更堆疊於 #15，不新增控制項或具名快照 UI。測試指令見上方，涵蓋兩模式／資料表、單側數值、長姓名、清除快照、資料不變與桌面／390px 版面。正式登入與儲存不在本唯讀變更驗證範圍。
