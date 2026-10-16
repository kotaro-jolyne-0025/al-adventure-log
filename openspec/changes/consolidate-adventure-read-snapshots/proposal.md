# Proposal

## Why

正式站同樣 10 筆紀錄的角色入口，重複操作中位數約 1.66 秒，本機合成資料約 1.15 秒，差距超過本輪 0.5 秒的處理門檻。正式請求日誌顯示列表 API 約 0.88–0.95 秒；目前四次 SELECT 與唯讀交易隔離設定造成多次跨區往返。

## What Changes

- 將冒險列表、詳情及新增預設值各自合併為一個限定所有權的 PostgreSQL SELECT，保留同一 statement snapshot。
- 以既有 MyBatis result maps 組合主紀錄、活動、故事獎勵、戰利品、必要舊倉庫及相鄰快照；子資料不產生互相笛卡兒乘積。
- 保留 API、原始微秒時間戳、寫入交易與 MutationGuard、帳本及歷史相容行為。
- 分開記錄瀏覽器操作時間、伺服器請求時間、資料量及本機驗證；正式改善須在另行授權部署後重測。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

無。本次為維持既有可觀察行為與一致性契約的讀取效能重構，使用 `skip_specs: true`；不改寫既有主規格要求。

## Impact

影響 AdventureEntryMapper、AdventureEntryService 與隔離 PostgreSQL 回歸測試。無資料庫 migration、新依賴、正式設定變更或部署。
