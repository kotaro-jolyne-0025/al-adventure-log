# Spec Delta

## MODIFIED Requirements

### Requirement: Optional single item category
系統 SHALL 為倉庫及冒險獲得物品提供選填的 `itemCategory`，每件物品最多一種，允許值為 `ARMOR`（護甲）、`POTION`（藥水）、`RING`（戒指）、`ROD`（權杖）、`SCROLL`（捲軸）、`STAFF`（法杖）、`WAND`（魔杖）、`WEAPON`（武器）、`WONDROUS_ITEM`（奇物）或 null。分類 SHALL 獨立於永久／消耗品類型、稀有度、同調與數量；所有九種選項 SHALL 對兩種物品類型開放。舊物品與自動建立的待補物品 SHALL 保持未指定，不依名稱猜測分類。

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
倉庫新增／編輯、冒險新增／編輯中的永久物品與消耗品明細 SHALL 使用與稀有度一致的單選下拉選單，標示「類別」，依護甲 (Armor)、藥水 (Potion)、戒指 (Ring)、權杖 (Rod)、捲軸 (Scroll)、法杖 (Staff)、魔杖 (Wand)、武器 (Weapon)、奇物 (Wondrous Item) 順序提供雙語選項，並提供「未指定」清除選項。編輯時 SHALL 帶入已儲存值。倉庫清單與冒險詳情 SHALL 以中文顯示已指定分類，未指定者不顯示分類標籤。下拉選單 SHALL 支援鍵盤操作且在手機寬度不造成橫向溢出。

#### Scenario: 切換單選
- **WHEN** 玩家先選武器再選法杖
- **THEN** 下拉選單僅保留法杖，儲存後僅保存 STAFF

#### Scenario: 冒險消耗品分類
- **WHEN** 玩家在冒險消耗品明細選擇藥水並保存
- **THEN** 再次編輯時選單顯示藥水，冒險詳情與入庫物品皆顯示藥水分類

### Requirement: Inventory category pill labels
倉庫清單的永久物品與消耗品項目 SHALL 在稀有度附近以中文膠囊標籤顯示已指定分類；即使沒有稀有度，已指定的分類 SHALL 仍然顯示。分類膠囊 SHALL 為唯讀資訊，不作為選取或篩選按鈕。未指定分類 SHALL 不顯示膠囊或空白占位。分類、稀有度及其他既有標籤 SHALL 可同時顯示，手機版空間不足時 SHALL 換行而不溢出。

#### Scenario: 永久物品與消耗品顯示膠囊
- **WHEN** 倉庫有分類為武器的永久物品及分類為藥水的消耗品
- **THEN** 對應清單項目分別顯示「武器」及「藥水」膠囊，並保留各自既有標籤

#### Scenario: 無稀有度仍顯示分類
- **WHEN** 倉庫物品沒有稀有度但分類為奇物
- **THEN** 該清單項目仍顯示「奇物」膠囊

#### Scenario: 清除分類後移除膠囊
- **WHEN** 玩家清除物品分類並成功儲存後返回倉庫清單
- **THEN** 該項目不再顯示分類膠囊，其他標籤保持原本顯示規則

### Requirement: Category follows loot provenance rules
新戰利品入庫 SHALL 保存快照所選分類；更正冒險戰利品分類（含清除）SHALL 同步至仍存在的關聯倉庫物品。只改分類 MUST NOT 改變持有數量、補回已移除物品或修改來源關聯。倉庫自行修改分類 SHALL 僅影響倉庫，不回寫冒險歷史。因獲得數量正差額建立倉庫物品時 SHALL 採用更正後分類。

#### Scenario: 修正分類保留消耗數量
- **WHEN** 歷史獲得 3 件物品、倉庫剩 1 件，玩家只將冒險該物品分類由奇物改為魔杖
- **THEN** 歷史與倉庫分類皆為魔杖，歷史數量仍為 3、倉庫仍為 1

#### Scenario: 清除分類同步
- **WHEN** 玩家在冒險中將有關聯庫存的物品分類改為未指定
- **THEN** 快照與該庫存分類均為 null，數量保持不變

#### Scenario: 已移除物品不補回
- **WHEN** 倉庫已無該冒險物品，玩家只修改其歷史分類並重複保存
- **THEN** 歷史分類更新，倉庫仍無該物品

#### Scenario: 背包分類獨立修改
- **WHEN** 玩家在倉庫修改由冒險獲得物品的分類
- **THEN** 倉庫顯示新分類，冒險歷史保留原分類與來源關聯

#### Scenario: 正差額重建庫存
- **WHEN** 原獲得 3 件物品的庫存已移除，玩家將獲得數量改為 5 並分類為戒指
- **THEN** 僅建立數量 2、分類為戒指的對應庫存
