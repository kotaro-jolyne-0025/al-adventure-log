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
- **WHEN** 倉庫永久魔法物品異動時，更新 character 目前魔法物品數失敗
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
