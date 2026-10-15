# 驗證紀錄

驗證日期：2026-10-07～2026-10-08（Asia/Taipei）。產品版號：1.2.2。本機驗證完成，正式部署待 PR 合併後由現有 CI/CD 執行。

## 建置與規格

- `frontend/`: `npm run build` 通過，無預算警告；選單與首頁頁尾由 package.json 取得版本。
- `frontend/`: `npm test -- --watch=false` 通過，10 個檔案、63 個測試。包含啟動穩定、可見／連線事件、重複請求、離線／錯誤、未核實結果、狀態保留、銷毀清理、登入／未登入選單、自動提醒、手動結果、避免重複提醒及確認等更新測試。
- `backend/`: `mvnw.cmd clean package -DskipTests` 通過，產生 backend-1.2.2.jar；未執行後端測試，後端僅改產品版號。
- 套件、鎖定檔根層／根套件與後端版號一致。產出的 ngsw.json 包含 40 個檔案，逐一核對 SHA-1，全部符合。
- Hosting glob 規則核對通過：根入口、index.html、index.csr.html、ngsw.json、ngsw-worker.js 均要求重新驗證，不覆蓋有雜湊的 main 資源或 API 快取設定。
- `openspec validate --specs --strict`：8 個主規格通過；本 change strict 驗證與 `git diff --check` 通過。

## Production PWA 整合

以 production 產物在本機 HTTP 伺服器及隔離 Chrome 環境測試真實 Service Worker。版本 A 使用本次產物；版本 B 在測試伺服器替換 main 檔名、入口及對應雜湊，並新增辨識標記，未修改正式產物或連接正式帳號／API。

- A 完成安裝且由 Service Worker 控制；自動檢查沒有新版時不跳提醒，沒有常駐版本資訊列。從未登入的右上角選單手動檢查後，以 Snackbar 顯示最新版。
- 在登入表單輸入合成 Email，切換伺服器為 B 後發送可見狀態事件觸發自動檢查；上方 Snackbar 顯示新版就緒，仍執行 A 且輸入保留。
- 從 Snackbar 按鈕開啟更新確認；Escape 取消後，可從選單再次開啟確認。預設聚焦「繼續使用」，Enter 取消也保留輸入及選單入口。
- 再次手動檢查仍提醒已下載的新版，選單更新入口不消失。
- 對確認按鈕使用 DOM click 後才重新載入；新頁執行 B 的辨識標記，確認載入下載完成的新內容。
- 離線手動檢查的 Snackbar 回報由元件測試驗證；離線不發請求、恢復連線自動檢查、錯誤與就緒狀態保留由服務單元測試驗證。本次選單版瀏覽器流程驗證至 B 載入，未另宣稱完成全部離線瀏覽操作。
- 明暗主題 × 320／390／1280 CSS 像素寬 × 16／32 CSS 像素基準字級，共 12 組；更新選單與 Snackbar 無水平溢出、選單觸發／更新操作按鈕在視窗內且至少 44px 高。

測試環境阻擋外部字型請求並使用既有 fallback 字型。選單／提示動作透過 DOM click 啟動 Angular 綁定，鍵盤取消／確認使用真實鍵盤事件；版面量測前以 Web Animations API 結束有限的進場動畫，避免此 headless 環境停在縮放起始畫格。以上為最終版面 DOM 幾何檢查，未宣稱完成動畫效果、實體手機觸控或所有瀏覽器驗收。

## 發布限制

- Hosting 根入口、入口 HTML 與更新中繼檔的 no-cache 規則已寫入設定；實際線上標頭需部署後確認，本次未手動部署。
- 原先已載入的舊版不會立即擁有本次更新入口，仍需取得本次產物並重新載入一次。
- 開發模式未啟用 Service Worker，選單的檢查更新按鈕停用；更新流程應使用 production 產物驗收。
