## ADDED Requirements

### Requirement: Atomic timestamp preconditions for mutations

角色、冒險、倉庫更新／刪除與冒險子項目異動 SHALL 在同一交易檢查原始 updated_at 並進行寫入。新冒險 SHALL 檢查讀取預設值時的角色時間戳；無標記 MUST 拒絕，舊標記 MUST 回傳 409。同角色資源異動 SHALL 使用共同的短暫寫入鎖及全包回滾。所有異動 MUST 推進既有時間戳，不新增版本欄位。

#### Scenario: 兩視窗同時儲存
- **WHEN** A 與 B 讀取同一標記，A 先成功修改，B 再保存或刪除
- **THEN** B 收到 409，主紀錄、子項目、庫存及角色總數不受 B 的請求影響

#### Scenario: 子項目改變及缺漏標記
- **WHEN** 其他視窗修改故事獎勵、休整期或物品，或客戶端不提供時間戳
- **THEN** 父冒險標記推進，舊整包編輯被拒絕；缺漏標記不得略過檢查

#### Scenario: 同交易多次更新及時鐘回退
- **WHEN** 同一交易多次更新同一資料，或目前時間早於資料的既有 updated_at
- **THEN** 應用 SQL 與既有資料庫觸發器都使每次更新至少推進一微秒，舊標記不能重新被接受

#### Scenario: 整包儲存中途失敗
- **WHEN** 主紀錄更新後，子項目或資源處理失敗
- **THEN** 主紀錄、子項目、倉庫、角色總數及所有時間戳一併回滾，原標記仍可用於修正後重試

### Requirement: Consistent editing snapshots and conflict recovery

完整冒險內容與其 updated_at SHALL 從同一一致讀取快照取得。前端 MUST 保存原始字串並隨草稿保留，不以 Date 轉換；衝突及舊草稿缺漏標記時 MUST 保留輸入／草稿，提供查看新版，不能自動重送舊內容搭配新標記。

#### Scenario: 讀取同時有子項目異動
- **WHEN** 完整編輯讀取期間另一視窗變更子項目
- **THEN** 回應內容及主時間戳同屬一個資料庫快照，後續儲存依該標記檢查

#### Scenario: 衝突與草稿復原
- **WHEN** 儲存衝突或復原草稿沒有原始時間戳
- **THEN** 保留目前輸入與草稿，明確顯示需要確認新資料，不清空或自動覆寫
