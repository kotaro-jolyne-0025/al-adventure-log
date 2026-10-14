## MODIFIED Requirements

### Requirement: Password reset lifecycle
系統 SHALL 提供忘記密碼申請、15 分鐘效期的重設連結與至少 8 字元的新密碼設定；已使用或過期憑證 MUST NOT 再次重設密碼。成功後 SHALL 引導重新登入。忘記密碼回應 MUST NOT 揭露 Email 是否存在。密碼重設憑證及完整重設 URL MUST NOT 寫入應用程式日誌或錯誤回應。

#### Scenario: 忘記密碼申請不揭露帳號
- **WHEN** Email 存在或不存在的玩家提出忘記密碼申請
- **THEN** 系統回傳相同的一般成功訊息

#### Scenario: 重設成功後重用連結
- **WHEN** 玩家已透過某連結成功重設，又以同一憑證再次送出
- **THEN** 系統拒絕再次重設且保留已設定的新密碼

#### Scenario: 連結已過期
- **WHEN** 玩家使用超過 15 分鐘效期的重設憑證
- **THEN** 系統提示重新申請且不變更密碼

#### Scenario: 寄信設定缺失或失敗
- **WHEN** 玩家要求重設密碼但 SMTP 未設定或寄送失敗
- **THEN** 系統不把憑證、連結或 Email 寫入日誌或錯誤回應，維運端留下不含個資及憑證的送達狀態

#### Scenario: 郵件未設定
- **WHEN** 玩家要求重設密碼但 SMTP 未設定或寄送失敗
- **THEN** 系統不把憑證寫入日誌或回應，維運端留下不含個人資料與憑證的送達狀態

## ADDED Requirements

### Requirement: Third-party identity binding
系統 SHALL 只以已驗證的第三方身分及 provider subject 登入已綁定帳號。第三方身分尚未綁定時，系統 MUST NOT 僅因 Email 相同而自動綁定既有密碼帳號；SHALL 提示使用者以既有方式登入。使用已驗證 Google Email 登入相符帳號時，系統 SHALL 停用未經該登入流程證明的既有密碼憑證。第三方回傳 Email 時，系統 SHALL 驗證該 Email 已由 provider 驗證；帳號停用時 MUST 拒絕登入。

#### Scenario: 未綁定 Google Email 撞到既有密碼帳號
- **WHEN** 玩家以 Email 已由 Google 驗證的身分登入，該 Email 已有密碼帳號但沒有綁定此 Google subject
- **THEN** 系統不建立綁定、不簽發登入憑證，並提示使用既有登入方式

#### Scenario: 已綁定 Google 帳號仍存有密碼
- **WHEN** 玩家以已綁定的 Google subject 登入，帳號同時仍有密碼憑證
- **THEN** 系統清除該密碼憑證並完成 Google 登入

#### Scenario: 已停用帳號使用第三方登入
- **WHEN** 已驗證的第三方 subject 綁定至停用帳號
- **THEN** 系統拒絕登入且不發放 JWT

#### Scenario: 第三方 Email 尚未驗證
- **WHEN** provider 回傳 Email 但未標示該 Email 已驗證
- **THEN** 系統拒絕使用該 Email 登入或建立帳號

### Requirement: Public authentication endpoint throttling
系統 SHALL 對登入、註冊及忘記密碼請求套用跨服務執行個體共用的頻率限制。超過限制時 SHALL 回傳 429 及 Retry-After，且不執行認證、建立帳號或寄送郵件。限制狀態 MUST 使用不可逆的識別鍵，不得儲存明文 Email 或完整 IP。

#### Scenario: 短時間重複登入失敗
- **WHEN** 同一來源對同一帳號超過登入嘗試上限
- **THEN** 系統在冷卻時間內回傳 429 與 Retry-After 並停止驗證密碼

#### Scenario: 多服務執行個體共用限制
- **WHEN** 請求分別抵達不同後端執行個體但使用相同限制識別
- **THEN** 兩個執行個體共用同一配額，不因切換執行個體重新取得額度

#### Scenario: 忘記密碼寄信受到限制
- **WHEN** 同一目標或來源超過密碼重設申請上限
- **THEN** 系統回傳不揭露帳號存在狀態的限流結果，且不再產生或寄出新憑證
