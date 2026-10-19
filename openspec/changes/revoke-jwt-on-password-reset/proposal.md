# Proposal

## Why

成功重設密碼後，已簽發 JWT 仍可存取 API 直到過期，無法中斷持有舊憑證的工作階段。密碼復原必須同時撤銷舊登入。

## What Changes

- 密碼變更與登入版本遞增在同一資料庫交易完成。
- 新 JWT 帶入登入版本，後端逐請求核對目前版本與帳號狀態。
- 缺少版本的既有 JWT 僅相容尚未變更密碼的版本 0 帳號。
- 驗證重設後舊 JWT 回傳 401、新密碼登入正常、其他玩家不受影響及交易失敗不撤銷登入。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `identity-access`: 密碼復原撤銷既有登入，受保護請求檢查當前登入版本。

## Impact

後端 User／UserMapper、JWT 簽發與認證 filter、AuthService、共用密碼寫入呼叫端及隔離測試；新增 Flyway migration，更新既有需求與 schema 文件。前端沿用既有 401 登出處理；不調整 Token 儲存方式，不操作雲端設定。
