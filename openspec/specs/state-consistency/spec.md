# state-consistency Specification

## Purpose

定義冒險完整儲存與資料讀取期間的一致性要求，使錯誤讀取不會被誤當空資料而刪除歷史內容，並確保玩家登入切換及資料異動後看到的角色狀態來自有效的最新讀取。

## Requirements

### Requirement: Complete child collections required
冒險完整儲存 API SHALL 明確要求主記錄以及休整期活動、獲得物品、故事獎勵三個子清單；子清單省略或 null MUST 回傳驗證錯誤。明確空陣列 SHALL 表示移除該類子項目。

#### Scenario: 缺少子清單
- **WHEN** 完整儲存請求未提供故事獎勵清單或將其設為 null
- **THEN** 系統拒絕請求，原冒險與子項目維持不變

#### Scenario: 明確清空故事獎勵
- **WHEN** 完整儲存請求提供其他有效資料並將故事獎勵設為空陣列
- **THEN** 成功儲存後該冒險不再有故事獎勵

### Requirement: Complete save atomicity
冒險完整儲存 SHALL 將主記錄、子項目與其必要同步視為同一次操作；任何部分失敗 MUST NOT 留下部分成功資料。

#### Scenario: 子項目不屬於此冒險
- **WHEN** 完整儲存提交另一冒險的子項目 ID
- **THEN** 系統拒絕該請求，主記錄及所有子項目保持儲存前狀態

#### Scenario: 更新角色當前狀態失敗
- **WHEN** 儲存冒險時，更新角色當前等級、職業、金幣或休整期失敗
- **THEN** 該次冒險、子項目與角色當前狀態的異動全部回滾，不留下快照已更新但當前狀態未更新的部分結果

#### Scenario: 倉庫與目前魔法物品數同步失敗
- **WHEN** 倉庫永久性魔法物品異動時，更新 character 目前魔法物品數失敗
- **THEN** 倉庫異動與 character 更新全部回滾，不留下倉庫數量與 character 不一致的結果

#### Scenario: 正數變化的待補物品建立失敗
- **WHEN** 儲存正數魔法物品變化時，必要的待補物品無法完整建立或 character 目前數量無法更新
- **THEN** 冒險主記錄、子項目、待補物品、倉庫及 character 的該次異動全部回滾

### Requirement: Edit loading failure protection
編輯冒險 SHALL 在主記錄、獲得物品及故事獎勵成功載入後才允許儲存。讀取失敗 MUST NOT 被視為空清單；系統 SHALL 提供重試。

#### Scenario: 戰利品載入失敗
- **WHEN** 主記錄載入成功但戰利品讀取失敗
- **THEN** 系統顯示載入失敗並禁止儲存，直到重試取得完整資料

### Requirement: Invalidated reads cannot repopulate data
登出、登入及角色資料異動 SHALL 使相關快取及進行中的舊讀取失效；已失效請求的延遲回應 MUST NOT 回填或重播舊資料。

#### Scenario: 切換帳號時舊請求晚到
- **WHEN** 玩家 A 發出讀取後登出，玩家 B 登入，A 的讀取才回應
- **THEN** B 的畫面與快取不出現 A 的資料

### Requirement: Mutation refresh ordering
冒險或倉庫异動成功後，系統 SHALL 先使相關角色、冒險、預設值及倉庫資料失效，再更新 HUD；使用者 SHALL 無須手動重整即可看到新狀態。

#### Scenario: 儲存後 HUD 更新
- **WHEN** 玩家成功儲存冒險變更
- **THEN** HUD 以失效後重新取得的資料更新，而非重播變更前快取

### Requirement: Adventure deletion atomicity
冒險刪除、相關子項目與必要倉庫同步，以及 character 當前狀態撤回 SHALL 在同一交易完成；任一步驟失敗 MUST 全部回滾。

#### Scenario: 刪除時角色更新失敗
- **WHEN** 刪除冒險過程中 character 更新失敗
- **THEN** 冒險、子項目、倉庫及 character 全部維持操作前狀態，不留下已刪紀錄或部分扣回

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
