# Proposal

## Why

共用 SCSS 與父容器調整經常造成其他頁面排版回歸。目前 CI 執行 Vitest 與 production build，既有 output/playwright 腳本產生截圖與尺寸紀錄，但缺少可重複執行的基準圖比較。

## What Changes

- 導入 Playwright Test，建立角色、冒險、倉庫及其共用導覽的視覺回歸案例。
- 使用虛構 API 資料、固定瀏覽器環境及雙主題，涵蓋手機、桌機、斷點與長內容。
- 為排序膠囊與水平溢出加入尺寸斷言，落實 DESIGN.md 的回歸規範。
- 提供基準更新、差異報告與本地執行方式，差異須經人工確認才能更新基準。

## Capabilities

### New Capabilities

無。本次為開發測試工具導入，使用 skip_specs。

### Modified Capabilities

無。既有產品行為作為測試依據。

## Impact

影響 frontend/package.json、lockfile、新增 Playwright 設定與測試資料、截圖基準、測試使用文件、.gitignore 。實作沿用既有路由、登入契約與樣式，從 output/playwright 的虛構資料及量測案例擷取可用內容並更新至現行 API 契約。
