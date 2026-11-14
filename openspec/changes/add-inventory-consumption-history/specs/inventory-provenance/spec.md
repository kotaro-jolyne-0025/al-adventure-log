# Spec Delta

## MODIFIED Requirements

### Requirement: Manual consumable quantity adjustment
玩家 SHALL 能在倉庫以消耗操作扣減消耗品，也 SHALL 保留透過編輯物品手動調整數量的能力。消耗 MUST 記為消耗，手動修改數量 MUST 記為調整，不能由負差額推定使用原因。需要從倉庫移除物品時，玩家 SHALL 使用明確的刪除操作並留下移除紀錄。消耗、數量調整或刪除 MUST NOT 改寫來源冒險記錄的歷史獲得快照。

#### Scenario: 手動調整消耗品數量
- **WHEN** 玩家編輯倉庫中的消耗品，將數量由 5 改為 3
- **THEN** 倉庫顯示 3，新增調整 -2 的異動紀錄，來源冒險的歷史獲得數量保持不變

#### Scenario: 明確刪除消耗品
- **WHEN** 玩家使用刪除操作移除剩餘 3 個的消耗品
- **THEN** 該物品自倉庫移除，新增移除 -3 的異動紀錄，來源冒險的歷史獲得快照保持不變

#### Scenario: 在倉庫消耗
- **WHEN** 玩家在倉庫對數量 5 的消耗品確認消耗 2
- **THEN** 剩餘數量為 3 且新增消耗 -2 的異動紀錄，歷史獲得數量不變
