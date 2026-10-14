## Purpose

定義正式玩家資料庫備份的私有存放、保留與隔離還原檢查，讓維運者能證明玩家資料有可用的復原來源，而不以正式資料庫進行還原演練。

## ADDED Requirements

### Requirement: Private off-site database backups
系統 SHALL 可透過受保護的自動工作流程定期匯出正式 PostgreSQL 資料，並保存至非公開、加密傳輸與靜態加密的異地儲存。備份存取 SHALL 遵循最小權限，並依設定的有限保留期限刪除過期備份。目的地或認證未設定時工作流程 MUST 失敗，不得回報備份成功。

備份範圍 SHALL 為本應用程式的 `public` schema；Supabase 平台管理的其他 schema 不在此流程範圍內。資料庫連線 SHALL 使用備份專用帳號，透過受分支限制的 GitHub environment Secret 提供；Google Cloud 存取 SHALL 使用 OIDC 短期憑證。

#### Scenario: 排程備份成功
- **WHEN** 排程執行且正式資料庫及私有異地目的地可用
- **THEN** 工作流程產生加密傳輸的資料庫備份、確認檔案非空並寫入有限保留的私有儲存

#### Scenario: 備份設定缺失
- **WHEN** 私有儲存目的地或連線認證未設定
- **THEN** 工作流程失敗並留下不含密鑰的錯誤訊息，不產生成功紀錄

### Requirement: Isolated restore verification
系統 SHALL 支援將備份還原至暫時隔離的 PostgreSQL 執行環境，驗證資料庫可開啟、必要 schema 存在且資料列數檢查成功。驗證 MUST NOT 覆蓋正式資料庫，暫時環境 SHALL 在工作流程結束時銷毀。

#### Scenario: 還原演練成功
- **WHEN** 維運者對一個私有備份執行隔離還原檢查
- **THEN** 工作流程驗證 schema 與資料表可讀，回報結果且不輸出玩家欄位內容

#### Scenario: 還原驗證失敗
- **WHEN** 備份損毀、無法還原或必要表缺失
- **THEN** 工作流程失敗、回報檢查階段且不觸碰正式資料庫

### Requirement: Backup activation evidence
維運者 SHALL 在私有目的地與身分權限設定完成、至少一次備份及同一份備份的隔離還原均成功，且排程工作流程已啟用後，才回報備份已啟用。驗證紀錄 MUST NOT 包含憑證或玩家資料內容。

#### Scenario: 首次啟用驗證完成
- **WHEN** 首次備份物件非空且隔離還原及資料表讀取檢查成功
- **THEN** 維運者記錄工作流程結果、確認排程啟用，並可回報備份已啟用

#### Scenario: 只有設定尚未驗證
- **WHEN** 目的地與連線設定已填妥，但備份或隔離還原尚未成功
- **THEN** 維運者回報待驗證，不宣稱已有可用的復原來源
