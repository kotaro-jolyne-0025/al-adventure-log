# Proposal

## Why

PWA 可能先載入已快取的舊版；目前只透過 Snackbar 監聽新版下載完成，缺少主動檢查與可持續使用的更新入口，使用者重開網站後仍不易確認版本。

## What Changes

- 開啟網站穩定後、從背景返回與恢復連線時檢查更新；合併同時發生的檢查，避免重複請求。
- 在所有頁面的右上角選單提供目前版號與手動檢查入口；手動檢查結果使用上方 Snackbar，平常不顯示常駐版本資訊列。
- 新版就緒或快取無法復原時顯示上方 Snackbar 提醒，並持續保留選單重新整理入口；由使用者確認重新整理，取消保持表單輸入。
- Hosting 的入口與更新中繼檔要求重新驗證；不清除使用者資料、不自行切換執行中的版本。
- 畫面版號由 package.json 取得，同步產品版號為 1.2.2；透過版本分支提出 PR，發布依 VERSIONING.md。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `mobile-pwa`: 新增選單版本檢查、自動更新提醒、持續選單更新入口與使用者確認重新整理行為。

## Impact

前端根元件、更新服務、首頁版號、Firebase Hosting 快取標頭、PWA 中繼資料與測試；同步 SRS、主規格、版本規範與前後端版本檔。沿用 Angular Service Worker、Signals、RxJS 與共用確認視窗，不新增依賴或後端 API。
