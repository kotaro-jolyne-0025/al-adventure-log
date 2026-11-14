# Proposal

## Why
目前所有 HEIC 頭像都下載解碼器並轉成 JPEG，即使瀏覽器本來就能讀取。應避免不必要的下載與轉檔。

## What Changes
- 先測試瀏覽器是否能解碼選取的 HEIC；成功直接裁切，失敗才延遲載入轉檔工具。
- 保留大小限制、既有提示及裁切操作；最終統一輸出 300×300 WebP，保留透明背景；離開頁面後不再開啟裁切視窗。
- 依使用者最終選擇改用 heic-to 作 fallback，移除 heic2any 與 CommonJS allowlist。

## Capabilities
### New Capabilities
無。
### Modified Capabilities
- `mobile-pwa`: 頭像 HEIC 原生讀取優先。

## Impact
僅角色表單、測試及頭像規格。無 API、資料庫或既有頭像資料變動。
