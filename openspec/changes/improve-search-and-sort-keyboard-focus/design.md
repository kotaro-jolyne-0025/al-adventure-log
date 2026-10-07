# Design

## Context

冒險與倉庫列表使用相同的搜尋與膠囊排序 class；原生 select 以 opacity: 0 覆蓋可見標籤，input 則取消 outline。既有搜尋 focus-within 與有搜尋文字的 active 共用樣式。動機見 proposal.md。

## Goals / Non-Goals

**Goals:** 共用規則讓焦點辨識一致，以 CSS 完成且保留原生鍵盤處理。

**Non-Goals:** 此批不重排控制項、不修改資料邏輯或 Material 元件內部樣式；其他 P2 色彩與文字問題另行處理。

## Decisions

- 在 styles.scss 限定兩個列表元件的自訂控制項，避免跨頁副作用與兩份重複規則。
- 以 :has(input:focus-visible) / :has(select:focus-visible) 將焦點框畫在可見容器；單獨描繪透明 select 仍看不到框，因此不採用。
- 使用現有 Material primary 與 3px outline；膠囊分段與清除按鈕使用內縮框，以免小視窗邊緣裁切；一般 filter/link 按鈕框外偏移 2px。保留 focus-within，不以 JavaScript 模擬 focus 或鍵盤。
- 聚焦輸入時才描繪搜尋容器；聚焦清除按鈕時框選按鈕本身，明確顯示實際操作位置。

## Risks / Trade-offs

- :has 支援依現有瀏覽器基線（已用於卡片焦點）→ 在本機 Chrome 實測。
- 焦點框與稀有度 chip 色可能相近 → 檢查選取及未選取狀態、深淺底色；用額外描邊與選取底色區分。
- 自動瀏覽器檢查無法代表所有實機 → 記錄視窗與主題範圍，保留使用者手機驗收。
