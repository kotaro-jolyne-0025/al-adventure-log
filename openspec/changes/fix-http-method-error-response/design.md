# Design

## Context

見 proposal.md 的 Why。GlobalExceptionHandler.handleGeneral 捕捉 Exception 並寫 ERROR、回傳 500，攔截了原可分類為 405 的 HttpRequestMethodNotSupportedException。AuthController 的 login 與 renew 均宣告 PostMapping，前端 AuthService 也以 POST 呼叫。SecurityConfig 與各 filter 在 MVC 之前執行，不能為了方法判定改變其順序。

現有 GlobalExceptionHandlerTest 使用 OutputCaptureExtension 檢查敏感值；AuthControllerTest 已用 standalone MockMvc 裝載真實 Controller 與全域 advice，適合驗證路由解析實際選到專用 handler。SRS §3.6 是既有 JSON 格式依據。

## Goals / Non-Goals

**Goals:** 在共用 advice 一次修正所有抵達 MVC 的方法不支援例外，維持既有回應格式與安全檢查順序。

**Non-Goals:** 不擴大至所有框架例外的重構、不新增 GET 寫入路由、不調整前端／PWA、不修改雲端告警或將舊事件標成結案。

## Decisions

1. 新增精確的 @ExceptionHandler(HttpRequestMethodNotSupportedException.class)，重用 buildBody 建立 405 JSON。由 ex.getHeaders() 保留 Spring 提供的 Allow，而非寫死 POST，因為 advice 也服務其他 Controller。保留一般 Exception handler 處理未知錯誤。改成 ResponseEntityExceptionHandler 會牽動多種既有錯誤格式，本次不採用。
2. message 固定為「此 HTTP 方法不受支援」，path 使用 getRequestURI()，不帶 query string、不回傳例外 message。此預期拒絕不另寫應用日誌，以既有 HTTP request log 觀測 405；避免新增敏感資訊與高頻噪音。保留未知例外的 ERROR 記錄，不透過 Cloud Logging 排除規則隱藏事件。
3. 不調整 filter、permitAll 或 Controller mapping。405 僅適用於已抵達 MVC 的請求；安全鏈先拒絕的請求依既有規則回應。認證端點現有 Cache-Control: no-store 應在完整安全鏈驗證中保留。
4. 用既有測試位置驗證 handler 選擇與業務無副作用；不需資料庫 migration、新依賴或前端修改。採單一 Agent 執行，因處理器、測試與規格是同一小型且高度相依的修正。

## Risks / Trade-offs

- [錯誤用戶端仍會送 GET] → 405 修正分類，不宣稱已排除 GET 發送來源；必要時另案用瀏覽器 Network 的 initiator 與前端版本定位，不先假設舊 PWA。
- [通用 advice 影響其他 API] → 測試框架提供的多方法 Allow，以及未知例外仍走 500；不重構其他 handler。
- [僅直接呼叫 handler 的測試漏掉解析錯誤] → 必須包含 MockMvc 對實際 login／renew 路由的 GET 回歸。
- [歷史 Error Reporting 群組仍存在] → 正式驗收以部署後新請求的狀態與新日誌判定，不以歷史群組消失作為完成條件。

## Migration Plan

實作完成並通過針對性測試後，同步 http-api-errors 主規格與 SRS §3.6。發布時依 VERSIONING.md 及使用者發布授權由 CI/CD 進行；本 change 的實作不自動包含 commit、push 或部署。若後續發布，核對新修訂的正常認證與 405 請求紀錄；需要復原時依發布流程回退程式版本，不涉及資料復原。正式驗收不刻意以錯誤方法呼叫具有破壞副作用的業務端點。
