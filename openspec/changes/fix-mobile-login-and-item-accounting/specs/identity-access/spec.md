## ADDED Requirements

### Requirement: Mobile Google account interactions
系統 SHALL 支援手機 Google 登入，點擊登入帳號或網站帳號資訊 MUST NOT 意外開啟寄信畫面。網站帳號 Email SHALL 為資訊文字；正式聯絡入口 SHALL 維持既有用途。登入失敗 SHALL 保留在可恢復的登入流程並顯示說明。

#### Scenario: 點選 Google 帳號登入
- **WHEN** 玩家在 S26 Ultra 三星瀏覽器的 Google 帳號選擇畫面點擊自己的帳號並授權成功
- **THEN** 系統完成登入並前往合法目的頁，不開啟寄信畫面

#### Scenario: 點擊網站帳號資訊
- **WHEN** 已登入玩家在手機打開帳號選單並點擊其 Email 資訊
- **THEN** Email 不啟動寄信，其他選單操作維持可用

### Requirement: Daily background account confirmation
系統 SHALL 在啟動及受保護頁面導航時，以本機登入資料決定是否需要背景確認帳號；已有帳號的自動 `/auth/me` 確認 SHALL 每 24 小時至多一次，重開頁面 SHALL 共用本機檢查紀錄。登入成功 SHALL 視為已確認，登出 SHALL 清除紀錄。沒有快取使用者或檢查紀錄無效 SHALL 立即確認。暫時網路或伺服器失敗 SHALL 保留已有登入資料並沿用此次檢查時間。實際登入／登出、本機 JWT 過期判斷及 API 401 處理 MUST NOT 等待每日確認；後端 SHALL 維持每個受保護請求的憑證及所有權驗證。帳號切換及登出 SHALL 取消舊帳號的確認與個人資料更新請求，不讓晚到回應恢復或覆寫目前帳號。

#### Scenario: 同日重開及切換頁面
- **WHEN** 同一帳號在上次確認後未滿 24 小時重新開啟或切換受保護頁面
- **THEN** 使用本機帳號資料，不重複呼叫背景確認

#### Scenario: 超過一天
- **WHEN** 上次確認滿 24 小時後玩家重新開啟或前往受保護頁面
- **THEN** 進行一次背景確認，連續導航不重複送出請求

#### Scenario: 暫時離線
- **WHEN** 已有快取帳號的背景確認因網路或 5xx 失敗
- **THEN** 保留登入及輸入，同日重開不反覆送出確認；其他資料請求維持既有錯誤處理

#### Scenario: 即時登出及失效
- **WHEN** 玩家登出、Token 過期或受保護 API 回傳 401
- **THEN** 立即清除登入與相關快取，不等到下一日

#### Scenario: 舊帳號回應
- **WHEN** 玩家在背景確認或個人資料更新完成前登出或登入另一帳號
- **THEN** 取消舊請求，舊資料不覆寫新帳號也不恢復登入

### Requirement: OAuth authentication resource protection
系統 SHALL 在執行第三方服務請求及簽章驗證前限制 OAuth 請求頻率與憑證大小。第三方網路驗證 MUST 在資料庫交易之外完成；身分解析後的資料庫查詢與變更 SHALL 在短交易內完成。Google 簽章公鑰快取 SHALL 遵從 Google 回應的 `Cache-Control` 時效。

#### Scenario: 超過 OAuth 來源限制
- **WHEN** 同一來源在限流窗口內超過 OAuth 嘗試上限
- **THEN** 系統回傳 429 與 `Retry-After`，且不呼叫第三方驗證或存取帳號資料

#### Scenario: 過大 OAuth 憑證
- **WHEN** OAuth provider、憑證或 redirect URI 超過允許長度
- **THEN** 系統在第三方請求與簽章驗證前拒絕請求

#### Scenario: OAuth 本體超過位元組限制
- **WHEN** 第三方登入或註冊請求本體超過 64 KiB，包含沒有 Content-Length 的請求
- **THEN** 系統在 JSON 解析前以有界讀取拒絕請求並回傳 413，不執行來源限流查詢、第三方驗證或帳號寫入；原有欄位長度限制仍適用

#### Scenario: 第三方驗證期間資料庫連線
- **WHEN** Google 公鑰或 Discord OAuth 回應延遲
- **THEN** 系統在該外部等待期間不持有資料庫交易或連線；驗證成功後的帳號讀寫仍具原子性

#### Scenario: Google 公鑰快取更新
- **WHEN** Google 公鑰回應的快取時效到期
- **THEN** 系統依 Google 回應的快取政策更新公鑰後再驗證 ID token

### Requirement: Google-bound accounts cannot reset local passwords
系統 SHALL 不允許有 Google 身分綁定的帳號透過忘記密碼、重設連結驗證或密碼重設建立本機密碼。即使相關重設憑證在 Google 登入清除本機密碼前核發，使用時仍 MUST 重新檢查帳號的 Google 綁定狀態。忘記密碼回應 MUST 維持不揭露 Email 是否存在。

#### Scenario: Google 綁定帳號申請重設
- **WHEN** Google 綁定帳號要求忘記密碼或驗證重設連結
- **THEN** 系統不寄送或接受本機密碼重設，且外部回應不揭露帳號存在狀態

#### Scenario: Google 登入前已核發的重設連結
- **WHEN** 帳號在重設連結核發後以 Google 登入，之後使用該連結
- **THEN** 系統拒絕重設且不寫入本機密碼
