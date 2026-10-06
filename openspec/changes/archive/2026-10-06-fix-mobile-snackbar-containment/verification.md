# 操作提示裁切驗證

日期：2026-10-06。

驗收：使用者於 2026-10-06 確認本批修改驗收 OK；已封存。此確認不額外推定裝置或測試範圍。

同批微調：忘記密碼的信箱欄位已移除圖示及未使用匯入，正式建置通過。

- 以本機 Chromium 與攔截 API 重現刪除長名稱角色後提示／關閉按鈕的水平溢出。
- 修正後於 320／360／390／600／768／1280px × 明暗主題 × 100%／200% 根字級，共 24 組驗證提示文字及關閉按鈕不超出視窗，沒有文字裁切；關閉可正常操作。
- 流程包含實際點選刪除與確認，刪除 API 僅對本機虛構資料模擬；量測等待 Snackbar 進場動畫完成。
- 確認刪除彈窗在相同視窗內亦無水平溢出。
- Production build 與 OpenSpec strict 驗證通過；純 SCSS 修正以瀏覽器回歸及建置驗證，未新增單元測試或依賴。
- 未變更刪除邏輯、提示文案、提示時間或資料庫；尚未進行實機安全區測試，未 commit／push／部署。

回歸腳本：[snackbar-containment-check.cjs](../../../../output/playwright/snackbar-containment-check.cjs)。啟動本機前端後設定 `PREVIEW_PLAYWRIGHT_PATH` 指向本機 Playwright 模組，以 Node 執行該腳本並加上 `--verify`；`PREVIEW_URL` 預設為 `http://127.0.0.1:4200`。測試會攔截所有 API 請求。

截圖：[修正前](../../../../output/playwright/delete-character-snackbar-before.png)、[修正後](../../../../output/playwright/delete-character-snackbar-after.png)。
