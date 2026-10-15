# Design

## Context

現有 OAuthService 在驗證 provider 後立即建立帳號；AuthService 再簽發 JWT。Google 使用 ID Token，Discord 使用不可重複交換的授權碼。前端 Angular Material 已有對話框及表單，資料庫已有 Email 與 provider subject 唯一約束。動機見 proposal.md。

## Goals / Non-Goals

**Goals:** 把已驗證身分與本站帳號建立分成兩階段，沿用 JWT 與資料庫約束；以隔離 PostgreSQL、真實 BCrypt 及實際郵件組裝驗證帳密流程。

**Non-Goals:** 不導入 Supabase Auth、不改既有帳號暱稱、不增加 Email 驗證政策、不改角色資料並行保護、不操作正式資料或發布。

## Decisions

1. `/auth/oauth` 已綁定時維持現有 AuthResponse；未綁定時回傳 `registrationRequired: true` 及短效 `registrationToken`，不回傳登入 Token。`/auth/oauth/register` 接受該憑證與 `displayName`。AuthResponse 新增選用狀態，既有登入格式保持可讀。
2. 暫時憑證沿用 JJWT 簽章，明確標記 purpose、provider、subject、Email 及頭像，10 分鐘到期，不含第三方名稱。登入憑證驗證明確排除註冊 purpose，註冊驗證也不接受登入憑證；仍接受既有無 purpose 的登入 JWT。若重新交換 Discord code 會失敗，因此不能只在原請求附加暱稱；資料庫暫存則增加不必要的清理及 migration。
3. 共用 Material 對話框從空白暱稱開始，說明可以不使用真名；憑證只留在元件記憶體。確認送出期間避免重複點擊，失敗保留輸入，過期／已註冊提示重新登入。Google 登入及 Discord callback 共用此畫面。
4. 完成註冊時重新檢查 provider 綁定及 Email，單一交易建立 users 與 user_oauth_accounts；唯一約束處理並行競爭並轉為不含識別資料的衝突訊息。舊玩家的活躍狀態、暱稱、Email 不自動綁定規則保持。
5. 測試沿用 embedded PostgreSQL 與 MyBatis／Spring 交易，採合成資料及測試用金鑰；不載入會連正式資料庫的 local profile。郵件驗證使用本機測試收件方式，不送至外部玩家。

## Risks / Trade-offs

- [前後端部署存在時間差] → 同次發布配套更新；舊前端面對待註冊回應無法完成註冊，但後端不會誤建帳號。發布前核對部署結果。
- [短效憑證可重送] → 資料庫唯一約束及交易確保單一帳號；完成後拒絕重送，不回傳既有帳號登入憑證。
- [頁面重新整理會中斷新玩家註冊] → 明確返回登入，避免把身分憑證寫入持久儲存。
- [郵件測試與正式送達不同] → 區分本機 SMTP／內容驗證與正式供應商送達；本次不聲稱已測試正式信箱投遞。

## Migration Plan

無 schema 變更或資料回填。後續依 VERSIONING.md 另行授權配套發布前後端；回退應配套回退，不移動已發布 Tag。本次所有驗證維持隔離環境。
