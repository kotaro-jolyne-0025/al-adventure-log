# Proposal

## Why

多視窗與跨裝置的舊內容可覆蓋新紀錄；前端先讀取再儲存仍有競態。採用既有 updated_at 於資料庫交易中原子檢查，避免新增版本欄位。

## What Changes

- 修改／刪除及冒險新增攜帶原始時間戳，缺漏拒絕、衝突回傳 409。
- 同角色的冒險／庫存異動短暫串行，子項目推進主冒險時間戳。
- 完整冒險與時間戳在一致讀取交易回傳，草稿保存原始時間戳。
- 保留衝突輸入與草稿，供查看新版及明確重載。
- 修正既有 updated_at 觸發器，確保同交易多次更新及時鐘回退仍推進標記；以隔離 PostgreSQL 回歸驗證。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `state-consistency`: 原子時間戳條件、完整讀取與衝突復原。

## Impact

Spring 控制器共用交易守衛、既有 mapper 更新時間、DTO 回應及 Angular 讀寫入口。V28 冪等替換既有更新時間函式，不新增 DB 欄位或套件；本機實作、建置與回歸驗證，不發布。
