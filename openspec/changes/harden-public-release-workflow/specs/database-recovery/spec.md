# Database Recovery Spec Delta

## ADDED Requirements

### Requirement: Recovery evidence freshness
維運者 SHALL 在每次發布時核對最近備份與隔離還原的時效。最近成功備份 SHALL 不超過 24 小時，且最近 30 天 SHALL 至少有一次成功的隔離還原紀錄；缺漏、過期或失敗時 MUST 標示復原能力未確認，不得僅依排程設定或歷史首次成功宣稱目前可復原。備份與還原仍沿用既有私有存放、最小權限及隔離要求。

#### Scenario: 備份已過期
- **WHEN** 發布檢查發現最近可用備份超過 24 小時
- **THEN** 先完成新備份並確認結果；完成前不得通過發布的復原就緒檢查

#### Scenario: 定期隔離還原
- **WHEN** 定期排程或維運者執行還原檢查
- **THEN** 選用可辨識且未過期的私有備份，確認 schema、migration 狀態與資料表可讀，記錄物件與結果的對應關係，不輸出玩家欄位

### Requirement: Recovery readiness for database changes
包含 migration、資料轉換或高風險資源修正的發布 SHALL 在正式變更前產生一份變更前備份，並成功對同一份備份完成隔離還原檢查。候選 migration SHALL 在隔離環境通過全新建庫與上一個已發布 migration 邊界的升級驗證。復原說明 SHALL 包含前版程式、資料相容性、復原點及可能受影響的變更範圍；正式還原、停止寫入或資料丟失取捨需另行具體授權。

#### Scenario: migration 發布準備完成
- **WHEN** 變更前備份、同物件還原、合成資料升級與相容性驗證皆成功
- **THEN** 可進入已授權的正式部署，保留不含機密及玩家內容的驗證依據

#### Scenario: 升級或同物件還原失敗
- **WHEN** 任一前置驗證失敗或沒有對應的還原證據
- **THEN** 停在正式變更之前，不修改正式 DB、修補既有 migration 或自動執行 Flyway repair／clean
