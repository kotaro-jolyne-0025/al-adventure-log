## Why

V31 建立庫存基準後，Cloud Run 舊版本仍可能處理寫入。新前端也可能比同一個提交的後端提早上線。

## What Changes

- 以資料庫交易保護 V31 切換，拒絕未宣告異動支援的庫存寫入。
- 同一個提交包含前後端變更時，前端等待對應後端上線。

## Capabilities

### Modified Capabilities

- `database-recovery`: 新增首次異動記錄的部署切換規則。

## Impact

影響尚未套用的 V31、後端 JDBC 交易與前端發布順序。
