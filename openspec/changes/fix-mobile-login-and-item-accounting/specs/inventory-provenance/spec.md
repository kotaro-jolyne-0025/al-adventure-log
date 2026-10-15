## MODIFIED Requirements

### Requirement: Optional single item category
系統 SHALL 為倉庫及冒險獲得物品提供選填的 `itemCategory`，每件物品最多一種，允許值為 `ARMOR`（護甲）、`POTION`（藥水）、`RING`（戒指）、`ROD`（權杖）、`SCROLL`（捲軸）、`STAFF`（法杖）、`WAND`（魔杖）、`WEAPON`（武器）、`WONDROUS_ITEM`（奇物）或 null。原有九種分類 SHALL 獨立於永久／消耗品類型、稀有度、同調與數量；原有九種選項 SHALL 對兩種物品類型開放。舊物品與既有待補物品 SHALL 保持未指定，不依名稱猜測分類。

#### Scenario: 保存分類
- **WHEN** 玩家新增一件分類為護甲的永久物品並重新載入
- **THEN** 物品回傳 ARMOR，介面顯示護甲，其他欄位按原規則保存

#### Scenario: 未指定與清除分類
- **WHEN** 玩家建立未指定分類的物品，或將既有分類清除為 null
- **THEN** 儲存成功，重新載入時分類仍為未指定

#### Scenario: 舊客戶端省略分類
- **WHEN** 新增或完整更新請求未提供 itemCategory
- **THEN** 請求仍可成功，分類依既有選填欄位的完整更新語意保存為 null

#### Scenario: 無效分類
- **WHEN** 倉庫、獲得物品或冒險完整儲存 API 收到不在清單中的分類值或多選陣列
- **THEN** 回傳 400 並且不保存此次請求的任何異動

### Requirement: Item category dropdown and display
倉庫新增／編輯、冒險新增／編輯中的永久物品與消耗品明細 SHALL 使用與稀有度一致的單選下拉選單，標示「類別」，選項以中文及官方英文名稱呈現：護甲 (Armor)、藥水 (Potion)、戒指 (Ring)、權杖 (Rod)、捲軸 (Scroll)、法杖 (Staff)、魔杖 (Wand)、武器 (Weapon)、奇物 (Wondrous Item)；並提供「未指定」清除選項。編輯時 SHALL 帶入已儲存值。倉庫清單與冒險詳情 SHALL 以純中文顯示已指定分類，未指定者不顯示分類標籤。下拉選單 SHALL 支援鍵盤操作且在手機寬度不造成橫向溢出。

#### Scenario: 切換單選
- **WHEN** 玩家先選武器再選法杖
- **THEN** 下拉選單僅保留法杖，儲存後僅保存 STAFF

#### Scenario: 冒險消耗品分類
- **WHEN** 玩家在冒險消耗品明細選擇藥水並保存
- **THEN** 再次編輯時選單顯示藥水，冒險詳情與入庫物品皆顯示藥水分類

## ADDED Requirements

### Requirement: Soul coin consumable category
倉庫與冒險消耗品明細 SHALL 提供獨立「靈魂幣」勾選框，保存 isSoulCoin，預設 false。標記 MUST 僅搭配 CONSUMABLE，API 與資料庫 MUST 拒絕永久物品勾選且完整回滾。勾選與取消 MUST NOT 自動帶入或改寫名稱、稀有度、分類、數量、來源、備註或敘述；系統 MUST NOT 新增充能追蹤。原有九種分類與 null SHALL 保持可用，SOUL_COIN MUST NOT 為新 API 或選單的類別。全站系統中文名稱 SHALL 統一為「靈魂幣」，已標記物品 SHALL 顯示唯讀靈魂幣標籤。切換永久類型 SHALL 清除標記並提示。

#### Scenario: 勾選與取消不改其他欄位
- **WHEN** 玩家勾選或取消靈魂幣
- **THEN** 只有標記改變，其餘欄位保持原值，重新載入顯示已保存狀態

#### Scenario: 永久物品不允許標記
- **WHEN** API 收到永久物品且 isSoulCoin 為 true
- **THEN** 拒絕整筆操作且不保存部分異動

#### Scenario: 舊靈魂幣分類轉換
- **WHEN** V27 轉換舊 SOUL_COIN 分類
- **THEN** 兩張物品表的標記改為 true、分類改為 null，制式舊名稱統一為靈魂幣，自訂名稱及其他資料保留；重跑不重複入庫，也不復原後續取消的標記

#### Scenario: 舊角色數量移轉
- **WHEN** 舊角色 soulCoins 正數經 V26 移轉後執行 V27
- **THEN** 移轉庫存為已標記的消耗品，總量守恆，角色手填欄位移除但 HUD 保留倉庫總量，舊角色 API 不允許直接建立第二套餘額

#### Scenario: 類型切換
- **WHEN** 玩家將已標記消耗品改為永久物品
- **THEN** 清除靈魂幣標記並提示，其他欄位保留

### Requirement: Soul coin quantity totals across records
同一冒險 SHALL 允許多筆已標記消耗品，每筆可有多枚。靈魂幣總量 SHALL 加總 CONSUMABLE 且 isSoulCoin 為 true 的 quantity，MUST NOT 依名稱、分類、稀有度、筆數或冒險次數判斷。單次冒險 SHALL 加總歷史獲得快照；目前剩餘總量 SHALL 僅在頂部角色 HUD 顯示，加總目前庫存且不受搜尋篩選影響；倉庫清單 MUST NOT 重複顯示靈魂幣總量。數量修改、移除、新增及標記變更後 SHALL 更新總量，倉庫日常操作 MUST NOT 改寫歷史。冒險明細更正標記 SHALL 同步仍存在庫存，數量不變時 MUST NOT 補貨或補建已移除物品。名稱及分類更正 SHALL 保留標記，快照與庫存關聯及差額同步規則 SHALL 保持一致。

#### Scenario: 多筆及不同分類加總
- **WHEN** 同一冒險有兩筆已標記消耗品，數量 1、2，名稱及分類不同，另有未標記數量 5 的消耗品
- **THEN** 歷史獲得及新增庫存總量為 3，永久物品數不變

#### Scenario: 倉庫取消標記保留歷史
- **WHEN** 玩家在倉庫取消上述數量 2 的標記
- **THEN** 目前總量為 1，歷史仍為 3，其他物品資料保留

#### Scenario: 刪除後重存不補貨
- **WHEN** 已標記的來源庫存已被刪除，玩家只改冒險標記或備註且獲得數量不變
- **THEN** 保存歷史更正，庫存不重新出現

#### Scenario: 目前總量僅由頂部看板追蹤
- **WHEN** 玩家查看角色倉庫
- **THEN** 頂部角色 HUD 顯示靈魂幣剩餘總量，倉庫標題下不再顯示重複總量，物品勾選與標籤保持可用
