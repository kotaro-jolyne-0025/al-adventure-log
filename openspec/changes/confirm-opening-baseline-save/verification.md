# 驗證紀錄

日期：2026-10-07。此變更為 1.2.1 驗收補充，尚未 commit、push 或合併 main。

## 自動驗證

- `frontend/` 的 `npm.cmd test -- --watch=false`：9 個檔案、44 個測試通過。角色表單 14 個案例涵蓋有／無冒險、各開卡欄位、確認／取消／關閉、改回原值、等值格式與職業別名／排列、新建、無效表單、重複提交、預覽／更新失敗及重試。
- `npm.cmd run build`：production build 通過，無 budget 警告。
- `openspec validate confirm-opening-baseline-save --strict` 通過；`openspec validate --specs --strict`：8 個主規格通過。
- `git diff --check` 通過。

## 瀏覽器驗證

使用現有 Playwright 腳本模式與本機 Chrome、開發伺服器。API 全部攔截並使用 `example.invalid` 虛構資料，確認後的更新也只回傳測試結果，不寫入實際資料。

- [檢查腳本](../../../output/playwright/opening-baseline-confirm-check.cjs)、[24 組結果](../../../output/playwright/opening-baseline-confirm-results.json)。
- 320／390／1280px × 明暗主題 × 16／32px 根字級 × 有／無冒險，共 24 組通過。
- 視窗與按鈕不超出左右邊界，文字可換行，手機按鈕至少 44px；預覽明確顯示目前值至預計值。
- 初始焦點為「繼續編輯」，Enter 取消並保留輸入；重新開啟後 Escape 關閉；最後以 Space 確認，僅送出一次更新。
- 有冒險時先預覽，無冒險不新增預覽請求；無瀏覽器 runtime error。
- [淺色手機截圖](../../../output/playwright/opening-baseline-confirm-light.png)、[深色手機截圖](../../../output/playwright/opening-baseline-confirm-dark.png)。

根字級檢查不代表實機瀏覽器縮放或螢幕閱讀器驗收；後端既有重算 API 未修改，本次不宣稱驗證正式資料重算。

## 提交前複驗

2026-10-07 使用者完成驗收並授權 push 分支；在排除原有個人 SCSS 修改的隔離副本，44 個測試與 24 組確認流程再次通過，包含金幣前後數值的「金」單位。Production build 通過，兩個既有 SCSS budget 警告詳見 P2 驗證紀錄。
