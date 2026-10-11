# Design

## Context

目前 LegalPageComponent 使用 mat-card 包含五節卡片，引用另有兩層邊框；聲明文字與返回行為已存在。動機見 proposal.md。

## Goals / Non-Goals

提供完整展開的文件閱讀與快速章節定位。保留聲明原文與日期；本次不重新審訂法律內容或變更註冊彈窗。

## Decisions

- 使用語意 article/header/nav/section，單一 h1 與五個 h2，正文最大寬度 48rem；頁面採 surface 與 onSurface，輔助文字採 onSurfaceVariant。
- 五個目錄項目使用原生 fragment anchor；h2 有穩定 id、tabindex=-1 與 scroll-margin-top，避免 sticky 工具列遮擋並允許目標焦點。避免 JS 捲動及額外路由。
- 章節以留白與 outlineVariant 分隔；雙語引用共用 surfaceContainerLow 區域，中英文有語言標籤與 lang 屬性。相較側欄或摺疊，五節短文的頁首目錄更適合手機及完整閱讀。
- 本文 1rem、1.8 行高，標題中英分行；自訂連結至少 44px 高、明確焦點、文字可換行。四邊 padding 尊重安全區。
- 官方政策維持新分頁與 noopener noreferrer，外部連結圖示提供可見提示，aria-label 保留外部網站／新分頁說明；依使用者要求不顯示「新分頁開啟」文字。返回沿用既有 goBack。

## Risks / Trade-offs

- fragment 更新瀏覽器歷史 → 保留原生返回語意，驗證目錄定位及焦點，不宣稱每次返回都會離開本頁。
- 大字及長英文 → overflow-wrap 與自適應間距，不固定正文高度；驗證 320px 與 200% 字級。

## Migration Plan

無資料遷移。前端建置與瀏覽器驗證後同步 SRS 與主規格；需要回復時還原本次元件修改，發布沿用既有授權流程。
