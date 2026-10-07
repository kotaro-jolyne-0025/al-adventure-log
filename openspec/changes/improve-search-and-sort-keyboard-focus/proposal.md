# Proposal

## Why

DESIGN.md 的 P2 盤點指出：排序選單透明、自訂搜尋輸入移除 outline，搜尋中的樣式也與焦點狀態相近。玩家用鍵盤操作冒險與倉庫列表時，需要清楚辨認目前所在的控制項。

## What Changes

- 搜尋輸入與透明排序選單聚焦時，在可見容器顯示焦點框。
- 排序方向、清除搜尋、篩選 chip、清除篩選與無結果清除按鈕提供一致的鍵盤焦點。
- 保留原生鍵盤行為、既有搜尋 focus-within 及篩選選取狀態。
- 更新 DESIGN.md 完成範圍；次要文字對比與其他 P2 項目分批處理。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `mobile-pwa`: 補充列表自訂控制項在雙主題及手機視窗下的可見鍵盤焦點要求。

## Impact

前端共用樣式、DESIGN.md、mobile-pwa 主規格及瀏覽器驗證紀錄。不新增依賴，不涉及 API 或資料庫。
