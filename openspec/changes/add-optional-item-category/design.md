# Design

## Context

動機見 proposal.md。現有物品分別保存於 inventory_item 與 adventure_gained_item，由 MyBatis XML 映射，InventoryItemService 處理背包編輯，AdventureEntryService 處理快照、完整儲存與差額同步。前端兩個表單已有稀有度 mat-select，可直接沿用。

## Goals / Non-Goals

**Goals:** 以單一 nullable 欄位貫通既有儲存、讀取、編輯與同步路徑，保持來源與數量規則。

**Non-Goals:** 不建立分類管理資料表、通用標籤系統、分類篩選或遊戲規則判定。

## Decisions

1. API 使用 itemCategory，DB 使用 item_category。值為固定英文識別值，中文對照集中於前端 inventory.model.ts，冒險 model 共用 ItemCategory 型別。與 itemType 分離以保留永久／消耗品語意；不使用自由文字或多選陣列。
2. 兩表增加 nullable VARCHAR(32) 與允許九個值的 CHECK constraint，既有列保持 NULL。使用新的 Flyway migration（實作時選下一個未占用版本），ADD COLUMN IF NOT EXISTS 與檢查 constraint 是否存在確保可重跑。不增加索引，因本次無分類查詢需求；不引入 PostgreSQL enum 或分類表。
3. Java 共用 ItemCategory enum，兩組 Entity、Request/Response DTO 使用相同型別，MyBatis 保存 enum 名稱。沿用現有無效輸入錯誤處理，驗證無效字串及陣列得到 400。null 與省略皆代表未指定，與現有稀有度完整更新行為一致；不另引入 PATCH 語意。
4. 逐一涵蓋 AdventureEntryService 的新建、更新、歷史倉庫補建快照、仍持有庫存更新與正差額重建分支及 response mapping。分類附加於現有同步，不重寫數量演算法；自動待補項目分類為 null。
5. 表單在稀有度附近加入有標籤的 mat-select，選項顯示中文及 D&D Beyond 官方英文分類名稱，「未指定」在前端使用空值並序列化為 null。前端表單載入、Signals 更新與請求組合均保留分類；倉庫清單的永久物品與消耗品項目在稀有度附近以唯讀膠囊標籤顯示純中文分類，未指定時不渲染。膠囊沿用現有標籤的圓角、字級與間距，以中性樣式與稀有度區別，標籤容器允許手機版換行。冒險詳情兩種物品區塊亦顯示純中文分類。

## Risks / Trade-offs

- [同步分支漏欄位] → 測試新增入庫、快照更正、清除、正差額重建與不補貨行為，並驗證兩個 mapper 的實際讀寫。
- [舊前端完整儲存省略新欄位會清除分類] → 在文件明確記錄省略即 null，後端就緒後再發布前端；避免混用舊頁面修改已分類資料。
- [新前端早於後端上線] → 依部署流程確認後端 migration 與 API 就緒後再發布前端。

## Migration Plan

實作時在隔離 PostgreSQL 驗證 migration、重跑與 CHECK constraint，執行後端相關測試、前端測試與 production build。更新 SRS、database-schema 並同步主規格。部署依既有 CI/CD 及使用者授權流程，不直接修改正式資料庫。若需回退應用，保留新增 nullable 欄位與已有分類資料，不刪欄或修改已套用 migration。
