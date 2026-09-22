# mobile-pwa Specification

## Purpose

定義玩家在手機、平板及桌機使用冒險紀錄表時的安裝與操作需求，使表單、圖示與關鍵動作能在可用視窗內正常呈現，並維持手機安全區域及觸控操作的基本可用性。

## Requirements

### Requirement: Installable standalone application
在支援 PWA 安裝的瀏覽器中，系統 SHALL 提供可安裝的應用程式資訊；安裝後 SHALL 能由裝置入口啟動為獨立視窗。

#### Scenario: 從裝置入口啟動
- **WHEN** 玩家完成瀏覽器提供的安裝流程並從裝置入口開啟
- **THEN** 應用程式以獨立視窗呈現，不顯示一般瀏覽器網址列

### Requirement: Responsive content containment
行動版角色、冒險、倉庫與表單頁面 SHALL 使卡片、文字、圖示及操作按鈕保留在可用視窗內，並依空間調整排列；必要操作 MUST 可見且可觸及。

#### Scenario: 360 像素手機視窗
- **WHEN** 玩家以 360 CSS 像素寬、800 CSS 像素高的視窗查看列表或表單，包含長名稱資料
- **THEN** 頁面無內容造成的橫向溢出，編輯、刪除及儲存等必要操作仍可使用

### Requirement: Safe area and input ergonomics
手機版 SHALL 避開頂部瀏海與底部手勢區，固定儲存區 MUST NOT 遮擋必要表單操作；寬度不超過 768 CSS 像素時輸入文字 SHALL 至少 16 CSS 像素，關鍵按鈕點擊高度 SHALL 至少 42 CSS 像素。

#### Scenario: 有底部手勢區的裝置
- **WHEN** 玩家在有底部手勢區的手機填寫並捲動至表單末端
- **THEN** 儲存按鈕位於安全可點擊區域，最後一個輸入欄位可完整捲入可視範圍

### Requirement: Resource card feedback
冒險表單 SHALL 將金幣、休整期與魔法物品分成獨立資源卡片，顯示即時合計，並對負合計提供可辨識警示。

#### Scenario: 即時看到資源不足
- **WHEN** 玩家變更數值使某項合計為負
- **THEN** 該資源卡片即時顯示負合計與警示，並遵守資源不足禁止儲存規則
