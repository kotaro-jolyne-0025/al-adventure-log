# 第二批 P1 驗證紀錄

日期：2026-10-06（工作於 2026-10-05 開始）。

驗收：使用者於 2026-10-06 確認本批修改驗收 OK；已封存。此確認不額外推定裝置或測試範圍。

## 結果

- 前端 `npm test -- --watch=false`：9 個測試檔、32 個測試通過。
- 前端 `npm run build`：Production build 通過。
- `openspec validate improve-card-readability-and-keyboard-navigation --strict`：通過。
- `openspec validate --specs`：8 份主規格全部通過。
- 原有冒險表單與倉庫列表 SCSS 的 SHA256 與開始本批時相同，未編輯這兩個檔案。

## 瀏覽器驗證

使用本機 Chromium／Playwright、虛構角色及攔截 API；不連接正式資料。測試會記錄並拒絕非預期 API 寫入。可重跑的腳本：[card-accessibility-check.cjs](../../../../output/playwright/card-accessibility-check.cjs)。啟動本機前端後，以 Node 執行該腳本；`PREVIEW_PLAYWRIGHT_PATH` 指向本機 Playwright 模組，`PREVIEW_URL` 可覆寫預設 `http://127.0.0.1:4200`。未新增專案依賴。

| 檢查 | 結果 |
|---|---|
| 320／360／390／768／1280px × 100%／200% 根字級，共 10 組 | 名稱、複合職業、種族、子職、派系完整換行，沒有裁切、水平溢出或覆蓋操作列；資訊及等級最低 14px／28px |
| 明暗主題 × 角色／冒險／永久物品／消耗品卡，共 8 組 | Tab 可到達主連結，Enter 前往原目的頁；3px 實線焦點可見；連結有 href 及明確名稱，無巢狀 button／anchor |
| Ctrl＋點擊及卡片空白處點擊 | 新分頁開啟原目的頁且原列表保留；卡片左上空白處仍可導覽 |
| 角色與兩類倉庫編輯／刪除，各明暗主題與鍵盤／滑鼠 | 編輯前往正確頁面；刪除只打開確認，取消後保留目前列表，不誤觸主導覽 |
| 品牌連結 | 明暗主題均可 Tab 聚焦、Enter 返回角色列表，焦點可見 |
| API／JavaScript | 沒有寫入請求，沒有頁面 JavaScript 例外 |

截圖：[320px 一般文字](../../../../output/playwright/readable-character-card-320.png)、[320px 200% 根字級](../../../../output/playwright/readable-character-card-320-large-text.png)。

## 限制

200% 檢查透過根字級 16px→32px 模擬，未涵蓋瀏覽器整頁縮放、iOS／Android 系統字級、實機觸控或螢幕閱讀器。全站透明排序選單與其他 P2 焦點／文字對比仍列在 DESIGN.md，不包含於本批。

未 commit、push 或部署；本 change 的要求已同步至 mobile-pwa 主規格，並於 2026-10-06 封存。
