# Design

## Context

見 proposal.md。frontend 使用 Angular 22、Material、Vitest。現有 layout-setup.js 的 API fixtures 使用較早期登入與讀取契約，實作須依現行 AuthService 與各列表 service 調整。DESIGN.md 已定義手機排序左右邊界誤差最多 2 CSS px，以及桌機倉庫篩選靠左、排序靠右的驗收條件。

## Goals / Non-Goals

測試以真實 Angular 路由及 DOM 驗證已確認的畫面，輸出可人工審查的差異。首批範圍為角色列表、冒險列表、倉庫兩類分頁及共用導覽。完整表單、其他瀏覽器與實機驗收留待後續擴充。

## Decisions

- 使用精確版本的 @playwright/test 與 Chromium，新增獨立 testDir，避免 Vitest 收集瀏覽器測試。提供 test:visual、test:visual:update 與報告指令。
- 使用專用 localhost port 與 Playwright webServer 啟動 Angular。測試攔截所有 API，使用明確的虛構回應，未定義請求使測試失敗。fixture 依現行 cookie/session 與列表 snapshot 契約處理登入，停用 service worker。
- 每個案例使用獨立 context。固定 locale、時區、時間與資料，等待頁面內容及 document.fonts.ready，關閉動畫。字型資源須固定且載入失敗必須可見，避免默默使用不同後備字型。
- 採 Windows Chromium 作為標準截圖環境，採本地手動執行。此機無 Docker 與 WSL，因此改採可直接驗證的本機平台。字型以固定版本 @fontsource/inter 與 @fontsource/noto-sans-tc 供應，測試攔截外部字型請求。熟悉工具後再評估 CI 整合。
- 首批一般多筆資料含長中文名稱，覆蓋 320、390、600、601、768、769、1440 CSS px 與明暗主題。空資料在 390、1440 px 的雙主題覆蓋。角色、冒險、永久物品、消耗品各自建立案例，包含所在頁面的導覽。
- 使用 toHaveScreenshot 比較頁面，對工具列另截局部圖，避免長列表稀釋差異。加入水平溢出、手機排序左右貼齊可用欄位（2px 容差）、桌機排序與篩選位置及內容寬度檢查。量測選擇器依當前模板的共用 class 決定。
- 既有截圖腳本作為 fixture 與案例參考，正式測試放在 frontend 下。Storybook/Chromatic 可在元件獨立驗證需求增加後評估，目前先覆蓋完整頁面。
- 本地執行視覺測試並保留失敗報告、actual/expected/diff 與 trace。比較失敗或缺少基準時回傳非零退出碼。更新基準由明確指令產生，人工檢查差異後納入版本控制。

## Risks / Trade-offs

- 基準包含現有瑕疵的風險，以人工檢查初始畫面及獨立幾何斷言降低。
- 字型、作業系統與瀏覽器差異會造成誤報，使用固定 Chromium 與字型資源控制；升級時需重新審查差異。
- 虛構 API 可能偏離產品契約，未定義請求失敗且以頁面內容斷言防止登入頁或錯誤頁被當成正常基準。
- 覆蓋有限，新增共用版型或修復新回歸時增加對應案例。

## Migration Plan

先建立 fixtures 與本機入口，再於標準環境建立基準並連續比較兩次。暫時注入排序寬度錯誤，確認幾何斷言及截圖比較都能攔截後移除注入。完成後更新 README 與 DESIGN.md 的操作說明。撤回時移除測試檔與依賴即可。
