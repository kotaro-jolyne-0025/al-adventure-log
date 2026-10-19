# Proposal

## Why

目前 JWT 固定兩小時到期，即使玩家持續填表或瀏覽也必須重新登入。需要依玩家操作延長登入，同時保留密碼重設後立即撤銷的保護。

## What Changes

- 前景點擊、輸入或捲動觸發續期，每十分鐘最多一次，成功後重新取得兩小時有效期。
- 過期、撤銷、停用及匿名請求不能續期；背景確認、閒置與離線不自行續期。
- 同一登入的 Token 更新不清除快取、草稿或取消進行中請求；登出及重新登入後拒絕舊回應。
- 帳號背景確認保留每 24 小時至多一次，安全檢查仍由每個後端請求執行。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `identity-access`: 操作觸發的登入續期及跨分頁登入一致性。

## Impact

JWT 簽發、認證 API、前端 AuthService／interceptor 與認證測試、SRS 及 identity-access 規格；沿用既有 token_version，沒有新 migration 或外部依賴，不修改雲端。
