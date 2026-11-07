# Tasks

## 1. Backend invariants

- [x] 1.1 新增永久物品固定為一件，拒絕永久物品數量變更，並保留舊資料數量。
- [x] 1.2 在倉庫、冒險快照、舊資料補建與來源同步路徑拒絕類型變更。
- [x] 1.3 加入服務測試，確認不合法請求在寫入前失敗。

## 2. Inventory form

- [x] 2.1 編輯時類型唯讀，永久物品隱藏數量欄位；新增時永久物品送出數量 1。
- [x] 2.2 加入表單測試，涵蓋唯讀類型、隱藏欄位與舊資料數量保留。

## 3. Specifications

- [x] 3.1 更新 SRS 與 `inventory-provenance` 主規格及本 change 的規格差異。
- [x] 3.2 執行 OpenSpec 嚴格驗證。

## 4. Verification

- [x] 4.1 執行相關後端與前端測試、前端 production build、`git diff --check`。
- [x] 4.2 確認沒有資料庫 migration 或既有資料自動改寫。
