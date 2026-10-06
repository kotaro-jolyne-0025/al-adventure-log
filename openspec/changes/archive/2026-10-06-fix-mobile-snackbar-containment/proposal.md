# Proposal

## Why

使用者回報刪除角色後提示在部分手機樣式被切掉。窄視窗與長連續名稱會使 Snackbar 文字及關閉操作超出可見範圍。

## What Changes

- 提示容器適應可用寬度，保留邊距與底部安全區。
- 提示文字可縮小寬度並換行，長連續字串可斷行，關閉操作保持可用。
- 以實際刪除虛構角色的流程驗證手機、桌機、明暗主題及大文字。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `mobile-pwa`: 新增操作提示的可視範圍與閱讀要求。

## Impact

共用 Snackbar／overlay SCSS、瀏覽器回歸腳本及設計／規格文件。不變更刪除邏輯、文案、提示時間或資料庫。
