## ADDED Requirements

### Requirement: Batched live soul coin totals in character lists

角色列表 SHALL 使用限定當前使用者角色的批次倉庫統計回傳靈魂幣數量，MUST NOT 逐角色另發統計查詢。只加總標記靈魂幣的消耗品 quantity，無物品者為 0。

#### Scenario: 多角色與其他使用者物品
- **WHEN** 當前使用者有多個角色，其他使用者也有靈魂幣
- **THEN** 每個角色回傳自己的 quantity 合計，不混入其他角色／使用者，也不以物品筆數代替 quantity

#### Scenario: 無角色或無靈魂幣
- **WHEN** 使用者無角色或角色無靈魂幣
- **THEN** 回傳空角色列表或該角色數量 0，不使用過期的儲存欄位
