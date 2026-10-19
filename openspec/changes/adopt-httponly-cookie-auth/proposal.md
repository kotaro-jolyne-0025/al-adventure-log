# Proposal

## Why

目前本站 JWT 由前端持久保存在 localStorage，頁面內執行的惡意腳本可能竊取並在其他裝置重用；同時後端全域停用 CSRF，已出現 CodeQL `java/spring-disabled-csrf-protection` 告警。改由瀏覽器保存 HttpOnly Cookie，並為所有會改變狀態的 API 啟用 CSRF 驗證，降低憑證外洩風險並實際消除告警所指的設定。

## What Changes

- **BREAKING**：本站登入 JWT 只以 HttpOnly Cookie 交換，不再從 JSON 回應或 Authorization Bearer 傳遞；舊版 localStorage JWT 不轉換，更新後須重新登入一次。
- 正式登入 Cookie 使用 Firebase Hosting 唯一允許轉送的 `__session`，維持 HttpOnly、Secure、SameSite=Lax、Path=/ 與 host-only；本機開發以明確 dev 設定及同來源 `/api` proxy 運作。
- 啟用 Spring Security CSRF 防護，使用有簽章、期限及登入綁定的 CSRF token；前端從可讀 Cookie 取得 token 後送進 header，後端不依賴 Firebase 會移除的第二顆 Cookie。
- 提供 CSRF 初始化與伺服器登出端點；認證回應只傳回使用者及非憑證的登入識別／到期資訊。
- 以登入中繼資料保留重新整理後登入、前景十分鐘節流續期、預設兩小時效期及每日背景確認；維持重設密碼撤銷與帳號停用查核。
- 保護 Cookie 更新順序、跨分頁同步及讀寫的原登入歸屬，避免晚到的 Set-Cookie 或 401 影響新登入；保留現有草稿及副本隔離。
- 評估 Service Worker 保管 JWT 的替代方案，決定沿用現有 Angular Worker 的資源快取／更新用途，登入不依賴 Worker 記憶體或生命週期。

## Capabilities

### New Capabilities

無；沿用既有登入能力。

### Modified Capabilities

- `identity-access`：Cookie 認證與 CSRF、登入中繼資料及恢復、伺服器登出、Cookie 競態隔離與舊版憑證切換。

## Impact

- 後端：`SecurityConfig`、`JwtAuthenticationFilter`、`JwtTokenProvider`、`UserPrincipal`、`AuthController`、`AuthService`、認證 DTO 與 Cookie 設定；保留 BCrypt、既有 token_version 查核及所有權驗證，不新增資料庫表或 migration。
- API：新增 `GET /api/auth/csrf` 與 `POST /api/auth/logout`；調整 login/register/oauth/oauth-register、renew、GET me 的回應；保護資料請求加入非憑證的登入識別前置條件。
- 前端：`AuthService`、認證 interceptor、guard、認證 models、登出呼叫端、登入／OAuth fixtures；Angular XSRF 設定、dev API URL 與 proxy。
- 相容與交付：既有 PWA／離線副本／草稿需回歸；舊快取前端需更新後重新登入。保留其他工作已加入的 `Content-Disposition` CORS 暴露設定。
- 文件：實作時同步 `system-requirements-spec.md` 與主規格中已改變的登入契約；CI/CD 與 CodeQL 驗證列入待辦，本次只產生規劃文件。
