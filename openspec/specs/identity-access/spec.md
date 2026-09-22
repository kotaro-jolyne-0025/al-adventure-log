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
