# 驗證紀錄

日期：2026-10-06；本機 Angular 開發伺服器及 Chrome（Playwright，虛構 API）。

## 結果

- `npm.cmd run build`：成功，無建置錯誤。
- `openspec validate improve-search-and-sort-keyboard-focus --strict`：通過。
- 瀏覽器腳本：[control-focus-check.cjs](../../../output/playwright/control-focus-check.cjs)；[12 組結果](../../../output/playwright/control-focus-results.json)。
- 兩種列表 × 明暗主題 × 320／390／1280px，共 12 組：真實 Tab 可到達搜尋、透明 select、排序方向與清除按鈕；方向鍵切換排序依據，Space 切換方向；Enter／Space 清除搜尋與無結果搜尋。倉庫另驗證稀有度及同調 chip、清除篩選。
- 聚焦時 3px 實線框可見，未被祖先 overflow 裁切，左右未超出視窗；搜尋清除聚焦時不框住整個輸入列，搜尋 active 與篩選 aria-pressed 仍正常。
- 截圖：淺／深色及三種寬度的選取 chip，存於 `output/playwright/control-focus-{light,dark}-{320,390,1280}.png`；人工檢視 320px 淺色及 390px 深色截圖，焦點與選取底色可區分。
- mobile-pwa 新增的控制項焦點需求已同步；DESIGN.md 第 13 節記錄完成範圍。

## 範圍限制

此次未驗證 200% 字級、實機手機／iOS 原生選單或螢幕閱讀器。次要文字對比、token 缺漏與其餘 P2 不屬於此批完成範圍。
