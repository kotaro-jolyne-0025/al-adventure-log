# Proposal

## Why

資安盤點確認同 Email 自動綁定會保留未驗證帳號的密碼、重設密碼連結進入日誌、公開驗證入口缺乏限流，且目前正式資料庫沒有已確認的排程備份。這些缺口應在擴大公開使用前補齊。

## What Changes

- 停止僅依相同 Email 合併未綁定的第三方身分；保留既有 provider + subject 登入，檢查帳號啟用狀態與第三方 Email 驗證結果。
- 移除重設連結、憑證與第三方錯誤原文的日誌／回應洩漏；SMTP 未設定或寄送失敗須能被維運者辨識。
- 為公開驗證入口加入跨執行個體共用的 IP／帳號限流、429 與 Retry-After，避免前端自動重送與無效登出。
- 提供私有異地備份排程與隔離還原驗證流程；設定缺失須失敗，不產生假的成功紀錄。
- 不修改既有玩家資料表欄位；限流使用獨立作業資料表。發布、正式備份目的地與雲端設定依實際授權另行啟用。

## Capabilities

### New Capabilities
- `database-recovery`: 私有備份、保留期限、隔離還原及驗證紀錄。

### Modified Capabilities
- `identity-access`: 第三方帳號綁定邊界、憑證保密與驗證入口限流。

## Impact

後端 OAuthService、EmailService、公開驗證 Controller／限流服務及 Flyway；前端驗證錯誤呈現；作業腳本、備份 workflow、SRS、資料庫規格與安全測試。此次不處理圖片驗證、全站 CSP 或依賴升級，也不自動清除既有 OAuth 綁定或帳號密碼。
