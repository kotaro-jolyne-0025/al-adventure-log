# Proposal

## Why

玩家常在手機與跑團現場使用本系統，弱網等待、更新時未完成的草稿，以及難以找到的安裝入口都會中斷操作。現有 PWA 已有 Service Worker、本機草稿與已讀副本，應把這些能力銜接完整並降低首次下載負擔。

## What Changes

- 更新頁面前等待冒險草稿保存成功；本機保存失敗時保留表單並提供重試或線上儲存，不顯示草稿預覽或複製操作。
- 讀取頁先顯示有效已讀副本並以唯讀狀態背景更新；最新雲端資料成功後才恢復操作。
- 提供可見的安裝入口，遵循各瀏覽器的原生提示或提供平台操作指引，並在已安裝時隱藏。
- 統一 HTML 與 Manifest 的語言、啟動畫面色彩和應用識別，檢查 maskable 圖示與安裝截圖。
- 分析初始 bundle 與 Service Worker 預抓資源，延後低頻 UI／第三方登入資源，降低首次安裝與更新傳輸量。
- 改善本機草稿儲存空間不足時的提示，必要時申請持久儲存，且不阻止玩家直接線上儲存。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-pwa`: 安裝入口、Manifest 啟動資訊，以及應用程式更新前保存輸入。
- `local-read-cache`: 弱網時先呈現有效副本，背景更新成功後恢復線上操作。
- `local-adventure-drafts`: 更新前保存草稿與本機儲存空間不足時的保護措施。

## Impact

- Angular app shell、更新服務、冒險表單與讀取頁 facade。
- Web app manifest、HTML metadata、Angular service worker 設定、Firebase Hosting headers。
- PWA 圖示及安裝提示介面；不新增執行期依賴，不變更 API 或資料庫。
- SRS、OpenSpec 主規格與本 change 驗證紀錄。
