# Proposal

## Why

使用者確認完成 DESIGN.md 的 P2 後即結束 1.2.1，新的視覺／配色調整歸入下一版。現有雙主題、文字資訊、手機摘要與載入狀態仍有盤點出的不一致，需要整輪改善及驗證後再交付。

## What Changes

- 統一自訂主色與現有 Material primary、稀有度 chip／pill 的語意來源，修正缺漏 token、休整期色彩、暗色故事獎勵及固定淺色樣式。
- 改善次要文字對比，保留既有色系及資料語意。
- 品名、來源及角色資訊可直接閱讀全文；手機 HUD 等級一列、四項資源 2×2。
- 冒險表單提供手機黏附操作列，短視窗回到文件流，保留最後欄位可達性。
- 角色骨架沿用成品版面；載入／提交提供進度文字，動態 viewport 與 reduced-motion 適用主要頁面。
- 同步 SRS、DESIGN.md 與主規格，完成跨頁驗證。變更保留在 v1.2.1，合併及發布依後續明確指示執行。
- 前端 package／lockfile 及首頁版本標示更新為 1.2.1。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `mobile-pwa`: 雙主題一致性與可讀性、完整列表資訊、手機摘要／表單操作、載入與減少動態偏好。

## Impact

前端 styles、頁面 SCSS／模板、稀有度色彩對應、SRS、DESIGN.md 及驗證紀錄。保留既有資料／API 行為與依賴。
