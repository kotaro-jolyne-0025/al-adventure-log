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

### Requirement: Mobile search and action targets
寬度不超過 768 CSS 像素時，冒險與倉庫搜尋輸入文字 SHALL 至少 16 CSS 像素。搜尋清除、角色編輯／刪除、倉庫編輯／刪除、頂部返回及帳號選單操作 SHALL 提供至少 44×44 CSS 像素的按鈕範圍，且相鄰操作 MUST NOT 重疊。

#### Scenario: 搜尋與清除
- **WHEN** 玩家在 320、360 或 390 CSS 像素寬的手機搜尋冒險或倉庫
- **THEN** 輸入文字至少 16px，清除按鈕範圍至少 44×44px，清除後列表依現有規則更新

#### Scenario: 操作角色與物品
- **WHEN** 玩家在手機開啟角色列表、角色頁或倉庫
- **THEN** 本需求指定的操作按鈕至少 44×44px，完整保留在可用寬度內且不重疊

### Requirement: Responsive avatar crop preview
頭像裁切預覽 SHALL 在 320、360、390 CSS 像素寬的視窗內完整呈現，滑桿與確認／取消操作 SHALL 可使用。預覽縮放後，滑鼠與單指拖曳 SHALL 按顯示比例移動圖片；確認後 SHALL 保持 300×300 像素圖片輸出。

#### Scenario: 小視窗拖曳與匯出
- **WHEN** 玩家在縮小預覽中拖曳圖片並確認裁切
- **THEN** 圖片移動與指標移動一致，匯出內容符合預覽裁切區域，輸出尺寸保持 300×300

### Requirement: Theme-aware authentication text
登入、註冊、忘記密碼與重設密碼頁的自訂標題、說明、錯誤、成功及連結失效提示 SHALL 依目前深淺色主題顯示可讀的文字與背景，並保留既有登入流程及供應商登入品牌外觀。

#### Scenario: 深色狀態提示
- **WHEN** 玩家在深色主題查看驗證頁的表單、錯誤、成功或連結失效狀態
- **THEN** 自訂文字與狀態區使用對應主題語意色，重要文字與實際底色對比至少 4.5:1

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

### Requirement: Contained operation notifications
系統操作提示 SHALL 使文字與關閉按鈕保留在可用視窗內，避開底部安全區。包含長連續字串的訊息 SHALL 可換行，文字不得使關閉操作被水平裁切；必要時允許在提示文字區垂直捲動閱讀全文。

#### Scenario: 刪除長名稱角色
- **WHEN** 玩家在 320、360、390 CSS 像素寬的手機刪除具有長中文或連續英文名稱的角色
- **THEN** 成功訊息依可用寬度換行，提示與關閉按鈕不超出視窗，關閉按鈕可正常關閉提示

#### Scenario: 主題與較大文字
- **WHEN** 玩家在明暗主題及 200% 基準文字大小下查看操作提示
- **THEN** 文字可讀取且關閉操作仍可使用，維持原有文案、主題色及提示時間
