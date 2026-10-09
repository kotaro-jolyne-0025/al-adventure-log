# Spec Delta

## MODIFIED Requirements

### Requirement: Compact mobile character summary
手機角色摘要 SHALL 顯示等級獨立一列及金幣、休整期、永久物品、靈魂幣四項資源的兩欄排列；放大文字與長數值 SHALL 能換行，不減少既有五項資料。在不超過 600 CSS 像素的新增／編輯冒險及物品、編輯角色子頁，角色資源 SHALL 預設收合並提供可辨識、可用鍵盤與觸控展開的入口；展開後 SHALL 顯示上述完整摘要。601 CSS 像素以上 SHALL 維持原有摘要呈現。

#### Scenario: 查看手機資源摘要
- **WHEN** 玩家在不超過 600 CSS 像素寬的視窗查看角色的冒險或倉庫列表
- **THEN** 等級位於資源上方，四項資源依既有順序呈現為 2×2，數值及單位不溢出

#### Scenario: 手機表單查看角色資源
- **WHEN** 玩家在手機新增或編輯冒險或物品，或編輯角色
- **THEN** 角色身分資訊顯示，資源摘要預設收合；玩家能展開閱讀五項資料並收合，不改變表單輸入

#### Scenario: 桌機表單摘要
- **WHEN** 玩家在 601 CSS 像素以上的視窗開啟上述子頁
- **THEN** 完整角色摘要依原版面呈現，不顯示手機展開入口

## ADDED Requirements

### Requirement: Compact mobile typography and list controls
在不超過 600 CSS 像素的視窗，主要列表及表單標題 SHALL 使用 1–1.0625rem 的字級，冒險卡名稱 SHALL 使用 1rem；手機輸入文字 SHALL 保持至少 16 CSS 像素。冒險及倉庫列表 SHALL 優先將標題與有明確文字的新增入口安排在同一列，保留獨立排序、搜尋、原有行為及可見鍵盤焦點。放大文字時 SHALL 允許換行及增高，操作高度 SHALL 至少 44 CSS 像素。601 CSS 像素以上 SHALL 維持原有字級及控制項排列。

#### Scenario: 手機查閱與新增
- **WHEN** 玩家在 320／360／390 CSS 像素的視窗查看冒險或倉庫
- **THEN** 標題與新增入口同行，搜尋／排序可操作，主要內容無水平裁切；搜尋輸入文字至少 16px

#### Scenario: 放大文字操作列表
- **WHEN** 玩家將手機基準字級放大至 200%
- **THEN** 工具列可換行並自然增高，文字與操作不重疊或裁切，新增按鈕有可見焦點

### Requirement: Complete mobile adventure headings
手機冒險卡的名稱、代碼與 DM SHALL 支援長中文及連續英文換行，保留在卡片可用寬度內；不得藉由隱藏水平溢出裁切必要文字。

#### Scenario: 長冒險識別資訊
- **WHEN** 玩家在 320／390 CSS 像素的手機查看具有長名稱、代碼或 DM 的冒險
- **THEN** 名稱、代碼與 DM 完整換行且不遮住卡片導覽或資源資訊
