# inventory-provenance Specification

## Purpose

定義角色當前持有物品與冒險歷史獲得紀錄的區別，確保玩家在整理背包時仍能查閱原始冒險收穫，並以明確的資料歸屬邊界避免物品被連結到其他角色或冒險。

## Requirements

### Requirement: Inventory categories and item records
系統 SHALL 以永久性魔法物品及消耗品兩類呈現倉庫；物品具有名稱、類型、數量及選填的稀有度、來源、備註，數量未提供時預設 1。由冒險或休整期變化建立的魔法物品 SHALL 顯示「冒險獲得」或「休整期獲得」來源標籤。新增時 SHALL 由目前分類帶入類型，名稱 MUST 非空白且不超過 255 字。

#### Scenario: 從消耗品分類新增
- **WHEN** 玩家從消耗品分類建立有效名稱的物品且未另設數量
- **THEN** 物品以消耗品類型、數量 1 出現在該角色倉庫

### Requirement: Historical loot independent of current inventory
冒險詳情 SHALL 顯示該次冒險的獲得快照；倉庫物品後續被刪除或減少數量 MUST NOT 改寫此歷史快照。

#### Scenario: 移除倉庫物品後查閱歷史
- **WHEN** 玩家刪除原本由冒險獲得的倉庫物品，再開啟該冒險詳情
- **THEN** 倉庫不再包含該物品，但冒險仍顯示當時獲得的名稱及數量

### Requirement: Inventory-derived current magic item count
角色目前魔法物品數 SHALL 為其倉庫內所有永久性魔法物品 `quantity` 的加總，MUST NOT 包含消耗品。倉庫新增、數量修改、刪除或冒險戰利品同步成功時，系統 SHALL 將重新計算的目前數量保存至 character，character-shell SHALL 顯示此值。後續倉庫異動 MUST NOT 改寫冒險歷史中的魔法物品快照。

#### Scenario: 永久物品按數量加總
- **WHEN** 倉庫有一筆數量 3 的永久性魔法物品、一筆數量 2 的永久性魔法物品及一筆數量 5 的消耗品
- **THEN** character 的目前魔法物品數及 character-shell 均顯示 5，而非資料列數 2 或包含消耗品的 10

#### Scenario: 移除永久物品同步目前數量
- **WHEN** 角色目前有 3 件永久性魔法物品，玩家從倉庫移除其中 1 件
- **THEN** character 的目前魔法物品數及 character-shell 更新為 2，相關冒險歷史快照仍保留原數量

#### Scenario: 消耗品異動不影響魔法物品數
- **WHEN** 玩家新增、使用或刪除消耗品，但永久性魔法物品沒有改變
- **THEN** character 的目前魔法物品數保持不變

### Requirement: Consistent provenance ownership
倉庫寫入若包含冒險或獲得快照關聯，系統 MUST 驗證角色、冒險與快照彼此一致。一般編輯省略關聯 ID SHALL 保留既有来源。

#### Scenario: 跨角色綁定
- **WHEN** 玩家將角色 A 的倉庫物品綁定至角色 B 的冒險或快照
- **THEN** 系統拒絕操作且保留原資料

#### Scenario: 只修改物品備註
- **WHEN** 玩家修改有來源關聯的物品備註且沒有提交關聯欄位
- **THEN** 更新備註但保留原冒險與快照關聯

### Requirement: Conservative legacy provenance matching
歷史倉庫資料補建快照時，系統 SHALL 僅接受同角色、未綁其他快照且屬於該冒險的物品；沒有冒險 ID 時 MUST 由來源精確且唯一匹配，禁止模糊認領。

#### Scenario: 相同來源對應多筆冒險
- **WHEN** 未綁定歷史物品的來源可對應同角色的兩筆冒險
- **THEN** 系統不自動認領或建立其快照關聯

### Requirement: Inventory date ordering
系統 SHALL 提供依取得時間由新到舊及由舊到新的排序切換，並在再次進入時保留使用者排序偏好。

#### Scenario: 保留排序方向
- **WHEN** 玩家改為取得時間由舊到新，離開後再次開啟倉庫
- **THEN** 倉庫使用已保存的排序選擇

### Requirement: Manual consumable quantity adjustment
玩家 SHALL 透過編輯倉庫物品手動調整消耗品數量；倉庫清單 MUST NOT 提供「使用 -1」快速扣減操作。需要從倉庫移除物品時，玩家 SHALL 使用明確的刪除操作。日常數量調整或刪除 MUST NOT 改寫來源冒險記錄的歷史獲得快照。

#### Scenario: 手動調整消耗品數量
- **WHEN** 玩家編輯倉庫中的消耗品並儲存新的數量
- **THEN** 倉庫顯示更新後的數量，來源冒險的歷史獲得數量保持不變

#### Scenario: 明確刪除消耗品
- **WHEN** 玩家使用刪除操作移除倉庫中的消耗品
- **THEN** 該物品自倉庫移除，來源冒險的歷史獲得快照保持不變

### Requirement: Editable historical loot
系統 SHALL 允許更正既有冒險戰利品的名稱、備註及消耗品獲得數量；既有快照 MUST NOT 僅因為是歷史項目而被鎖定為只能追加。更正歷史時，倉庫同步 SHALL 遵守下列差額與不補貨規則。

#### Scenario: 更正歷史戰利品名稱
- **WHEN** 玩家在已儲存冒險中修改一筆既有戰利品名稱並成功儲存
- **THEN** 冒險詳情顯示更新名稱，維持同一筆歷史項目身份，不視為新獲得物品

### Requirement: Loot corrections preserve inventory consumption
對已有獲得快照的戰利品，系統 SHALL 區分歷史獲得數量與目前持有數量。獲得數量不變時，修改冒險或物品的名稱、備註及重複儲存 MUST NOT 增加庫存或補建已移除的倉庫物品。消耗品獲得數量增加時，系統 SHALL 只將「新獲得數量減去原獲得數量」的正差額加入倉庫；對應倉庫項目已不存在時，只為此正差額建立物品。獲得數量減少時，系統 SHALL 依負差額扣減目前庫存，但庫存最低為 0；負差額超過目前庫存或對應物品已不存在時，歷史仍 SHALL 正常修正，不得阻止送出、建立負庫存或補建物品。成功儲存後再提交同一快照及相同數量 MUST NOT 重複入庫。

#### Scenario: 倉庫仍存在時修正獲得數量
- **WHEN** 冒險記錄獲得藥水 3 瓶、倉庫剩 1 瓶，玩家將同一筆獲得數量更正為 5 並儲存
- **THEN** 歷史顯示獲得 5 瓶，倉庫僅增加差額 2 瓶而成為 3 瓶

#### Scenario: 倉庫仍存在時只改備註
- **WHEN** 冒險記錄獲得藥水 3 瓶、倉庫剩 1 瓶，玩家只修改冒險備註並儲存
- **THEN** 倉庫仍為 1 瓶，歷史獲得數量仍為 3 瓶

#### Scenario: 刪除消耗品後只改備註不補貨
- **WHEN** 玩家已從倉庫刪除該冒險獲得的 3 瓶藥水，保留獲得快照，只修改來源冒險備註並儲存
- **THEN** 倉庫仍沒有該筆藥水，冒險歷史仍記錄獲得 3 瓶

#### Scenario: 刪除永久物品後更正名稱不補貨
- **WHEN** 玩家已從倉庫刪除某永久物品，再修改該冒險既有戰利品的名稱但未改變獲得數量並儲存
- **THEN** 歷史名稱更新，倉庫不重新出現該物品

#### Scenario: 倉庫已移除時僅補入新增差額
- **WHEN** 歷史獲得藥水 3 瓶、對應倉庫項目已移除，玩家將同一筆獲得數量更正為 5 並儲存
- **THEN** 歷史顯示獲得 5 瓶，倉庫建立對應物品且數量僅為 2 瓶

#### Scenario: 負差額超過目前庫存
- **WHEN** 歷史記錄獲得藥水 5 瓶、倉庫剩 2 瓶，玩家將同一筆獲得數量更正為 1 並儲存
- **THEN** 歷史顯示獲得 1 瓶，倉庫扣至 0；超出目前庫存的 2 瓶視為先前已使用或刪除，系統不阻止送出、不建立負庫存，也不補建物品

#### Scenario: 成功儲存後重複提交相同快照
- **WHEN** 上述 3 瓶更正為 5 瓶已成功儲存，玩家再次提交同一快照及相同數量
- **THEN** 倉庫維持前次結果，不增加數量或建立重複物品

### Requirement: New loot enters inventory
玩家在冒險中新建戰利品項目時，系統 SHALL 建立獲得快照並按該新項目的獲得數量入庫。限制既有快照自動補貨 MUST NOT 阻止真正的新戰利品入庫。

#### Scenario: 編輯冒險時追加新戰利品
- **WHEN** 玩家在既有冒險中新增一筆獲得 2 瓶藥水的戰利品並成功儲存
- **THEN** 新項目具有自己的獲得快照與對應的 2 瓶庫存，不復原其他已刪除的歷史物品

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
