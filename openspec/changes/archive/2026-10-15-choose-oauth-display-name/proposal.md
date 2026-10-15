# Proposal

## Why

第三方登入目前會立即以 Google／Discord 名稱建立本站帳號，玩家無法在保存前選擇暱稱。公開分享前應讓新玩家主動決定本站名稱，並補足帳密註冊與重設流程的實際整合驗證。

## What Changes

- Google／Discord 新身分先完成驗證，顯示空白的本站暱稱表單，確認後才建立帳號並登入。
- 既有綁定身分直接登入，保留現有暱稱及第三方綁定安全規則。
- 新增短效、限定用途的註冊憑證與完成註冊 API；取消、過期、竄改及重送不建立重複帳號。
- 補足隔離 PostgreSQL 上的帳密註冊、登入、錯誤、重設信件與重設憑證生命週期驗證；補齊前端表單及 OAuth 分流測試。
- 說明第三方識別碼、Email、頭像及自選暱稱的資料用途。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `identity-access`: 第三方新玩家須先選擇暱稱；認證與註冊憑證用途隔離，並定義取消及重送行為。

## Impact

後端 OAuth／JWT／認證 DTO 與 API、前端登入／OAuth callback／共用暱稱表單、認證測試、SRS 及隱私說明。沿用 users 與 user_oauth_accounts 的交易及唯一約束，無資料庫欄位或正式資料遷移。第三方新玩家的 API 回應增加待註冊狀態，前後端須於同次發布配套更新；本次僅本機實作與驗證。
