# mobile-pwa Spec Delta

## ADDED Requirements

### Requirement: Recoverable page read states
角色、冒險及倉庫列表 SHALL 區分載入中、成功空資料、搜尋無結果及讀取失敗。讀取失敗 SHALL 在頁面持續提供錯誤說明與重試入口；重試 SHALL 保留搜尋及篩選。暫時性詳情讀取失敗 MUST NOT 被當成資料不存在；已有內容刷新失敗 SHALL 保留內容並顯示未更新提示。

#### Scenario: 初次讀取失敗後重試
- **WHEN** 玩家初次開啟列表遇到網路或伺服器錯誤，然後選擇重試
- **THEN** 顯示讀取失敗而非「尚無資料」，成功後顯示最新結果，保留條件

#### Scenario: 詳情錯誤與背景刷新
- **WHEN** 詳情暫時讀取失敗或已有內容背景刷新失敗
- **THEN** 暫時錯誤有重試，既有內容不被清空；不存在、權限問題與暫時錯誤使用不同且符合既有安全流程的說明與出口

### Requirement: Safe inventory edit initialization
編輯物品 SHALL 顯示可辨識的讀取狀態，只有成功載入目標物品後才能儲存。讀取失敗 SHALL 提供重試或返回，MUST NOT 允許以未載入的預設表單覆寫資料。

#### Scenario: 慢速載入時提交
- **WHEN** 玩家開啟編輯物品且讀取尚未成功
- **THEN** 儲存不可用，成功載入後才可依原校驗儲存；失敗可復原

### Requirement: Connected contextual tab content
角色內冒險／倉庫導覽及倉庫物品分類 SHALL 將選取狀態、控制名稱與實際內容區建立可由輔助技術辨識的關聯，SHALL 支援相應鍵盤操作。角色路由導覽 SHALL 依目前網址正確呈現選取，並支援直接進入與瀏覽器返回。

#### Scenario: 操作與返回角色分頁
- **WHEN** 玩家以鍵盤切換冒險／倉庫，或透過直接網址與上一頁進入
- **THEN** 選取狀態與真實內容一致，名稱及內容關聯可辨識，焦點不指向空白面板

#### Scenario: 切換倉庫分類
- **WHEN** 玩家以鍵盤切換永久物品與消耗品
- **THEN** 相應內容區有正確的分頁標籤關聯，搜尋及既有篩選行為保持

### Requirement: Keyboard operable avatar positioning
頭像裁切 SHALL 提供不依賴拖曳的鍵盤位移方式，縮放控制 SHALL 有清楚名稱與可讀值，移動／縮放／重設／取消／確認 SHALL 可完全由鍵盤完成。原有指標行為及 300×300 匯出 SHALL 保持。

#### Scenario: 全鍵盤完成裁切
- **WHEN** 玩家只用鍵盤調整頭像
- **THEN** 可到達具可見焦點的位移及縮放操作，確認匯出與可見裁切結果一致，取消不改頭像

### Requirement: Perceivable form recovery and busy status
角色、冒險與物品表單的提交錯誤 SHALL 提供可感知且可定位至相關欄位或區塊的說明，SHALL 保留輸入並展開被收合的錯誤內容。提交中 SHALL 保留可理解的動作文字與進度、避免重複提交。驗證頁的讀取／提交結果及錯誤 SHALL 可由輔助技術感知，MUST NOT 只有視覺 spinner；同一訊息 SHALL 避免重複播報。

#### Scenario: 修正長表單錯誤
- **WHEN** 玩家提交含無效欄位或選填明細的表單
- **THEN** 錯誤說明提供定位方式，相關區塊展開，焦點或播報引導修正且保留輸入

#### Scenario: 驗證頁提交中及失敗
- **WHEN** 玩家提交登入或註冊並等待回應或遇到錯誤
- **THEN** 仍能辨識動作與等待狀態，錯誤可感知且可修正，不重複發送提交

### Requirement: Distinct destructive confirmation
刪除確認 SHALL 在雙主題下提供明確的破壞性文案與語意強調，SHALL 讓取消為初始焦點並支援 Escape 取消及合理返回焦點。一般確認 SHALL 使用相應的一般操作強調，MUST NOT 誤用刪除語意。

#### Scenario: 刪除與一般確認
- **WHEN** 玩家分別開啟刪除角色確認與重新整理確認
- **THEN** 刪除操作明確表達不可復原的影響；重新整理使用一般確認語意，兩者均可安全取消

### Requirement: Consistent semantic presentation roles
自訂頁面 SHALL 依明確的表面、文字、主操作、錯誤及字體角色呈現一致層級，在雙主題與大字下維持可讀性。品牌、D&D 資源／稀有度及供應商品牌例外 SHALL 有明確用途；一般文字與實際背景 SHALL 至少 4.5:1。既有手機密度、完整資料與操作範圍要求 SHALL 保持。

#### Scenario: 雙主題與大字
- **WHEN** 玩家查看角色、冒險、倉庫及驗證頁並切換主題或放大文字
- **THEN** 同角色元件的視覺層級一致，文字可讀，錯誤與選取不只依賴顏色，核心資料及操作不被裁切

### Requirement: Discoverable page navigation
頁面 SHALL 提供符合目前目的頁的文件標題，以及鍵盤跳到主要內容的入口。導覽後 SHALL 使新頁面位置可辨識，MUST NOT 在一般輸入、篩選或資料刷新時任意搶走焦點。

#### Scenario: 跳至內容與進入新頁
- **WHEN** 玩家使用鍵盤跳過重複頂列，然後進入新的目的頁
- **THEN** 可直接到達主要內容並辨識新頁；表單輸入及同頁刷新保持合理焦點
