# Design

## Context

見 proposal.md。Angular Material Snackbar 的文字 flex item 預設 min-width:auto，連續英文名稱超出可用寬度並推走關閉操作。手機 .cdk-overlay-pane 全域 94vw 規則原意針對 Dialog，卻也限制 Snackbar；handset Snackbar 又使用 100vw 容器及外距。

## Goals / Non-Goals

**Goals:** 以共用 CSS 修復提示容器與文字的根因，避免只縮短刪除角色訊息。

**Non-Goals:** 不改刪除行為、文案、顯示時間或供應商 Material 原始碼，不新增通知套件。

## Decisions

- 94vw 規則限於 Material dialog panel，保留既有對話框的手機排版。
- Snackbar 容器依 viewport 及 safe-area 保留外距，解除內容的 min-width 限制。
- 提示 label 採 min-width:0、overflow-wrap:anywhere，保留 Material 的最大文字高度與垂直捲動；操作區保持原有不可收縮行為。
- 用攔截 API 的刪除流程驗證訊息及關閉，不接觸正式資料。量測前等待進場動畫完成。

## Risks / Trade-offs

- [影響共用提示] → 同時檢查手機／桌機、雙主題與大文字。
- [彈窗寬度限制改成精準選擇器] → 檢查實際刪除確認仍完整置於視窗內。
- [實機安全區差異] → 保留 env safe-area，瀏覽器模擬不取代實機驗證。
