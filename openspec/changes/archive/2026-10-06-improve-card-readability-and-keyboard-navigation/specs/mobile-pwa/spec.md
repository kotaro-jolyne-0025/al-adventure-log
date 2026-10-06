# Spec Delta

## ADDED Requirements

### Requirement: Readable character card metadata
角色卡的種族、職業、子職、派系及等級文字 SHALL 至少為 0.875rem（預設字級下 14 CSS 像素），且不得在手機縮小。角色名稱與資訊 SHALL 可換行，資訊區 SHALL 隨內容成長，不以固定高度裁切或覆蓋操作列。

#### Scenario: 長資訊與放大文字
- **WHEN** 玩家在 320、360 或 390 CSS 像素寬的視窗查看含長名稱、複合職業、子職與派系的角色，或將基準文字放大到 200%
- **THEN** 資訊完整換行，卡片沒有水平溢出或文字重疊，編輯／刪除仍可使用

### Requirement: Keyboard accessible card navigation
角色、冒險、永久物品及消耗品卡的主要入口與品牌導覽 SHALL 為具可辨識名稱的原生連結，支援 Tab 聚焦、Enter 啟動與瀏覽器的新分頁操作。明暗主題 SHALL 有可見焦點。卡片內編輯／刪除 SHALL 獨立聚焦及操作，不得巢狀置於主要連結內或誤觸主要導覽。

#### Scenario: 鍵盤開啟卡片與品牌
- **WHEN** 玩家用 Tab 聚焦卡片主入口或品牌，然後按 Enter
- **THEN** 顯示焦點並開啟原有目的頁；主入口提供可用的 href，可由瀏覽器在新分頁開啟

#### Scenario: 獨立操作卡片按鈕
- **WHEN** 玩家用鍵盤或滑鼠啟動卡內編輯／刪除
- **THEN** 僅執行對應編輯導覽或刪除確認，取消刪除不改變目前列表；卡片其他原有可點擊區域仍可進入主目的頁
