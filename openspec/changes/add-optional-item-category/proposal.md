# Proposal

## Why

物品目前只有永久／消耗品類型與稀有度，無法記錄護甲、藥水等分類。新增選填分類，讓玩家在冒險獲得紀錄與背包中辨識物品用途。

## What Changes

- 增加選填、單選的「物品分類」，使用與稀有度一致的下拉選單，選項顯示中文及官方英文名稱，包含未指定及九種分類：護甲 (Armor)、藥水 (Potion)、戒指 (Ring)、權杖 (Rod)、捲軸 (Scroll)、法杖 (Staff)、魔杖 (Wand)、武器 (Weapon)、奇物 (Wondrous Item)。
- 冒險永久物品與消耗品明細、倉庫新增／編輯皆可設定及清除分類；倉庫清單的永久物品與消耗品項目以中文膠囊標籤顯示已選分類，置於稀有度附近，未指定時不顯示；冒險詳情亦顯示已選分類。
- 分類保存於冒險快照與倉庫，沿用既有同步方向與數量差額規則；舊資料保持未指定。
- 分類不影響永久／消耗品類型、稀有度、同調或魔法物品數量計算。本次不增加分類篩選或自動推測。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `inventory-provenance`: 新增可選物品分類、下拉選取與顯示、儲存及歷史／倉庫同步要求。

## Impact

- 前端 inventory/adventure model、inventory-form、adventure-form、inventory-list、adventure-detail。
- 後端物品 Entity、Request/Response DTO、InventoryItemService、AdventureEntryService 與兩個 MyBatis mapper。
- Flyway 新增 migration，為 inventory_item 與 adventure_gained_item 增加 nullable 分類欄位；更新 SRS、database-schema 與主規格。
- API 增加選填 itemCategory；無新增套件、路由或正式環境手動操作。
