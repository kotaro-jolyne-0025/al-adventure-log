# Design

## Context

沿用 DESIGN.md 的雙主題與 Material 元件；動機見 proposal.md。現有搜尋為自訂 input，不在全域 Material 16px 規則範圍；小按鈕覆寫尺寸分散。Canvas 內部為 320×320，裁切框 240×240，匯出 300×300，原拖曳直接混用 viewport 與 canvas 座標。

## Goals / Non-Goals

**Goals:** 以既有 CSS 與語意 token 修正本批問題，拖曳採一致的 canvas 座標。

**Non-Goals:** 不加入 UI 套件、改登入與業務資料、調整其他 P1 的小字／卡片鍵盤導覽，不改第二批 HUD 與黏附操作列。

## Decisions

- 全域手機規則涵蓋自訂搜尋與 Material icon button 的最小尺寸；非 icon 的角色 footer、頂部帳號膠囊個別處理。保留既有較大尺寸，避免逐顆重新實作熱區。
- Canvas backing store 不變，CSS 用容器寬度與 aspect-ratio 縮放；滑鼠／觸控共用座標換算 `(client - rect origin) × canvas dimension / rect dimension`，不引入 ResizeObserver 或改寫匯出演算法。
- 驗證頁自訂文字與狀態區使用現有 primary／secondary／positive／negative token；錯誤提示採 Material 的 error-container／on-error-container 配對，維持可讀對比並保留全站負向色。
- 增加一份裁切座標與匯出回歸測試；CSS 透過 Playwright 量測。以本機模擬 API 與虛構資料驗證登入後頁面，不連接正式資料。

## Risks / Trade-offs

- 小按鈕增大可能擠壓頂部或卡片 → 在 320／360／390px 量測邊界與相鄰矩形。
- CSS 縮放後拖曳偏移 → 測試不同位置／顯示比例的滑鼠及觸控，維持匯出座標檢查。
- 桌機 Chromium 不能證明 iOS 鍵盤與瀏海行為 → 驗證 computed 字級與布局，交付時註記實機驗證限制。
- 工作區已有 SCSS 修改 → 保存基線，只增補本批必要規則。

## Migration Plan

僅前端變更，依既有 CI/CD 在使用者授權提交與 push 後部署；本次不部署。回復本批樣式及裁切改動即可退回，不需資料 migration。
