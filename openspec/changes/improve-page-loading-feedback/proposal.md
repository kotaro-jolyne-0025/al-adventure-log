# Proposal

## Why
切頁需下載頁面程式碼並重新確認雲端資料，操作期間缺乏即時回饋；背景刷新也會暫時移除已顯示內容，造成慢半拍的感受。

## What Changes
- 導覽開始即呈現載入回饋，取消或失敗時清除。
- 五種讀取頁背景刷新保留既有內容，雲端確認完成前仍停用正式異動。
- 角色頁穩定後於閒置時預載冒險列表與倉庫的程式碼。

## Capabilities
### New Capabilities
無。
### Modified Capabilities
- `mobile-pwa`: 導覽回饋與閒置預載。
- `local-read-cache`: 背景刷新保留內容與安全的異動限制。

## Impact
僅前端 Angular Router、讀取頁與回饋元件；API、儲存格式及資料新鮮度規則沿用既有行為，不新增套件。
