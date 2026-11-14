## ADDED Requirements

### Requirement: Inventory movement release cutover

首次啟用物品異動時，系統 SHALL 在同一資料庫交易中建立基準及啟用寫入保護。資料庫 MUST NOT 接受基準建立後由舊版後端送出的庫存變更。CI/CD SHALL 確認正式後端使用相同提交，或使用具有相同後端內容的祖先提交，才發布前端。

#### Scenario: 舊版請求跨越基準切換
- **WHEN** 舊版庫存寫入先取得鎖，或在 V31 建立基準之後才取得鎖
- **THEN** 前者的已提交結果包含在基準，後者的交易失敗並回滾

#### Scenario: 同批前後端部署
- **WHEN** 正式後端仍回應不同後端內容的舊提交或無法回應
- **THEN** 前端部署等候確認，逾時後停止發布
