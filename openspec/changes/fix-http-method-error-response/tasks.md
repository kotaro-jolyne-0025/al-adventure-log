# Tasks

## 1. 共用 HTTP 方法錯誤回應

- [x] 1.1 在 GlobalExceptionHandler 新增 HttpRequestMethodNotSupportedException 專用 handler，重用既有 JSON body、固定訊息及 request URI，保留例外提供的 Allow header；透過 GlobalExceptionHandlerTest 確認 405、JSON 欄位與多個支援方法不被寫死成 POST。
- [x] 1.2 針對新增 handler 驗證帶合成敏感 query／本體值時，回應與日誌不暴露值且不寫 ERROR 堆疊；並在 GlobalExceptionHandlerTest 驗證未知例外仍回 500 並記錄 ERROR。

## 2. 路由及安全回歸

- [x] 2.1 在 AuthControllerTest 使用既有 MockMvc 與真實 advice，覆蓋 GET /api/auth/login 與 GET /api/auth/renew；驗證 405、Allow 包含 POST、沒有登入 Set-Cookie，且 AuthService 與業務限流服務無互動。
- [x] 2.2 執行既有 AuthControllerTest 與 AuthFlowIntegrationTest，保留有效 POST 登入／續期及 401、403、409 的既有覆蓋；在完整安全鏈補足 GET 方法錯誤回應的 Cache-Control: no-store 斷言。由 backend 執行 ./mvnw.cmd -Dtest=GlobalExceptionHandlerTest,AuthControllerTest,AuthFlowIntegrationTest test（PowerShell 以單一字串傳入 -Dtest 參數），確認針對性測試全部通過，測試使用既有隔離資料設定。

## 3. 規格及交付

- [x] 3.1 將本 change 的 http-api-errors delta 同步至主規格，並補充 SRS §3.6 的 405、Allow 與記錄規則；以 openspec validate fix-http-method-error-response --strict 及文件差異檢查確認一致。
- [x] 3.2 彙整實作差異、測試結果及未確認的 GET 發送來源；確認差異僅含例外處理、必要測試與文件，不夾帶前端、安全設定、正式操作紀錄或憑證。正式部署後的觀察需在後續發布授權下執行，不宣稱本機測試等於正式驗收。
