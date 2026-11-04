# Proposal

## Why

對 POST 認證端點送出 GET 時，Spring MVC 的方法不支援例外被全域通用處理器轉成 500，讓呼叫端及維運記錄誤認為伺服器故障。需要保留正確的 405 語意與既有錯誤 JSON，讓真正的伺服器例外繼續受到監控。

## What Changes

- 在共用例外處理器處理 HTTP 方法不支援，回傳 405 與框架提供的 Allow header。
- 沿用 timestamp、status、error、message、path 格式；此類預期拒絕不寫 ERROR 堆疊，不記錄請求本體、查詢參數或憑證。
- 以登入及續期路由驗證 GET 被拒絕且沒有業務副作用，保留合法 POST 及既有安全拒絕流程。
- 補充 SRS 統一錯誤格式規則及對應 OpenSpec 規格。

## Capabilities

### New Capabilities
- `http-api-errors`: 定義抵達 MVC 路由判定後的方法不支援回應與記錄行為。

### Modified Capabilities
無；認證與安全規格繼續適用。

## Impact

- 實作目標：backend 的 GlobalExceptionHandler；重用既有回應組裝方法。
- 驗證目標：GlobalExceptionHandlerTest、AuthControllerTest，及既有 AuthFlowIntegrationTest 的認證／CSRF 回歸。
- 文件目標：system-requirements-spec.md §3.6 與 http-api-errors 主規格（實作完成後同步）。
- 不新增依賴、資料庫變更、GET 登入／續期能力或前端更新機制。GET 發送來源仍未確認，不能將舊 PWA、外部探測或特定瀏覽器認定為根因；追查來源不作為此修正的完成條件。
