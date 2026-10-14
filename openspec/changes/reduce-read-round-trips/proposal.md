# Proposal

## Why

正式站 API 有數百毫秒等待，而已量測 SQL 執行僅數毫秒。角色逐筆統計與重複子項目讀取增加往返，應減少明確的多餘讀取。

## What Changes

- 角色列表在同一 SQL 批次彙總所屬角色靈魂幣。
- 詳情、編輯與草稿復原共用主紀錄的故事獎勵，不另請求同一資料。
- 預設值 API 即時加總永久物品，新增表單不讀全倉庫。
- 必要欄位缺漏維持失敗及儲存保護。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `character-management`: 列表靈魂幣批次統計及隔離。
- `adventure-log`: 預設庫存即時統計、共用完整故事獎勵讀取。

## Impact

Spring／MyBatis 查詢及 Angular 讀取流程；API 路徑、資料表及套件不變。本次僅本機實作，不發布。
