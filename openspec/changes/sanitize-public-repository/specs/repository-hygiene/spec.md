## Purpose

規範公開版本庫中的憑證、個人資料與初始化帳號處理，使新部署沒有可由公開內容推導的預設密碼，並確保清理不會損害既有玩家資料或掩蓋尚未完成的事件處理工作。

## ADDED Requirements

### Requirement: Safe public bootstrap and documentation
公開文件與初始化資料 MUST NOT 包含實際個人登入密碼或密碼雜湊；文件 SHALL 使用相對連結。公開 Client ID、環境變數名稱與架構可保留。

#### Scenario: New database
- **WHEN** 全新資料庫執行 migrations
- **THEN** migrations MUST NOT 建立預設或占位使用者，帳號由註冊或 OAuth 登入建立；測試帳號只由測試 fixture 建立

#### Scenario: Existing OAuth user
- **WHEN** 既有玩家曾使用預設帳號並綁定 Google 登入
- **THEN** 本次維護 MUST NOT 刪除、停用或改寫該帳號、OAuth 綁定與玩家資料
- **AND** 內部維運程序說明 Google 密碼與本網站本機密碼彼此獨立

### Requirement: Controlled historical migration cleanup
清理已部署 migration SHALL 由不在公開版本庫中的內部維運程序處理，MUST NOT 重跑初始化或修改既有玩家資料；公開版本庫 MUST NOT 包含維運腳本或 checksum 細節。

#### Scenario: Unknown checksum
- **WHEN** V3 checksum 不符合已核對值
- **THEN** 修復中止，不修改未知歷史

#### Scenario: History still contains exposed data
- **WHEN** 目前檔案已清理但正式密碼或 Git 歷史尚未處理
- **THEN** 交付紀錄明示尚未完成的工作
