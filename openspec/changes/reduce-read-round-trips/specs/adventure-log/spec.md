## ADDED Requirements

### Requirement: Shared complete adventure reads

詳情、編輯載入與草稿復原 SHALL 使用成功主紀錄回應的 storyAwards，MUST NOT 再發故事獎勵 GET。物品讀取及舊資料 fallback SHALL 保持；必要 storyAwards 欄位缺漏或非陣列 MUST 視為讀取失敗，不能默認空清單後儲存。

#### Scenario: 正常完整紀錄
- **WHEN** 開啟詳情、編輯或執行草稿復原
- **THEN** 主紀錄及物品讀取成功後使用主紀錄的故事獎勵；空陣列為有效的無獎勵

#### Scenario: 故事獎勵缺漏
- **WHEN** 主紀錄未提供有效 storyAwards 陣列
- **THEN** 讀取失敗，編輯及比對不得用空清單繼續儲存

### Requirement: Live inventory totals in entry defaults

新增冒險 defaults SHALL 以即時倉庫永久物品 quantity 合計提供 startingMagicItems。表單 SHALL 使用該值，不為統計另讀完整倉庫；缺漏或非非負整數 MUST 維持載入失敗及禁止儲存。

#### Scenario: 庫存與角色摘要不一致
- **WHEN** 倉庫有數量 3 的永久物品及消耗品，角色摘要尚未同步
- **THEN** defaults 的起始永久物品數為 3，不計消耗品，新增表單不另讀完整倉庫

#### Scenario: 合計缺漏或讀取失敗
- **WHEN** defaults 讀取失敗或 startingMagicItems 無效
- **THEN** 保留載入失敗狀態，不默認 0 後允許儲存
