# 1.2.1 P2 驗證紀錄

## 完成範圍

DESIGN.md 第 8 節 P2 的 token、主色／稀有度、休整期、雙主題常數、故事獎勵、全文閱讀、次要文字、操作列、HUD、骨架、viewport／reduced-motion 與 SRS 同步均已處理。

新畫面／整套配色調整留到下一版本；本輪沿用現有 Material azure／violet 及原有語意色相。前端 package／lockfile 與首頁標示為 1.2.1。

## 自動與瀏覽器結果

| 檢查 | 結果 |
| --- | --- |
| `npm.cmd run build` | 成功，無樣式 budget 警告 |
| `npm.cmd test -- --watch=false` | 9 個檔案、32 個測試通過 |
| `openspec validate complete-v1-2-1-ui-consistency --strict` | 通過 |
| `openspec validate --specs --strict` | 8 個主規格通過；mobile-pwa 已加入五項需求 |
| 自訂設計 token | 未定義引用檢查通過 |
| P2 瀏覽器整合 | 68 組結果通過，無 pageerror／實際資料寫入 |
| 卡片回歸 | 10 組閱讀／布局及 8 組雙主題卡片導覽通過；鍵盤／滑鼠獨立編輯與取消刪除正常 |
| 控制項焦點回歸 | 12 組列表／主題／視窗組合通過 |
| 刪除提示回歸 | 24 組 Snackbar 範圍、長文字、字級與主題檢查通過 |

P2 使用本機 Chrome（Playwright）與虛構 API：

- 16 組對比結果、240 個文字樣本；包含稀有度一般／選取／hover、來源、備註、HUD 數值／單位、數量、故事獎勵、詳情及頭像 placeholder。受測文字最低對比 **4.81:1（淺色）／4.64:1（深色）**；自訂搜尋 placeholder 以實際 pseudo-element 文字色量測。
- 兩種主題 × 320／360／390／768／1280px × 100%／200% 根字級，共 20 組長中文／連續英文名稱及來源；文字完整換行、操作區不重疊、頁面不水平溢出。
- 手機 HUD 保留五項：等級一列、四項資源 2×2。使用大金額／大數值檢查，數字與單位可分開換行。
- 兩種主題 × 320／390／768px × 100%／200% 根字級，共 12 組表單操作列；一般高度可見 sticky、按鈕文字／圖示留在範圍內、最後備註不被遮住。390px 額外模擬 34px safe-area。400px 高度採文件流，取消／儲存可達。
- reduced-motion 時骨架、spinner 的 animation 停止，hover 不位移。五種寬度下骨架與一般完整資訊卡的高度／頂部位置相同，肖像尺寸一致：320／360px 為 90px、390px 為 104px、768／1280px 為 128px。
- 三種表單的 saving 狀態顯示「正在儲存…」且維持禁用；此檢查直接切換本機元件狀態，用於確認呈現，不聲稱已向後端提交。原有載入與儲存保護由現有單元測試驗證。
- 首頁、登入、註冊、忘記／重設密碼及法律頁在雙主題的 320×400px 短視窗可捲動，無水平溢出；置中頁 min-height 隨 dvh 計算。

## 證據

- [P2 腳本](../../../output/playwright/p2-ui-check.cjs)、[完整結果](../../../output/playwright/p2-ui-results.json)。
- [淺色 HUD](../../../output/playwright/p2-hud-light.png)、[深色 HUD](../../../output/playwright/p2-hud-dark.png)、[淺色長品名](../../../output/playwright/p2-inventory-light.png)、[深色長品名](../../../output/playwright/p2-inventory-dark.png)、[冒險表單操作列](../../../output/playwright/p2-form-actions.png)。
- 回歸腳本：[卡片](../../../output/playwright/card-accessibility-check.cjs)、[控制項焦點](../../../output/playwright/control-focus-check.cjs)、[Snackbar](../../../output/playwright/snackbar-containment-check.cjs)。

## 工作目錄與範圍限制

- 驗證以目前工作目錄為準，包含使用者原有 SCSS 變更。冒險表單 SCSS 未新增差異（原 SHA256 `BB363975A096B6D14DC5725B59B5B30DC6B9FED8DAFC879EDF0F552F7D4EEACB`）；倉庫 SCSS 在原內容上增量修改，未重新格式化或還原其他修改。
- 200% 為根字級 16px→32px；未代替實機系統字級、完整瀏覽器縮放、iOS／Android 鍵盤、地址列／安全區或螢幕閱讀器驗證。
- 原 source-pill／pending-pill 沒有模板引用，刪除未使用樣式；不新增待補明細 UI。法律彈窗元件目前也沒有入口，85dvh 為樣式檢查，未宣稱實際開啟彈窗測試。
- 截圖已人工檢視 HUD、長品名／來源及表單備註與操作列。使用者於 2026-10-07 完成整體驗收並授權 push `v1.2.1`，尚未合併 main。

## 2026-10-07 提交前隔離驗證

- 以待提交內容建立隔離副本，排除使用者原有的冒險表單／倉庫 SCSS 修改；僅移入本輪倉庫全文換行、語意色彩與未使用 pill 樣式移除。
- 9 個測試檔案、44 個測試通過；68 組 P2 與 24 組開卡值確認流程通過，證據檔已更新為此副本的結果。
- Production build 通過；此副本保留較大的既有 SCSS，冒險表單及倉庫各有一個 10KB budget 警告。先前「無警告」記錄指包含使用者原有 SCSS 的工作目錄，不代表這次排除個人修改後的提交內容。
