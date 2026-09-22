# character-management Specification

## Purpose

定義玩家建立、瀏覽、修改及刪除個人角色檔案的基本行為，將角色身份資料與冒險歷程連結，提供手機與桌機一致的角色入口，以及能驗收的刪除影響範圍。

## Requirements

### Requirement: Character profile
系統 SHALL 讓玩家以角色名稱及種族建立角色，並接受選填的子職、派系及頭像。角色名稱及種族 MUST NOT 為空白，文字上限各為 100 字。

#### Scenario: 必填資料缺漏
- **WHEN** 玩家提交空白角色名稱或種族
- **THEN** 系統拒絕建立並指出缺漏欄位

#### Scenario: 建立而無冒險
- **WHEN** 玩家成功建立角色但尚未新增冒險
- **THEN** 玩家可進入該角色的空冒險列表並看見新增引導

### Requirement: Character collection navigation
系統 SHALL 以卡片呈現目前玩家的角色，顯示名稱、種族與職業資訊，並提供前往該角色冒險與倉庫的入口；無角色時 SHALL 顯示建立引導。

#### Scenario: 空角色列表
- **WHEN** 已登入玩家沒有任何角色
- **THEN** 系統顯示空狀態與建立角色按鈕

### Requirement: Edit character identity
系統 SHALL 允許玩家修改自己角色的名稱、種族、子職、派系及頭像；儲存後 SHALL 顯示更新資料。

#### Scenario: 修改角色名稱
- **WHEN** 玩家儲存有效的新角色名稱
- **THEN** 角色列表及角色頁下一次顯示資料時使用新名稱

### Requirement: Confirmed character deletion
刪除角色前，系統 SHALL 告知冒險與倉庫資料會連帶刪除且無法復原，並提供取消；確認後 SHALL 刪除該角色及其冒險、附屬活動、戰利品快照、故事獎勵與倉庫物品。

#### Scenario: 取消刪除
- **WHEN** 玩家於確認視窗選擇取消
- **THEN** 角色與所有附屬資料維持不變

#### Scenario: 確認刪除
- **WHEN** 玩家確認刪除自己的角色且操作成功
- **THEN** 返回角色列表，被刪角色及其附屬資料不可再存取，其他角色不受影響

### Requirement: Character creation baseline
建立角色時，系統 SHALL 以玩家設定的起始等級、職業、金幣及休整期作為開卡基準；開卡職業／等級 MUST 以非空白英文識別值保存，金幣與休整期未設定時預設為 0。開卡時已有的魔法物品 SHALL 以倉庫永久物品明細保存，不另以數量欄位重複保存。在新增第一筆冒險之前，角色目前狀態 SHALL 等於開卡基準與倉庫物品合計。

#### Scenario: 尚未登錄冒險的角色
- **WHEN** 玩家建立合計 5 等的角色，尚未新增任何冒險
- **THEN** 當前等級、職業、金幣與休整期顯示開卡設定；魔法物品數由倉庫永久物品數量加總

### Requirement: Editable opening baseline
角色 SHALL 能從 character-shell 的「編輯角色」入口修正開卡職業、等級、金幣及休整期基準。開卡物品 SHALL 經由同一角色的倉庫明細管理。沒有冒險紀錄時，儲存 SHALL 同步更新開卡基準與角色目前狀態；已有冒險紀錄時，系統 SHALL 先提供以新基準加總所有冒險變化後的目前狀態預覽，玩家確認後才儲存。此修正 SHALL 更新角色目前狀態，但 MUST NOT 改寫任何既有冒險快照或倉庫明細。取消確認 SHALL 不修改任何資料。

#### Scenario: 首筆冒險前修正開卡資料
- **WHEN** 角色尚無冒險紀錄，玩家將戰士 5 等改為野蠻人 1 等並儲存
- **THEN** 開卡基準與角色目前職業同步為 `Barbarian1`，下一筆冒險以野蠻人 1 等為初始狀態

#### Scenario: 有冒險時預覽並確認修正
- **WHEN** 角色已有冒險，玩家從角色編輯入口修正開卡基準
- **THEN** 儲存前顯示新基準加上所有冒險變化的預計目前值；玩家確認後角色目前值更新，既有冒險初始／變化／總計快照保持原樣

#### Scenario: 取消開卡修正
- **WHEN** 玩家查看預覽後取消修正
- **THEN** 開卡基準、角色目前值及所有歷史快照保持不變

### Requirement: Canonical class identifiers
角色開卡與目前職業資料 SHALL 以英文職業識別值保存及傳輸，例如 `Barbarian1`。前端 SHALL 依顯示對照表呈現玩家使用的中文名稱；新增或更新 API 收到既有中文別名時 SHALL 正規化為英文識別值，且不得將中文顯示文字寫入資料庫。

#### Scenario: 建立角色保存英文職業識別值
- **WHEN** 玩家以「野蠻人」建立 1 等角色
- **THEN** `initial_classes_string` 與 `current_classes_string` 保存 `Barbarian1`，前端仍顯示中文職業名稱

### Requirement: Adventure resource changes accumulate
角色建立時金幣與休整期可由玩家設定，未設定時預設為 0。每筆冒險只保存金幣與休整期的變化值；系統 SHALL 將所有冒險及休整期活動變化累加至開卡基準，不得把任何冒險的初始或總計快照重複加入當前資源。

#### Scenario: 第一筆冒險記錄資源變化
- **WHEN** 角色以金幣 0、休整期 0 建立後，第一筆冒險輸入金幣變化 +50 及休整期變化 +2 天
- **THEN** 當前金幣為 50，休整期為 2 天；該筆詳情保存初始 0、變化值及總計值

#### Scenario: 補登只累加資源變化
- **WHEN** 上述角色另補登較早日期的冒險，輸入金幣變化 +30 及休整期變化 +3 天
- **THEN** 當前金幣為 80、休整期為 5 天，不重複加入任何初始快照

刪除冒險時，系統 SHALL 只撤回該筆保存的金幣與休整期變化。開卡等級與職業不屬於冒險收益，不隨冒險刪除。

### Requirement: Accumulated current character state
系統 SHALL 將角色當前等級與各職業等級計算為開卡基準加上所有冒險輸入的等級／職業變化；當前金幣與休整期 SHALL 為開卡基準加上所有冒險及活動變化。每筆冒險 SHALL 保存當下初始值、變化值及總計值；所有冒險 SHALL 計入，不因遊玩日期先後而排除，亦不要求玩家選擇補登是否影響當前狀態。

#### Scenario: 補登等級變化計入當前角色
- **WHEN** 開卡為戰士 1 等，已有 9/18 等級變化 +4，再補登 9/1 等級變化 +1
- **THEN** 當前角色為戰士 6 等；新紀錄保存日期前初始、+1 變化及總計 2，9/18 原快照不重算

### Requirement: Unified current state source
系統 SHALL 將當前等級、職業、金幣、休整期及魔法物品數保存於角色資料，character-shell SHALL 讀取此一致來源，不得混用依遊玩日期最新冒險的結束值作為當前值。當前魔法物品數 SHALL 由倉庫永久魔法物品數量加總同步，不得累加歷史快照或包含消耗品。歷史快照 SHALL 與當前角色狀態分開呈現。

#### Scenario: 看板呈現累計而非最新日期快照
- **WHEN** 角色累計為 6 等，而遊玩日期最新的冒險總計快照為 5 等
- **THEN** character-shell 顯示 6 等及相符的當前職業配置，冒險詳情仍顯示該筆初始／變化／總計快照

### Requirement: Resource baseline restart after clearing adventures
當角色所有冒險皆已成功刪除，系統 SHALL 回到開卡職業、金幣及休整期基準；開卡時建立於倉庫的物品 SHALL 保留。此後新增冒險只從開卡基準累加其變化值，不沿用任何已刪除冒險的初始或總計快照。

#### Scenario: 清空後重新累加變化
- **WHEN** 開卡為戰士 5 等，所有冒險刪除後新增一筆金幣變化 +30、休整期變化 +2 天且未升級的冒險
- **THEN** character 為戰士 5 等、金幣為開卡金幣基準 +30、休整期為開卡基準 +2 天，不加回舊快照

#### Scenario: 新增紀錄只累加變化
- **WHEN** 既有冒險已使當前金幣 30、休整期 3 天，再新增金幣變化 +10、休整期變化 +1 天的冒險
- **THEN** character 金幣為 40、休整期為 4 天，只計入新紀錄的變化值
