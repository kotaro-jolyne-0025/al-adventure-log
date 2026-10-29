# http-api-errors Specification

## Purpose

定義 HTTP API 在路由存在但請求方法不受支援時的回應及維運記錄契約，讓呼叫端能辨識請求錯誤，避免將預期拒絕誤判為伺服器故障，同時保留認證、CSRF 與真正未預期例外的既有保護。

## Requirements

### Requirement: Unsupported HTTP method response
當請求通過前置安全檢查並抵達 API 路由判定，且路徑存在但 HTTP 方法不支援時，系統 SHALL 回傳 405 Method Not Allowed，並以 Allow header 列出路由支援的方法（路由有提供時）。JSON SHALL 沿用 timestamp、status、error、message、path，status 為 405、error 為 Method Not Allowed，message 使用不含請求值的固定說明，path 僅含路徑。系統 MUST NOT 執行該端點的業務操作或為此設定登入 Cookie。

#### Scenario: GET 登入
- **WHEN** 對僅支援 POST 的 /api/auth/login 送出 GET 並抵達路由判定
- **THEN** 回傳 405、Allow 包含 POST 及既有格式的 JSON，不執行密碼驗證或發放登入 Cookie

#### Scenario: GET 續期
- **WHEN** 對僅支援 POST 的 /api/auth/renew 送出 GET 並抵達路由判定
- **THEN** 回傳 405、Allow 包含 POST，不執行續期或延長登入

#### Scenario: 前置安全檢查拒絕
- **WHEN** 請求因認證、CSRF 或登入歸屬檢查在路由判定前被拒絕
- **THEN** 保留既有 401、403 或 409 行為，不以 405 覆寫安全拒絕

### Requirement: Expected method rejection logging
系統 MUST NOT 為方法不支援的預期拒絕寫入 ERROR 級別的應用程式例外堆疊。若留下應用日誌，SHALL 僅使用固定說明與必要的請求方法，不包含 query string、請求本體、Cookie、Token 或私人識別資料。未預期伺服器例外 SHALL 繼續回傳既有 500 JSON 並保留 ERROR 記錄。

#### Scenario: 方法不支援且請求帶敏感值
- **WHEN** 方法不支援的請求帶有查詢參數或本體內容
- **THEN** 405 回應及新增應用日誌不暴露這些值，且不產生此例外的 ERROR 堆疊

#### Scenario: 真正未預期例外
- **WHEN** 業務處理發生不屬於既有已知分類的未預期例外
- **THEN** 繼續回傳 500 與一般錯誤訊息並留下 ERROR 記錄
