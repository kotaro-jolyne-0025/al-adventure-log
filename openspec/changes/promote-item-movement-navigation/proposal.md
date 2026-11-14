# Proposal

## Why

物品異動包含消耗品與永久性魔法物品，入口藏在倉庫內容易被理解成僅有消耗紀錄。將其提升為角色內第三個目的地，讓手機與桌機使用相同順序與範圍。

## What Changes

- 手機底部、桌機上方依序提供「冒險紀錄」、「倉庫」、「物品異動紀錄」。進入角色仍預設冒險紀錄。
- 移除倉庫內重複的紀錄入口；第三個目的地重用既有歷史清單，不另做一套紀錄。
- 全角色歷史統一名稱為「物品異動紀錄」，涵蓋兩類物品的真實取得、調整及移除，消耗只適用消耗品。
- 保留收合、日期分組、分頁、消耗編輯與撤銷規則；不補造舊物品歷史。冒險詳情「消耗紀錄」仍僅回顧該場消耗。
- 保留既有歷史網址、角色隔離、倉庫瀏覽狀態及既有排版。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `character-management`: 三個角色目的地的響應式導覽及選取狀態。
- `inventory-history`: 歷史入口提升、命名與永久物品呈現邊界。

## Impact

影響 character-shell、inventory-list、inventory-history 及其路由判斷、焦點、元件與視覺測試；實作後同步 DESIGN.md、SRS 與主規格。後端既有 movement 模型與查詢已涵蓋兩類物品，預期重用 API，無新增依賴、資料遷移或正式資料修改。既有 add-inventory-consumption-history 與 add-character-scoped-mobile-navigation 的已完成行為作為基底，本 change 定義其後續導覽差異，不重寫舊任務的完成狀態。
