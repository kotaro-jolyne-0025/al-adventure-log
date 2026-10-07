# Spec Delta

## ADDED Requirements

### Requirement: Consistent readable theme semantics
系統 SHALL 在明暗主題中一致呈現主操作、稀有度、休整期、數量及故事獎勵的語意色。自訂次要說明、備註、搜尋 placeholder 與語意標籤文字 SHALL 在實際背景上保持至少 4.5:1 對比；同一主題的稀有度篩選與標籤 SHALL 使用相同文字色。

#### Scenario: 切換主題查看列表及詳情
- **WHEN** 玩家切換明暗主題查看冒險、角色及倉庫頁
- **THEN** 主操作及焦點使用同一主色來源，休整期維持綠色資源識別，語意文字與狀態區隨主題顯示，不殘留僅適用淺色的底色或文字

### Requirement: Direct access to complete list information
倉庫物品名稱／來源及角色頁名稱／資訊 SHALL 可換行閱讀全文，不依賴 Tooltip。長連續字串 SHALL 在手機及 200% 基準字級下保留在卡片內，編輯／刪除入口 SHALL 不被覆蓋。

#### Scenario: 長名稱與來源
- **WHEN** 玩家在 320／360／390 CSS 像素寬的手機查看含長中文或連續英文名稱、來源與角色資訊的頁面
- **THEN** 文字完整換行且沒有省略裁切，主要導覽與獨立操作仍可使用

### Requirement: Compact mobile character summary
手機角色摘要 SHALL 顯示等級獨立一列及金幣、休整期、永久物品、靈魂幣四項資源的兩欄排列；放大文字與長數值 SHALL 能換行，不減少既有五項資料。

#### Scenario: 查看手機資源摘要
- **WHEN** 玩家在不超過 600 CSS 像素寬的視窗查看角色頁
- **THEN** 等級位於資源上方，四項資源依既有順序呈現為 2×2，數值及單位不溢出

### Requirement: Reachable mobile adventure form actions
手機冒險表單 SHALL 在足夠高度時提供底部黏附儲存／取消列並避開安全區；短視窗 SHALL 回到文件流，以保留欄位操作空間。最後欄位 SHALL 可完整捲入視窗，操作列 SHALL 保留既有儲存禁用條件。

#### Scenario: 長表單與短視窗
- **WHEN** 玩家在寬度不超過 768 CSS 像素的手機捲動冒險表單，或視窗高度縮小到不超過 600 CSS 像素
- **THEN** 一般高度的操作列黏附底部，短視窗的操作列在表單末端可達；最後欄位、儲存與取消沒有互相遮擋

### Requirement: Stable loading and motion preferences
角色列表載入骨架 SHALL 沿用成品肖像尺寸、卡片外距及主要分區。載入與提交 SHALL 提供可辨識的文字進度。主要置中頁面及法律彈窗 SHALL 使用動態視窗高度；玩家偏好減少動態時 SHALL 停止骨架 pulse、位移回饋及持續轉動效果。

#### Scenario: 載入及減少動態
- **WHEN** 玩家載入角色列表或提交表單，且系統偏好減少動態
- **THEN** 骨架保留版面但不 pulse，操作進度仍有文字，卡片位移與 spinner 轉動停止

#### Scenario: 較短的瀏覽器可用視窗
- **WHEN** 玩家在手機開啟首頁、驗證頁或法律彈窗並改變可用視窗高度
- **THEN** 頁面依動態高度排列，長內容與彈窗操作可透過正常捲動取得
