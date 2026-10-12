# identity-access Specification

## Purpose

定義玩家建立帳號、登入、重設密碼與存取個人角色資料的可觀察行為，確保不同玩家的冒險資料具有清楚的所有權邊界，作為後續驗收與規格討論的共同基準。

## Requirements

### Requirement: Email registration
系統 SHALL 接受 Email、至少 8 字元密碼及顯示名稱註冊；重複 Email SHALL 回報友善錯誤。註冊成功 SHALL 自動登入並前往角色列表。密碼 MUST 以不可逆雜湊儲存。

#### Scenario: 新玩家成功註冊
- **WHEN** 玩家提交未使用的 Email、符合長度的密碼及顯示名稱
- **THEN** 系統建立帳號、取得登入憑證並顯示角色列表

#### Scenario: 重複 Email
- **WHEN** 玩家以已註冊的 Email 再次註冊
- **THEN** 系統拒絕建立重複帳號並提供可理解的提示

### Requirement: Password login
系統 SHALL 支援 Email 與密碼登入；帳號不存在或密碼錯誤 SHALL 使用相同的「帳號或密碼錯誤」提示。

#### Scenario: 密碼不符
- **WHEN** 玩家送出的密碼不符合帳號
- **THEN** 系統不發放登入憑證並顯示共用錯誤提示

### Requirement: Password reset lifecycle
系統 SHALL 提供忘記密碼申請、15 分鐘效期的重設連結與至少 8 字元的新密碼設定；已使用或過期憑證 MUST NOT 再次重設密碼。成功後 SHALL 引導重新登入。

#### Scenario: 重設成功後重用連結
- **WHEN** 玩家已透過某連結成功重設，又以同一憑證再次送出
- **THEN** 系統拒絕再次重設且保留已設定的新密碼

#### Scenario: 連結已過期
- **WHEN** 玩家使用超過 15 分鐘效期的重設憑證
- **THEN** 系統提示重新申請且不變更密碼

### Requirement: Owner scoped access
系統 SHALL 要求受保護資料請求具有效身分憑證，並驗證角色及其冒險、物品、活動、故事獎勵屬於當前玩家。未登入的受保護頁面 SHALL 導向登入頁。

#### Scenario: 跨玩家存取
- **WHEN** 玩家 A 以玩家 B 的角色或子資源 ID 嘗試讀取、修改或刪除
- **THEN** 系統以 403 或 404 拒絕，不回傳 B 的資料且不產生變更

### Requirement: Editable display name
系統 SHALL 允許登入玩家修改顯示名稱；成功後導覽列 SHALL 呈現更新名稱。

#### Scenario: 更新暱稱
- **WHEN** 玩家成功儲存新的顯示名稱
- **THEN** 導覽列顯示新名稱且重新登入後仍可取得该名稱

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
