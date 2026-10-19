# Design

## Context

JWT 目前只驗簽及到期時間，重設密碼由既有交易更新 users 並消耗重設憑證。前端已在 API 401 時登出。共用 updatePassword 也由 Google 登入清除舊密碼的流程呼叫。

## Goals / Non-Goals

**Goals:** 密碼更新成功提交後拒絕舊登入，跨執行個體一致；失敗交易不改變登入有效性；保留正常登入與既有憑證相容性。

**Non-Goals:** 不改 Cookie、Token 有效期、前端畫面或雲端設定；不增加外部依賴。

## Decisions

- users 新增 token_version BIGINT NOT NULL DEFAULT 0，新增 V30 migration，不修改歷史 migration。共用密碼 UPDATE 同時原子遞增版本；Google 清除密碼後重新讀取帳號再簽發新 JWT，避免使用更新前版本。
- JWT 簽發必須傳入帳號目前版本，認證 filter 驗簽後用主鍵查詢確認帳號啟用且版本相同，不讀取密碼雜湊、不使用快取。單純縮短 JWT 時效無法達成立即撤銷；按帳號版本不需要逐 Token 黑名單。
- 舊 JWT 缺少版本時視為 0，僅在帳號仍為版本 0 時通過；非法型別／負數版本拒絕。註冊 proof 仍不能認證。
- 密碼、版本及重設憑證消耗留在原有交易；拒絕或回滾不撤銷原登入。已完成認證的進行中請求不追溯取消。

## Risks / Trade-offs

- 每個帶 JWT 的請求增加一次主鍵查詢，換取跨執行個體即時撤銷；資料庫錯誤回傳 503 且不得放行認證，避免暫時失敗被當成 401 觸發前端登出。
- 部署需先套用新 migration；舊程式回退不再檢查撤銷狀態，修正生效後不可把回退視為安全等價。舊程式不受新增欄位影響。
- 純離線裝置直到下一次線上 API 回應才得知撤銷，既有離線副本與草稿規則不變。

## Migration Plan

以既有 CI/CD 部署並由 Flyway 套用 V30；本次只在隔離 PostgreSQL 驗證 migration 與認證流程，不執行正式部署。新增欄位可保留，不透過刪欄位回退。
