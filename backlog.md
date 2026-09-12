# D&D 冒險日誌 — 工作 Backlog

## 🚀 新 Session 啟動指引（給 AI 看）

每次新對話開始，只需讀這個檔案。不要主動掃描整個專案。

**執行工作前，只讀取該工作項目「需要讀取的檔案」欄位所列的檔案。**

## 🎯 AI 角色定義

**你是這個專案的 PM（產品經理）**，不只是執行者。你需要：
- 每次需求變更時，主動判斷哪些文件需要更新（User Stories、SRS、database-schema、backlog）
- 有規格不清楚時，主動提問，確認後再動手
- 發現設計矛盾或潛在問題時，主動提出，不要默默略過
- 開始實作前，先確認規格文件已同步更新

---

## 專案快速背景

| 項目 | 內容 |
|---|---|
| **目的** | D&D 冒險聯盟（AL）紙本記錄表數位化 PWA |
| **前端** | Angular 22 + Angular Material → `frontend/src/app/` |
| **後端** | Spring Boot 4.1 (Java 17) → `backend/src/main/java/com/dndadvlog/backend/` |
| **資料庫** | PostgreSQL on Supabase |
| **部署** | 前端 + 後端皆部署至 Zeabur |
| **詳細計畫** | `dnd-adv-log-plan.md` |
| **資料庫 Schema** | `database-schema.md` |
| **系統需求** | `system-requirements-spec.md` |

---

## 工作項目清單

### T01 — 子任務 1：專案初始化（monorepo + Angular + Spring Boot）
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 1
- **備註：** monorepo 結構已建立，前後端框架已生成

---

### T02 — 子任務 2：資料庫 Schema 與 Supabase 設定
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 2
- **備註：** Schema 已設計，JPA Entity 已建立，Spring Boot 連線設定完成

---

### T03 — 子任務 3：後端 REST API（Spring Boot）
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 3
- **需要讀取的檔案：**
  - `backend/src/main/java/com/dndadvlog/backend/controller/` 下各 Controller
  - `backend/src/main/java/com/dndadvlog/backend/service/` 下各 Service
  - `backend/src/main/java/com/dndadvlog/backend/dto/` 下各 DTO
  - `backend/src/main/java/com/dndadvlog/backend/entity/` 下各 Entity
- **待完成項目：**
  - [ ] 確認 CharacterController / AdventureEntryController 端點完整
  - [ ] 確認自動帶入邏輯（starting_gold / starting_downtime / starting_magic_items）
  - [ ] 輸入驗證（@Valid）
  - [ ] 全域例外處理器（@ControllerAdvice）
  - [ ] CORS 設定

---

### T04 — 子任務 4：前端角色管理（Angular）
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 4
- **需要讀取的檔案：**
  - `frontend/src/app/features/characters/` 整個目錄
  - `frontend/src/app/core/services/character.service.ts`
  - `frontend/src/app/core/models/character.model.ts`
  - `frontend/src/app/app.routes.ts`

---

### T05 — 子任務 5：前端冒險日誌 CRUD（Angular）
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 5
- **需要讀取的檔案：**
  - `frontend/src/app/features/adventures/` 整個目錄
  - `frontend/src/app/core/services/adventure.service.ts`
  - `frontend/src/app/core/models/adventure.model.ts`
  - `frontend/src/app/app.routes.ts`
- **備註（方案 C 物品解耦）：** 新增冒險時自動同步寫入倉庫；編輯冒險時不覆寫倉庫現有庫存（保護玩家在倉庫已消耗/使用的道具數據）。

---

### T06 — 子任務 6：PWA 設定與離線支援
- **狀態：** `[x] 已完成`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 6
- **需要讀取的檔案：**
  - `frontend/ngsw-config.json`
  - `frontend/public/manifest.webmanifest`
  - `frontend/angular.json`（只看 build 設定段落）
- **完成摘要：**
  - `manifest.webmanifest`：name 改為「D&D 冒險日誌」、short_name「冒險日誌」、加上 theme_color (#7b1fa2) / background_color (#1a1a2e) / lang / description
  - `ngsw-config.json`：新增 Google Fonts 快取群組（assetGroups）、新增 API GET 快取策略 `dataGroups`（`/api/**`，freshness 策略，5s timeout，1 天 TTL）
  - `index.html`：新增 `<meta name="theme-color" content="#7b1fa2" />`
  - `angular.json`：調寬 budget 限制（initial warning 1MB / error 2MB），避免 Angular Material 觸發 build error
  - production build 驗證通過：`ngsw-worker.js`、`ngsw.json`、`manifest.webmanifest` 全部正確生成

---

### T07 — 子任務 7：部署至 Zeabur（方案 A：後端原生 + 前端 Nginx 反代）
- **狀態：** `[x] 已完成（檔案準備完畢）`
- **對應計畫：** `dnd-adv-log-plan.md` 子任務 7
- **需要讀取的檔案：**
  - `frontend/Dockerfile`
  - `frontend/nginx.conf`
  - `backend/src/main/resources/application.properties`
  - `backend/src/main/java/com/dndadvlog/backend/WebConfig.java`
- **完成摘要：**
  - 後端移除 `Dockerfile`，由 Zeabur 以 Maven 原生自動建置，僅開內網存取（安全且簡潔）。
  - 前端建立 `frontend/Dockerfile` + `nginx.conf`，透過 `envsubst` 讀取 Zeabur 的 `BACKEND_URL` 環境變數，將 `/api` 請求在內部反向代理給後端。
  - `backend/src/main/java/com/dndadvlog/backend/WebConfig.java`：支援以逗號分隔的多個 `CORS_ALLOWED_ORIGIN` 網址。
  - `frontend/src/environments/environment.prod.ts`：維持 `apiUrl: '/api'` 相對路徑。
- **Zeabur 部署步驟（手動操作）：**
  1. git commit + push 所有變更到 GitHub。
  2. 登入 Zeabur → 進入專案。
  3. 新增後端 Service → 連結 GitHub repo → 指定 `backend/` 子目錄（自動以 Java 17 + Maven 原生建置）。
  4. 在後端 Service 的「Variables」設定環境變數：
     - `DB_URL` = `jdbc:postgresql://<supabase-host>:5432/postgres`
     - `DB_USERNAME` = `postgres.<id>`
     - `DB_PASSWORD` = 你的 Supabase 資料庫密碼
  5. 複製後端 Service 的「內網網址」（例如 `http://dnd-adventure-log-sideproject.zeabur.internal:8080`），**後端無需開公網**。
  6. 新增前端 Service → 連結 GitHub repo → 指定 `frontend/` 子目錄（Zeabur 自動以 `frontend/Dockerfile` 建置）。
  7. 在前端 Service 的「Variables」設定：
     - `BACKEND_URL` = `http://dnd-adventure-log-sideproject.zeabur.internal:8080`
  8. 為前端 Service 設定公開網域（例如 `https://adv-log.zeabur.app`）。

---

---

### T08 — 功能變更：職業固定選項 + 等級追蹤 + 合計自動計算
- **狀態：** `[x] 已完成`
- **規格文件：** 已更新（user-stories.md、system-requirements-spec.md、database-schema.md）
- **變更摘要：**
  1. 職業改為固定下拉選單（13選項 + 其他＋自訂輸入）
  2. adventure_entry 新增 starting_level / ending_level 欄位
  3. 新增記錄時起始值自動帶入（等級/金幣/休假/魔法物品）
  4. 合計欄位由後端計算，前端唯讀
  5. 角色卡顯示目前等級（最後一筆記錄的 ending_level）
- **需要讀取的檔案：**
  - `system-requirements-spec.md`（看第 2.1、2.2、3.3 節）
  - `database-schema.md`（看 Step 2、Step 3）
- **完成項目（後端）：**
  - [x] `adventure_entry` 表 Migration SQL 已在 database-schema.md 備妥（需在 Supabase 執行）
  - [x] `AdventureEntry` Entity 新增 startingLevel / endingLevel 欄位
  - [x] `AdventureEntryRequest` 移除 goldTotal / downtimeTotal / magicItemsTotal 輸入欄位
  - [x] `AdventureEntryService` 實作合計計算邏輯（calcTotal / calcTotalInt）
  - [x] 新增 `GET /characters/{id}/entries/defaults` 端點
  - [x] `CharacterResponse` 新增 currentLevel；CharacterService 計算最後一筆 endingLevel
- **完成項目（前端）：**
  - [x] 職業表單欄位改為 `<mat-select>`，選項對應固定清單（14 選項）
  - [x] 選「其他」時顯示自由文字輸入框（customClassName）
  - [x] adventure-form 新增起始等級 / 結束等級欄位
  - [x] adventure-form 新增記錄時呼叫 `/entries/defaults` 預填起始值
  - [x] 金幣合計 / 休假合計 / 魔法物品合計改為 computed signal（即時顯示，不可輸入）
  - [x] adventure-detail 基本資訊區塊新增起始等級 / 結束等級顯示
  - [x] character-list 卡片新增目前等級 Lv.X 顯示
- **備註：** 請到 Supabase SQL Editor 執行 database-schema.md Step 3 的 ALTER TABLE 語句

---

### T09 — 功能變更：起始等級來源改為職業等級加總
- **狀態：** `[x] 已完成`
- **變更摘要：**
  - 新增冒險記錄時，`startingLevel` 預填值改為從 `character_class_level` 表的等級加總（例如聖騎士6＋術士4＝10），取代原本「前一筆 ending_level」的做法
- **完成項目：**
  - [x] `CharacterRepository` 新增 `sumClassLevelsByCharacterId()` JPQL 加總查詢
  - [x] `AdventureEntryService.getDefaults()` 改為讀取職業等級加總作為 `startingLevel`（加總為 0 時不設值）

---

### T10 — 功能變更：三種資源各新增「休整期變化」欄位
- **狀態：** `[x] 已完成`
- **變更摘要：**
  - 金幣、休整期天數、魔法物品各自新增一個「休整期變化」欄位
  - 合計公式改為：`合計 = 起始 + 冒險中變化 + 休整期變化`
  - 表單分兩區塊顯示：冒險中資源 / 休整期資源
  - 前端「休假天數」文字全面改為「休整期天數」
- **資料庫 Migration（需在 Supabase 執行）：**
  ```sql
  ALTER TABLE adventure_entry
      ADD COLUMN IF NOT EXISTS gold_downtime_change DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS downtime_downtime_change INTEGER,
      ADD COLUMN IF NOT EXISTS magic_items_downtime_change INTEGER;
  ```
- **影響範圍：**
  - DB：`adventure_entry` 新增三欄
  - 後端 Entity / Request / Response / Service（合計計算邏輯）
  - 前端 Model / Form / Detail
- **需要讀取的檔案：**
  - `database-schema.md`
  - `system-requirements-spec.md`
  - `backend/src/main/java/com/dndadvlog/backend/entity/AdventureEntry.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryRequest.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryResponse.java`
  - `backend/src/main/java/com/dndadvlog/backend/service/AdventureEntryService.java`
  - `frontend/src/app/core/models/adventure.model.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.html`
  - `frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.html`
- **完成項目（後端）：**
  - [x] `AdventureEntry` Entity 新增 `goldDowntimeChange` / `downtimeDowntimeChange` / `magicItemsDowntimeChange`
  - [x] `AdventureEntryRequest` 新增三個休整期變化欄位
  - [x] `AdventureEntryResponse` 新增三個休整期變化欄位
  - [x] `AdventureEntryService.mapRequestToEntry()` 更新合計計算：`合計 = 起始 + 冒險變化 + 休整期變化`
  - [x] 更新 `database-schema.md` 加入三個新欄位定義（含 Migration 2 ALTER TABLE SQL）
- **完成項目（前端）：**
  - [x] `adventure.model.ts` 新增三個休整期變化欄位
  - [x] `adventure-form.component.ts` 表單新增三個控制項；computed 合計更新為三項加總
  - [x] `adventure-form.component.html` 資源變動區塊新增標題列，每列新增「休整期變化」欄位
  - [x] `adventure-detail.component.html` 資源表格新增「冒險中變化」＋「休整期變化」兩欄
  - [x] 全前端「休假天數」文字改為「休整期天數」
- **備註：** 請到 Supabase SQL Editor 執行 database-schema.md Migration 2（T10）的 ALTER TABLE 語句

---

### T12 — 功能變更：冒險結束升級流程

- **狀態：** `[x] 已完成`
- **變更摘要：**
  - 在冒險表單「起始等級」欄位旁，新增「本次冒險升級」Slide Toggle
  - Toggle 開啟後，顯示「升哪個職業」下拉選單，直接列出完整職業清單（CLASS_OPTIONS，共 13 個固定職業 + 其他）
  - 若選擇的職業角色已有，則該職業等級 +1；若角色尚無該職業，則新增並從 1 級開始
    - 範例：原本法師2、戰士2。選「法師」→ 法師3、戰士2；選「聖騎士」→ 法師2、戰士2、聖騎士1
  - 結束等級改為唯讀，由系統自動計算：`startingLevel + (levelUp ? 1 : 0)`
  - 儲存冒險記錄時，同步更新 `character_class_level` 表
  - 升級職業名稱記錄在冒險記錄上（新欄位 `level_up_class_name`），供編輯時還原
- **資料庫 Migration（需在 Supabase 執行）：**
  ```sql
  ALTER TABLE adventure_entry
      ADD COLUMN IF NOT EXISTS level_up_class_name VARCHAR(100);
  ```
- **影響範圍：**
  - DB：`adventure_entry` 新增 `level_up_class_name` 欄位
  - 後端 Entity / Request / Response / Service（建立＆更新時同步更新角色職業等級）
  - 前端 Model / Form（升級 UI 邏輯）/ Detail（顯示升級職業）
- **需要讀取的檔案：**
  - `database-schema.md`
  - `backend/src/main/java/com/dndadvlog/backend/entity/AdventureEntry.java`
  - `backend/src/main/java/com/dndadvlog/backend/entity/Character.java`
  - `backend/src/main/java/com/dndadvlog/backend/entity/CharacterClassLevel.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryRequest.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryResponse.java`
  - `backend/src/main/java/com/dndadvlog/backend/repository/CharacterRepository.java`
  - `backend/src/main/java/com/dndadvlog/backend/service/AdventureEntryService.java`
  - `frontend/src/app/core/models/adventure.model.ts`
  - `frontend/src/app/core/models/character.model.ts`
  - `frontend/src/app/core/services/character.service.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.html`
  - `frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.html`
  - `frontend/src/app/features/characters/character-form/character-form.component.ts`（參考 CLASS_OPTIONS 清單）
- **完成項目（後端）：**
  - [x] `AdventureEntry` Entity 新增 `levelUpClassName` 欄位（`VARCHAR(100)`）
  - [x] `AdventureEntryRequest` 新增 `levelUpClassName` 欄位
  - [x] `AdventureEntryResponse` 新增 `levelUpClassName` 欄位
  - [x] `AdventureEntryService.createEntry()` 儲存記錄時：若有 `levelUpClassName`，找 `character_class_level` 中同名職業 → `level + 1`；若不存在則新增一筆 `{className, level: 1}`
  - [x] `AdventureEntryService.updateEntry()` 更新記錄時：若 `levelUpClassName` 有變動，先撤回舊職業（`level - 1`，降為 0 則移除該筆），再套用新職業（+1 或新增）；若新值為空則只撤回
  - [x] 更新 `database-schema.md` 加入新欄位定義（含 Migration 3 ALTER TABLE SQL）
- **完成項目（前端）：**
  - [x] `adventure.model.ts` 的 `AdventureEntry` 與 `AdventureEntryRequest` 新增 `levelUpClassName` 欄位
  - [x] `adventure-form.component.ts`：新增 `levelUp` signal、`CLASS_OPTIONS`、`characterClassLevels` signal；`endingLevel` 改為 computed；`buildRequest()` 回填 computed 結果
  - [x] `adventure-form.component.html`：起始等級旁新增 Slide Toggle；Toggle 開啟時顯示升級職業選單（含等級提示）；結束等級改為唯讀 computed 顯示
  - [x] `adventure-detail.component.html` 基本資訊區新增「升級職業」顯示欄（有值才顯示）
- **備註：** 請到 Supabase SQL Editor 執行 database-schema.md Migration 3（T12）的 ALTER TABLE 語句
- **升級邏輯說明：**
  - 下拉選項顯示規則：查詢角色目前職業清單 → CLASS_OPTIONS 每一項若角色已有則顯示「職業（目前 Lv.X）」，否則顯示「職業（新職業）」
  - 後端 createEntry：找 `character.classLevels` 中 `className == levelUpClassName` → `level++`；找不到 → 新增 `{className, level: 1, sortOrder: 現有數量}`
  - 後端 updateEntry（levelUpClassName 有變動）：舊值不空 → 舊職業 `level--`（若降為 0 從清單移除）；新值不空 → 新職業 `level++`（若不存在則新增）

---

### T11 — 功能變更：角色表單玩家名稱預設帶入「可嵐」
- **狀態：** `[x] 已完成`
- **變更摘要：**
  - 建立角色時，「玩家名稱」欄位預設值帶入「可嵐」，使用者可手動修改
  - 無任何帳號/登入流程（MVP 單人版）
- **完成項目：**
  - [x] `character-form.component.ts` `playerName` 初始值改為 `'可嵐'`

---

### T13 — 功能優化：表單 UX 三項改善

- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. 起始等級改為唯讀（由 defaults API 自動帶入，不可手動輸入）
  2. 升級 Toggle 開啟時，自動帶入角色第一個職業作為預設升級職業
  3. 休整期活動整合進冒險記錄表單（新增／編輯皆可在表單內管理活動，不再需要跳至 detail 頁操作）
- **影響範圍：** 純前端，不涉及後端 API 變更
- **需要讀取的檔案：**
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.html`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.scss`
  - `frontend/src/app/core/services/adventure.service.ts`
  - `frontend/src/app/core/models/adventure.model.ts`
- **完成項目：**
  - [x] **起始等級唯讀（adventure-form）**
    - `startingLevel` 欄位從 `<input type="number">` 改為唯讀顯示（同 `ending-level-display` 的靜態卡片樣式）
    - FormGroup 移除 `startingLevel` 控制項；`_startingLevel` signal 直接由 defaults 或 loadEntry 時設值
    - `buildRequest()` 中 `startingLevel` 直接讀 `this._startingLevel()` 而非 `raw.startingLevel`
  - [x] **升級 Toggle 自動帶入預設職業（adventure-form）**
    - `onLevelUpToggle(true)` 時：若 `characterClassLevels()` 非空，自動 `form.get('levelUpClassName')!.setValue(characterClassLevels()[0].className)`
  - [x] **休整期活動整合進表單（adventure-form）**
    - 新增 `pendingActivities` signal（`string[]`，新增模式暫存用）
    - 新增 `existingActivities` signal（`DowntimeActivity[]`，編輯模式顯示用，初始從 `entry.downtimeActivities` 讀取）
    - 新增 `newActivityText` 本地變數（輸入列用）
    - 表單最下方加入「🏕️ 休整期活動」卡片區塊：
      - 顯示現有活動（編輯模式）或暫存活動（新增模式），每筆旁有刪除按鈕
      - 底部輸入列 + 「＋ 新增」按鈕
    - **新增模式**：按「＋」→ 推入 `pendingActivities`；刪除 → 從 array 移除（不呼叫 API）；主記錄儲存成功後，依序呼叫 `addDowntime()` 將 pendingActivities 全部 POST 到後端
    - **編輯模式**：按「＋」→ 立即呼叫 `addDowntime()` 並更新 `existingActivities`；刪除 → 立即呼叫 `deleteDowntime()` 並更新 `existingActivities`
    - `loadEntry()` 時將 `entry.downtimeActivities` 設入 `existingActivities`
- **設計備註：**
  - `adventure-detail` 頁面的休整期活動區塊**保留不動**（仍可在 detail 頁操作），不需移除
  - 唯讀起始等級樣式建議與「結束等級」的 `.ending-level-display` 保持一致

---

### T14 — 功能優化與迎頭趕上升級

- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. 資源起始值預設為 0（第一筆記錄時不顯示空白）
  2. 冒險詳情頁（detail）改為純唯讀，移除休整期活動的新增與刪除操作
  3. 冒險升級職業選項標籤修正：改為「職業（Lv.X）」顯示角色當前等級，不再說「目前」以避免編輯舊紀錄時誤導
  4. 新增「迎頭趕上」升級功能：消耗休整期天數升額外等級，可選職業與次數
- **影響範圍：**
  - DB：`adventure_entry` 新增 `catchup_class_name` / `catchup_count` 兩欄
  - 後端 Entity / Request / Response / Service（建立＆更新時同步更新角色職業等級）
  - 前端 Model / Form（迎頭趕上 UI）/ Detail（移除新增/刪除）
- **資料庫 Migration（需在 Supabase 執行）：**
  ```sql
  ALTER TABLE adventure_entry
      ADD COLUMN IF NOT EXISTS catchup_class_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS catchup_count INTEGER DEFAULT 0;
  ```
- **需要讀取的檔案：**
  - `database-schema.md`
  - `backend/src/main/java/com/dndadvlog/backend/entity/AdventureEntry.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryRequest.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryResponse.java`
  - `backend/src/main/java/com/dndadvlog/backend/service/AdventureEntryService.java`
  - `frontend/src/app/core/models/adventure.model.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.ts`
  - `frontend/src/app/features/adventures/adventure-form/adventure-form.component.html`
  - `frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.ts`
  - `frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.html`
- **待完成項目：**
  - [ ] **T14-1：起始值預設 0（前端）**
    - `loadDefaults()` 中 `startingGold / startingDowntime / startingMagicItems` 改為 `d.startingGold ?? 0`（等）
    - 確保第一筆記錄不出現空白起始值
  - [ ] **T14-2：detail 頁改為純唯讀（前端）**
    - 移除「新增活動」按鈕、Dialog template、`onAddDowntime()` / `onSaveDowntime()` 方法
    - 移除每筆活動旁的刪除按鈕、`onDeleteDowntime()` 方法
    - 清除不再需要的 `showDowntimeDialog` signal 與 `newDowntimeText` 變數
  - [ ] **T14-3：職業選項標籤修正（前端）**
    - `getClassLabel()` 改為：已有職業顯示 `職業（Lv.X）`；新職業顯示 `職業（新職業）`
    - 移除「目前」二字，以當前值為準，不宣稱是「目前」
  - [ ] **T14-4：迎頭趕上升級（前後端）**
    - **後端 Entity**：`AdventureEntry` 新增 `catchupClassName VARCHAR(100)` / `catchupCount INTEGER`
    - **後端 Request**：`AdventureEntryRequest` 新增 `catchupClassName` / `catchupCount`
    - **後端 Response**：`AdventureEntryResponse` 新增 `catchupClassName` / `catchupCount`
    - **後端 Service `createEntry()`**：若 `catchupClassName` 不為空且 `catchupCount > 0`，對該職業 `level += catchupCount`（不存在則新增，level 從 catchupCount 開始）
    - **後端 Service `updateEntry()`**：若 `catchupClassName` 或 `catchupCount` 有變動，先撤回舊值（`level -= oldCatchupCount`，降為 0 則移除該筆），再套用新值
    - **後端 `endingLevel` 計算**：`endingLevel = startingLevel + (levelUp ? 1 : 0) + (catchupCount ?? 0)`
    - **前端 Model**：`AdventureEntry` / `AdventureEntryRequest` 新增 `catchupClassName` / `catchupCount`
    - **前端 Form TS**：新增 `catchup` signal（`boolean`）；新增 form 控制項 `catchupClassName` / `catchupCount`；`endingLevel` computed 更新為 `startingLevel + (levelUp?1:0) + (catchup() ? catchupCount : 0)`；`onCatchupToggle(false)` 清除兩個欄位；`loadEntry()` 時若有值則開啟 toggle
    - **前端 Form HTML**：在「本次冒險升級」區塊下方新增「迎頭趕上」Slide Toggle；開啟後顯示「升哪個職業（CLASS_OPTIONS 下拉）」與「升幾等（數字輸入, min:1）」；加上提示文字「消耗天數請在上方休整期天數欄自行填寫」
    - **更新 `database-schema.md`**：加入新欄位定義與 Migration 4 SQL
- **升級邏輯說明：**
  - `levelUp`（冒險升級）與 `catchup`（迎頭趕上）可同時存在，職業可相同或不同
  - 後端 createEntry 迎頭趕上：找 `character.classLevels` 中 `className == catchupClassName` → `level += catchupCount`；找不到 → 新增 `{className, level: catchupCount, sortOrder: 現有數量}`
  - 後端 updateEntry 迎頭趕上（有變動）：舊值不空 → 舊職業 `level -= oldCatchupCount`（降為 0 則移除）；新值不空 → 新職業 `level += newCatchupCount`（不存在則新增）

---

### T15 — 功能強化：職業快照 + 當前等級準確追蹤

- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. 新增 `adventure_entry_class_snapshot` 關聯表，儲存每筆冒險記錄的起始/結束職業快照
  2. 冒險記錄存入時（create/update），後端自動寫入 starting/ending 快照
  3. detail 頁「起始等級」區改為顯示 starting 職業快照（`職業 Lv.X / 職業 Lv.Y`）
  4. detail 頁「結束等級」區改為顯示 ending 職業快照（同格式，已含冒險升級＋迎頭趕上）
  5. 角色卡「當前等級」改從 `character_class_level` 加總計算（不再依賴 `endingLevel` 欄位）
- **資料庫 Migration（需在 Supabase 執行）：**
  ```sql
  CREATE TABLE IF NOT EXISTS adventure_entry_class_snapshot (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      adventure_entry_id UUID NOT NULL REFERENCES adventure_entry(id) ON DELETE CASCADE,
      snapshot_type VARCHAR(10) NOT NULL,  -- 'starting' 或 'ending'
      class_name VARCHAR(100) NOT NULL,
      level INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0
  );
  ```
- **影響範圍：**
  - DB：新增 `adventure_entry_class_snapshot` 表
  - 後端 Entity / Repository / Service（快照寫入邏輯）/ Response DTO（帶出快照資料）
  - 前端 Model / Detail HTML（起始/結束等級改為清單顯示）
  - 前端 Character List（currentLevel 改用 classLevels 加總）
- **需要讀取的檔案：**
  - `database-schema.md`
  - `backend/src/main/java/com/dndadvlog/backend/entity/AdventureEntry.java`
  - `backend/src/main/java/com/dndadvlog/backend/entity/Character.java`
  - `backend/src/main/java/com/dndadvlog/backend/entity/CharacterClassLevel.java`
  - `backend/src/main/java/com/dndadvlog/backend/dto/AdventureEntryResponse.java`
  - `backend/src/main/java/com/dndadvlog/backend/service/AdventureEntryService.java`
  - `backend/src/main/java/com/dndadvlog/backend/service/CharacterService.java`
  - `frontend/src/app/core/models/adventure.model.ts`
  - `frontend/src/app/core/models/character.model.ts`
  - `frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.html`
  - `frontend/src/app/features/characters/character-list/character-list.component.html`
- **完成項目：**
  - [x] **DB**：建立 `adventure_entry_class_snapshot` 表（Migration 5 SQL，需在 Supabase 執行）
  - [x] **後端 Entity**：新增 `AdventureEntryClassSnapshot` Entity；`AdventureEntry` 新增 `startingClassSnapshot` / `endingClassSnapshot` OneToMany 關聯（使用 `@SQLRestriction` 依 snapshot_type 過濾）
  - [x] **後端 Repository**：新增 `AdventureEntryClassSnapshotRepository`（含按 entryId + type 刪除的 JPQL）
  - [x] **後端 Response DTO**：`AdventureEntryResponse` 新增 `startingClassSnapshot` / `endingClassSnapshot`（`List<ClassSnapshotItem>`，含內部靜態類別）
  - [x] **後端 Service `createEntry()`**：先儲存 entry 取得 ID → 寫 starting 快照 → applyLevelUp/applyCatchup → 寫 ending 快照
  - [x] **後端 Service `updateEntry()`**：先 revert 舊升級 → 刪除舊 starting 快照 → 寫新 starting 快照 → apply 新升級 → 刪除舊 ending 快照 → 寫新 ending 快照
  - [x] **後端 `CharacterService`**：`currentLevel` 改由 `classLevels` stream mapToInt 加總，不再讀最後一筆 `endingLevel`
  - [x] **前端 Model**：`adventure.model.ts` 新增 `ClassSnapshotItem` 介面；`AdventureEntry` 新增 `startingClassSnapshot` / `endingClassSnapshot`
  - [x] **前端 Detail HTML**：起始/結束等級改為快照職業清單顯示（格式：`職業 Lv.X`，以 `/` 分隔）；快照為空時 fallback 顯示原始數字
  - [x] **前端 Character List**：新增 `getTotalLevel()` 方法計算 classLevels reduce 加總；HTML 改用此方法顯示目前等級
  - [x] **更新 `database-schema.md`**：新增 Step 4a 與 Migration 5 SQL；更新關聯圖
- **備註：** 請到 Supabase SQL Editor 執行 database-schema.md Migration 5（T15）的 CREATE TABLE 語句
- **設計備註：**
  - `snapshot_type = 'starting'`：職業升級前的快照；`snapshot_type = 'ending'`：升級後的快照
  - `updateEntry` 快照更新策略：刪除舊有 starting/ending 快照再重新插入，確保與最新升級狀態一致
  - 舊資料沒有快照時，detail 頁面 fallback 顯示原本的 `startingLevel` / `endingLevel` 數字

---

### T16 — 功能優化：修復角色職業編輯與移除「其他」職業選項

- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. 職業選項清單（`CLASS_OPTIONS`）精簡為 13 種官方核心職業，徹底移除「其他」與自訂文字輸入欄位。
  2. 修復角色編輯表單中無法修改職業/等級的問題：優化後端 `CharacterService.updateCharacter` 的集合更新與 `saveAndFlush`，確保 JPA 交易原子性與狀態同步。
  3. 同步更新 `system-requirements-spec.md`、`database-schema.md`、`user-stories.md`。
- **影響範圍：**
  - 後端：`CharacterService.java`
  - 前端：`character-form.component.ts`、`character-form.component.html`、`adventure-form.component.ts`
  - 文檔：SRS、DB Schema、User Stories
- **完成項目：**
  - [x] 後端 `CharacterService.updateCharacter` 重構，安全更新基本欄位與 `classLevels` 集合並執行 `saveAndFlush`
  - [x] 前端 `character-form` 與 `adventure-form` 移除 `CLASS_OPTIONS` 裡的 `'其他'`
  - [x] 前端 `character-form` 移除 `customClassName` 控制項與 HTML 範本
  - [x] 更新 `system-requirements-spec.md`、`database-schema.md`、`user-stories.md` 規格

---

### T17 — 架構重構與升級機制優化：JPA 遷移至 MyBatis & 角色職業鎖定與冒險靈活升級

- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **持久層重構 (JPA ➔ MyBatis)**：移除 `spring-boot-starter-data-jpa`，導入 MyBatis，編寫 XML Mappers 與自訂 `UuidTypeHandler`，徹底解決實體狀態同步與懶加載問題。
  2. **冒險記錄升級機制 (靈活調配)**：冒險記錄核心追蹤總等級；升級或迎頭趕上時動態展開職業配置表，即時核對職業等級加總等於結束總等級；儲存時自動同步角色當前職業狀態。
  3. **角色編輯鎖定規則**：角色建立開卡時決定起始職業與等級，編輯模式下職業等級鎖定為唯讀徽章，後續等級推進一律透過冒險日誌記錄。
  4. **專案術語一致性**：全專案詞彙統一為「冒險」與「冒險日誌」。
- **影響範圍：**
  - 後端：`pom.xml`, `BackendApplication.java`, `config/*`, `mapper/*`, `service/*`, `dto/*`, `entity/*`
  - 前端：`character-form/*`, `adventure-form/*`, `models/*`
  - 文檔：`system-requirements-spec.md`, `backlog.md`, `walkthrough.md`
- **完成項目：**
  - [x] MyBatis 依賴導入與 XML Mappers 實作
  - [x] 自訂 `UuidTypeHandler` 支援 PostgreSQL UUID
  - [x] `AdventureEntryService` 與 `CharacterService` 重構
  - [x] 前端冒險升級動態職業配置與核對條實作
  - [x] 角色編輯頁面職業/等級唯讀化
  - [x] 前後端編譯打包驗證通過

---

### 📌 多人版本待辦（未來規劃，暫不實作）
- 玩家帳號系統（Email + 密碼 或 OAuth）
- 登入後自動帶入玩家名稱（取代目前的 localStorage / 硬寫預設值）
- 角色資料綁定玩家帳號，支援多玩家共用同一系統
- 角色列表只顯示當前登入玩家的角色

---

### T18 — 架構重構：職業等級改為字串化
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. 廢除 `character_class_level` 與 `adventure_entry_class_snapshot` 關聯表。
  2. `character` 新增 `current_classes_string` 欄位；`adventure_entry` 新增 `starting_classes_string` / `ending_classes_string` 欄位。
  3. 前端角色表單與冒險日誌表單中的職業等級輸入改為單純的字串輸入 (例: `法師5/戰士2`)，由使用者自行填寫並對齊。
  4. 移除了前端所有與「動態配置陣列」、「升級核對」、「迎頭趕上」相關的複雜邏輯。
  5. 後端 Entity, DTO, Mapper, Service 全部更新為對應字串的寫入。
- **影響範圍：**
  - 後端：`CharacterService.java`, `AdventureEntryService.java`, Mybatis Mappers, Entities, DTOs
  - 前端：`character.model.ts`, `adventure.model.ts`, 所有 Form 與 Detail Components
  - 資料庫：Schema 更新
- **完成項目：**
  - [x] 資料庫表結構 Migration SQL 已更新於 `database-schema.md` (T18)
  - [x] 後端實體與 DTO、Mapper 介面全面重構
  - [x] 後端服務業務邏輯簡化為字串寫入
  - [x] 前端模型與元件介面簡化，改為字串輸入
  - [x] 前後端皆已編譯與驗證成功

---

### T19 — 會員與身份驗證系統（Spring Security + JWT + Google & Discord OAuth + 資料隔離）
- **狀態：** `[x] 已完成`
- **對應計畫：** `feature/auth-system`
- **變更摘要：**
  1. **資料庫層**：整合 Flyway Migration 機制 (`db/migration/V1__...`, `V2__...`)，已自動連線 Supabase 執行建表（`users`、`user_oauth_accounts` 表與 `character.user_id` 欄位索引）。
  2. **後端認證層**：導入 Spring Security + JJWT，實作 BCrypt 帳密註冊/登入與 Google/Discord OAuth2 登入 API。
  3. **後端多租戶隔離**：全面升級 Character API 與關聯服務，依據 JWT Token 取得之 `currentUserId` 進行存取控制。
  4. **前端認證模組**：實作登入與註冊頁面、OAuth Callback 頁面、AuthService (Signals)、AuthGuard 與 AuthInterceptor。
  5. **前端 UI 整合**：導覽列 Header 顯示當前玩家身分、頭像與登出按鈕。
- **完成項目：**
  - [x] Phase 1: 規格文件更新 (SRS, DB Schema, User Stories, Backlog)
  - [x] Phase 2: 後端 Spring Security + JWT + 帳密註冊登入
  - [x] Phase 3: 後端 Google & Discord OAuth2 第三方登入
  - [x] Phase 4: 後端角色與日誌資料多租戶隔離 (user_id 關聯)
  - [x] Phase 5: 前端 Auth 模組 (Login, Register, Signals Service, Guard, Interceptor)
  - [x] Phase 6: 前端 OAuth 登入整合與導覽列使用者狀態
  - [x] Phase 7: 前後端打包建置與功能驗證



---

### T20 — 冒險日誌支援記錄獲得消耗品 (Gained Consumables) 與自動入庫
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **前端表單擴充 (`AdventureFormComponent`)**：新增「🧪 獲得消耗品」動態區塊，支援記錄物品名稱、自訂數量（min 1）、稀有度下拉選單與效果備註。
  2. **倉庫自動同步**：冒險記錄新增/編輯儲存時，自動將獲得的消耗品同步寫入角色倉庫 (`itemType: 'CONSUMABLE'`, `quantity`, `source`, `notes`)。
  3. **冒險詳情顯示 (`AdventureDetailComponent`)**：新增「🧪 獲得消耗品」區塊，顯示名稱、數量徽章（`× N`）、稀有度標籤與效果備註。
- **影響範圍：**
  - 前端：`adventure-detail.component.*`, `adventure-form.component.*`
  - 文檔：`system-requirements-spec.md`, `backlog.md`, `walkthrough.md`
- **完成項目：**
  - [x] `AdventureDetailComponent` 增加 `consumableItems` 狀態與「🧪 獲得消耗品」視圖
  - [x] `AdventureFormComponent` 增加 `gainedConsumableItems` 狀態、數量輸入與自動入庫同步邏輯
  - [x] 前端生產建置驗證通過 (`npm run build`)
  - [x] 規格書與 Backlog 更新

---

### T21 — UI/UX 重構 Phase 1：雙主題設計系統（A 淺色 / B 炭灰深色切換）與登入檢核健檢
- **狀態：** `[x] 已完成`
- **分支：** `feature/uiux-overhaul`
- **變更摘要：**
  1. **高易讀性字體導入**：引入 `Inter`（數字與英文字體清晰、對齊精準）與 `Noto Sans TC`（繁體中文思源黑體清晰無襯線），設定全域字體排版系統。
  2. **雙主題 Design Tokens 體系**：
     - **風格 A（現代簡約淺色 Clean Light，預設）**：純白卡片 (`#ffffff`) + 柔和淺灰底 (`#f8fafc`) + 靛藍主色 (`#4f46e5`) + 琥珀金/翠綠/珊瑚紅語意標籤。
     - **風格 B（柔和炭灰深色 Soft Charcoal Dark）**：中性炭灰底 (`#18181b` / `#27272a`，無偏藍或刺眼紫色) + 低飽和魔力紫主色 (`#a855f7`)。
  3. **Angular Material 3 雙主題無縫整合**：同時配置 `body.theme-light` 與 `body.theme-dark` 雙模式 Material 3 系統變數。
  4. **ThemeService (Signals) & 頂部切換開關**：實作即時深淺色切換按鈕 (☀️/🌙)，自動持久化於 `localStorage ('dnd_theme')` 並同步瀏覽器 `meta[theme-color]`。
  5. **登入檢核機制健檢優化**：修復 `AuthService` 啟動時遇到非 401 暫時性網路異常即誤清空登入狀態的 Bug，確保登入狀態 7 天穩定維持。
- **完成項目：**
  - [x] 建立並切換專屬 Git 分支 `feature/uiux-overhaul`
  - [x] `index.html` 引入 Inter 與 Noto Sans TC Google Fonts
  - [x] 建立 `ThemeService`（Signals 即時響應、深淺模式切換與持久化）
  - [x] `styles.scss` 建立風格 A / B 雙主題 Design Tokens 與 Material 3 樣式
  - [x] `app.html` & `app.scss` 增加主題切換按鈕、升級導覽列
  - [x] `AuthService` 修復非 401 錯誤誤登出問題
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T22 — UI/UX 重構 Phase 2：角色清單卡片與角色總覽看板 (Character HUD) 重構
- **狀態：** `[x] 已完成`
- **分支：** `feature/uiux-overhaul`
- **變更摘要：**
  1. **角色清單卡片重構 (`character-list`)**：
     - 卡片採用 `.clean-card.clickable` 懸浮動效與邊框層次。
     - 角色頭像徽記、姓名、玩家名稱、種族與派系標籤一目了然。
     - 總等級徽章（`Lv. X`，琥珀金亮點）。
     - 載入狀態採用骨架屏 (Skeleton loading) 取代轉圈，空狀態視覺美化。
  2. **角色總覽英雄看板 (`character-shell`)**：
     - 頂部導覽列整合返回列表按鈕、角色頭像、等級徽章、種族/職業/派系與編輯按鈕。
     - **即時戰情看板 (Character HUD Stats Bar)**：自動取得角色最新總結數值（🏆 總等級、🪙 金幣資產、🏕️ 休整期天數、✨ 永久魔法物品件數）。
     - 美化 Tab 導覽列（冒險日誌 / 背包與倉庫）。
- **完成項目：**
  - [x] `character-list.component.ts`、`html`、`scss` 全面升級現代卡片排版
  - [x] `character-shell.component.ts` 串接 `AdventureService.getDefaults` 取得即時統計
  - [x] `character-shell.component.html`、`scss` 實作 Hero 卡片與 4 欄式 HUD 戰情看板
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T23 — UI/UX 重構 Phase 3：冒險歷程時間軸列表與冒險詳情頁重構
- **狀態：** `[x] 已完成`
- **分支：** `feature/uiux-overhaul`
- **變更摘要：**
  1. **冒險歷程時間軸列表 (`adventure-list`)**：
     - 廢除傳統桌面寬表格，升級為手機與桌機皆適配的 **「冒險篇章卡片 (Chronicle Cards)」**。
     - 每筆冒險自動按遊玩日期最新優先排序。
     - 卡片頂部標記冒險代碼、遊玩日期、DM 姓名；標題清晰可辨。
     - **即時數值變更徽章 (Delta Badges)**：等級進程（`Lv.X ➔ Lv.Y`）、🪙 金幣變動（`+1,000 GP`）、🏕️ 休整期天數（`-10 天`）、✨ 獲得魔法物品數。
     - 冒險備註文字摘要預覽，支援卡片懸浮過渡動效與點擊進入詳情。
  2. **冒險詳情頁重構 (`adventure-detail`)**：
     - **Hero Header**：返回按鈕、冒險代碼、遊玩日期、大標題與編輯/刪除操作區。
     - **等級與職業推進看板**：起始狀態 ➔ 結算狀態視覺箭頭對比盒。
     - **3 欄式資源變動結算卡片**：金幣、休整期天數、永久魔法物品（起始 ➔ 冒險變化 ➔ 休整變化 ➔ 最終合計）。
     - **獲得物品清單**：永久魔法物品（含稀有度徽章）、獲得消耗品（含數量徽章 `× N`）。
     - **備註與休整期活動區塊**：清晰條列備註、靈魂幣使用與活動項目。
- **完成項目：**
  - [x] `adventure-list.component.ts`、`html`、`scss` 重構為時間軸篇章卡片
  - [x] `adventure-detail.component.ts`、`html`、`scss` 重構為資源看板與等級對比盒
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T24 — UI/UX 重構 Phase 4 & Phase 5：冒險記錄表單 (Adventure Form UX) 與角色倉庫背包 (Inventory) 模組重構
- **狀態：** `[x] 已完成`
- **分支：** `feature/uiux-overhaul`
- **變更摘要：**
  1. **冒險記錄表單優化 (`adventure-form`)**：
     - 各分區全面套用 `.clean-card` 現代卡片設計與高對比階層。
     - 等級與職業配置狀態條即時響應平衡檢查。
     - 資源變動即時試算列（金幣、休整天數、魔法物品）合計自動高亮呈現。
     - 獲得永久魔法物品與消耗品卡片化動態輸入，支援多筆增刪與稀有度下拉選單。
     - 休整期活動預設快速帶入面板與伴隨資源異動。
     - 底部固定式操作列 (Sticky Action Footer)，提供流暢填表體驗。
  2. **背包與角色倉庫模組重構 (`inventory-list`, `inventory-form`)**：
     - 分頁切換「永久性魔法物品」與「消耗品與藥水卷軸」。
     - 物品卡片展示名稱、D&D 稀有度標準色光暈標籤、取得來源與描述。
     - **消耗品快速操作 (Quick Consume)**：提供「使用 ( -1 )」微操作按鈕，剩餘 1 份時點擊彈出安全確認，大幅提升跑團即時體驗。
     - 新增/編輯物品表單全面升級雙主題 Design Tokens。
- **完成項目：**
  - [x] `adventure-form.component.scss` 與 `html` 升級分區卡片與底部固定動作列
  - [x] `inventory-list.component.ts`、`html`、`scss` 實作消耗品快捷使用與雙標籤卡片網格
  - [x] `inventory-form.component.ts`、`html`、`scss` 升級為雙主題乾淨表單
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T25 — UI/UX 文案精簡與標準跑團術語統一（冒險紀錄表 Logsheet）
- **狀態：** `[x] 已完成`
- **分支：** `feature/uiux-overhaul`
- **變更摘要：**
  1. **標準中文跑團術語統一**：
     - 將原有的「冒險日誌」、「冒險歷程日誌」、「戰役歷程」全站統一為中文社群慣用的 **「冒險紀錄表」** 或 **「冒險紀錄」**。
  2. **提示訊息與標題全面精簡 (De-cluttering)**：
     - 移除冗長贅字與對資深玩家多餘的說明段落（如：「（選填，儲存時自動同步入庫）」、「起始值新增時自動帶入...」、「⚡ 快速帶入常見活動預設（選取後仍可自由修改）」等）。
     - 簡化表單分區標題（`📋 冒險資訊`、`💰 資源變動`、`✨ 獲得魔法物品`、`🧪 獲得消耗品`、`📝 備註`、`🏕️ 休整期活動`）。
     - 簡化詳情頁與倉庫分頁名稱（`冒險紀錄表` / `倉庫` / `魔法物品` / `消耗品`），還原如同紙本冒險紀錄表般俐落、乾淨的視覺體驗。
- **完成項目：**
  - [x] `index.html`、`app.html` 更新品牌名稱為「D&D 冒險紀錄表」
  - [x] `character-shell`、`character-list`、`character-form` 統一術語與精簡 HUD 標籤
  - [x] `adventure-list`、`adventure-detail`、`adventure-form` 移除冗長干擾文字，回歸俐落排版
  - [x] `inventory-list` 分頁精簡為「魔法物品」與「消耗品」
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T26 — 手機版 (Mobile UX) 全方位體驗優化
- **狀態：** `[x] 已完成`
- **分支：** `feature/mobile-optimization`
- **變更摘要：**
  1. **基礎與全螢幕適配**：`index.html` 加入 `viewport-fit=cover` 與 iOS / Android Safe-Area 支援；`styles.scss` 規範觸控最小熱區 (44px) 與 iOS 輸入縮放防護。
  2. **頂部導覽列**：小螢幕自動縮合品牌徽章與使用者頭像，避免橫向溢出。
  3. **角色戰情看板 (HUD)**：在手機端升級為乾淨的 **2×2 網格看板**，字體與圖示醒目。
  4. **冒險紀錄表單 (最核心)**：
     - 將 4 欄式桌面橫向表格在手機寬度下自動切換為 **獨立資源卡片（2×2 網格輸入 + 結算合計全寬高亮）**，徹底消除擠壓溢出。
     - 底部固定式動作列（Sticky Action Footer）支援 Safe-Area 與等寬大按鈕。
  5. **冒險時間軸與詳情**：篇章卡片與 Delta 數值變動標籤自動流式適配；等級進程與資源結算單欄視覺優化。
  6. **倉庫背包與對話框**：消耗品「使用 ( -1 )」按鈕加大觸控區；彈出對話框自適應手機螢幕寬度。
- **完成項目：**
  - [x] 建立並切換專屬 Git 分支 `feature/mobile-optimization`
  - [x] `index.html` 與 `styles.scss` 加入 Safe-Area 與觸控基礎
  - [x] `app.scss` 導覽列與使用者頭像手機適配
  - [x] `character-shell` HUD 2×2 網格與全寬 Tabs
  - [x] `adventure-form` 資源變動手機卡片式 2x2 網格與底部 Sticky Action
  - [x] `character-list`、`adventure-list`、`adventure-detail`、`inventory-list` 全站響應式微調
  - [x] 對話框與 Auth 表單手機尺寸適配
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T27 — 效能與連線最佳化 (Performance & DB Optimization)
- **狀態：** `[x] 已完成`
- **分支：** `perf/latency-and-db-optimization`
- **變更摘要：**
  1. **後端 HikariCP 連線池調優**：消除 `keepaliveTime >= maxLifetime` 啟動警告，將連線池容量擴增至 10、常駐 2 條熱連線、壽命延長至 10 分鐘（`max-lifetime=600000`）、加入 30 秒心跳保活（`keepalive-time=30000`），徹底解決跨國連線 TLS 重複握手與並發塞車。
  2. **前端請求去重與平行化**：`CharacterShellComponent` 與 `AdventureDetailComponent` 全面改用 `forkJoin` 平行處理；修復 `router.events` 初始載入重複發送 API 的問題，請求次數減少 60%，消除 Waterfall 瀑布流等待。
  3. **資料庫效能索引 (Flyway V4)**：建立 `adventure_entry`、`inventory_item`、`downtime_activity`、`character` 常用查詢與排序索引，所有查詢走 Index Scan (< 1ms)。
- **完成項目：**
  - [x] `application.properties` 連線池參數更新
  - [x] 建立 Flyway `V4__add_performance_indexes.sql` 遷移腳本
  - [x] `database-schema.md` 新增 Migration 6
  - [x] `character-shell.component.ts` 與 `adventure-detail.component.ts` 平行請求與去重
  - [x] 前後端建置與編譯驗證通過

---

### T28 — 冒險紀錄表單「三大階段區塊」與「休整期活動卡片清單」重構
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **三大邏輯階段劃分 (3-Phase Flow)**：
     - `📜 冒險基本資訊`：代碼、名稱、日期、DM、升級機制與兼職配置。
     - `⚔️ 冒險收穫與戰利品`：起始數值 + 冒險中收益、獲得永久魔法物品、獲得消耗品。
     - `⛺ 休整期活動`：休整期各項活動記錄與伴隨資源變動。
     - `📊 最終結算與備註`：公式化即時結算看板（起始 + 冒險 + 休整 = 最終合計）、冒險筆記與靈魂幣。
  2. **休整期活動「卡片清單模式」重構**：
     - 消除使用者填寫後忘記按下新增按鈕的認知落差，改為點擊 `[➕ 新增休整期活動]` 即展開卡片。
     - 卡片內建常用快捷預設（自動代入名稱與花費數值）、自訂描述、金幣/天數/魔法物品變動欄位與刪除按鈕。
     - 系統自動即時加總所有活動花費並連動結算看板，免心算且 100% 防呆。
  3. **等級與升級機制手機版 RWD 排版優化**：
     - 將「起始等級」、「本次升級」與「迎頭趕上」整合進同案一體化控制卡片。
     - 手機版開關兩行對齊貼齊，結束等級化為水平金色橫條，徹底修正手機模式排版偏歪問題。
- **完成項目：**
  - [x] `AdventureFormComponent` 引入 `downtimeActivities` 卡片清單 Signal 與即時自動加總運算
  - [x] `AdventureService` 新增 `updateDowntime` 方法
  - [x] `adventure-form.component.html` 重構三大階段區塊與活動卡片清單
  - [x] `adventure-form.component.scss` 樣式美化、精簡無用提示訊息與手機 RWD 對齊修復
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T27 — 冒險紀錄編輯模式：戰利品與休整期活動快照鎖定與追加新增功能
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **既有項目歷史快照鎖定**：
     - 在 `isEditMode = true` 模式下，已存在的魔法物品、消耗品與休整期活動加上 `[歷史快照]` 標籤。
     - 欄位全面鎖定（`disabled`），並隱藏刪除按鈕，保護歷史資料不被意外竄改或刪除。
  2. **編輯模式開放追加新增**：
     - 解鎖編輯模式下的「新增魔法物品」、「新增消耗品」與「新增休整期活動」按鈕。
     - 新加入之卡片標示 `[新增]` 標籤，各欄位允許正常填寫，並提供刪除按鈕以供儲存前撤銷。
  3. **同步儲存與防呆校驗**：
     - 儲存變更時，僅將新建立之魔法物品與消耗品（`!item.id`）同步寫入角色倉庫，既有物品不重複寫入亦不覆蓋現況。
     - 僅將新建立之休整期活動寫入冒險記錄，既有活動保留原貌。
     - 新增送出前空白卡片檢查，若有未填寫名稱或描述之新卡片，立即發出提示防呆。
- **完成項目：**
  - [x] `AdventureFormComponent` 完善 `removeGainedItem`、`removeGainedConsumableItem`、`removeDowntimeActivity` 的快照保護邏輯
  - [x] `AdventureFormComponent` 實作 `syncGainedItemsToInventory` 與 `syncDowntimeActivities` 僅同步新項目邏輯，並於編輯模式儲存時連動
  - [x] `adventure-form.component.html` 移除新增按鈕限制、加入快照標籤與欄位 `disabled` 條件綁定
  - [x] `adventure-form.component.scss` 新增 `.snapshot-card`、`.snapshot-tag` 與 `.new-tag` 視覺樣式
  - [x] 更新 `system-requirements-spec.md` 新增 9.4 規格
### T28 — CharacterShell 頂部 HUD 魔法物品件數連動倉庫實際數量
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **串接倉庫真實數據**：
     - 原先頂部 HUD 魔法物品件數顯示來自 `defaults.startingMagicItems`（僅抓取前次冒險紀錄計算值），導致使用者在倉庫頁面手動新增、編輯、刪除魔法物品時，HUD 無法同步反映倉庫現況。
     - 在 `CharacterShellComponent` 引入 `InventoryService`，在初次載入及每次 `refreshHud()` 時查詢該角色所有倉庫物品，統計 `itemType === 'PERMANENT'` 之實際數量存入 `magicItemsCount` signal。
  2. **跨組件全域反應**：
     - `InventoryService` 在道具新增/修改/刪除時本已發送 `characterChanged$` 廣播通知，`CharacterShellComponent` 訂閱後立即呼叫 `refreshHud()`，實現倉庫操作與頂部 HUD 魔法物品數值即時無縫連動。
- **完成項目：**
  - [x] `CharacterShellComponent` 注入 `InventoryService`，建立 `magicItemsCount` signal
  - [x] `loadCharacterData()` 與 `refreshHud()` 新增查詢倉庫永久魔法物品統計邏輯
  - [x] `character-shell.component.html` 魔法物品數值綁定改為 `magicItemsCount()`
### T29 — AdventureForm 起始魔法物品件數連動倉庫實際數量
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **後端統一收斂來源**：
     - `AdventureEntryService.getDefaults()` 注入 `InventoryItemMapper`，無論先前是否有冒險紀錄，預設的 `startingMagicItems` 皆改為查詢倉庫中 `itemType = 'PERMANENT'` 之實際持有件數。
  2. **前端雙重防護連動**：
     - `AdventureFormComponent.loadDefaults()` 中使用 `forkJoin` 同時向 `InventoryService` 查詢倉庫物品，確保新增冒險紀錄時，「起始魔法物品件數」即時且準確地反映倉庫目前的永久魔法物品數量。
- **完成項目：**
  - [x] 後端 `AdventureEntryService` 注入 `InventoryItemMapper` 並更新 `getDefaults()`
  - [x] 前端 `AdventureFormComponent.loadDefaults()` 更新為倉庫即時統計
### T30 — AdventureList 冒險紀錄多維度排序與方向切換（方案一：維度解耦）
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **排序欄位與方向解耦**：
     - `AdventureListComponent` 引入 `sortField`（支援 `playDate` 遊玩日、`createdAt` 建立時間）與 `sortOrder`（`desc` 與 `asc`）Signals。
     - 搭配 `computed()` 進行極速客戶端排序：
       - `playDate`：按遊玩歷史排序，相同時以 `createdAt` 次要排序。
       - `createdAt`：按資料庫輸入時間排序，卡片額外顯示建立日期標籤，相同時以 `playDate` 次要排序。
     - 整合 `localStorage` 雙重記憶使用者的欄位與方向偏好。
  2. **直觀控制項與動態標籤**：
     - 重構為「一體化膠囊排序工具列（Pill Capsule Toolbar）」，消除雙方塊割裂感，左右等寬居中對齊。
     - 整合隱形原生 select 覆蓋技術，在手機觸控時自動呼叫流暢的原生選取輪盤，兼具極簡美學與順暢手感。
- **完成項目：**
  - [x] `AdventureListComponent` 定義 `AdventureSortField`，實作 `sortField`、`sortOrder`、`directionLabel` 與 `computed` 排序運算
  - [x] `adventure-list.component.html` 整合一體化膠囊工具列、方向反轉按鈕與建立日期輔助標籤
  - [x] `adventure-list.component.scss` 重構一體化膠囊樣式與手機版完美自適應排版
### T31 — 修復冒險紀錄編輯模式戰利品載入匹配機制（容錯與雙向比對）
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **重構戰利品來源比對邏輯 (`isSourceMatch`)**：
     - 解決原先 `loadGainedItems` 僅依賴 `adventureName || adventureCode` 且以嚴格全等比對 (`===`)，導致冒險代號與名稱割裂、複合命名（如 `[DDAL09-01] 冒險名稱`）或大小寫差異時戰利品無法載入呈現完全空白之問題。
     - 抽取出通用之雙向容錯比對方法 `isSourceMatch`，支援大小寫不敏感、去前後空白、雙向子字串比對，並統一套用於 `AdventureFormComponent` 與 `AdventureDetailComponent`，使詳情頁與編輯表單之物品展示 100% 一致。
- **完成項目：**
  - [x] `AdventureFormComponent` 實作 `isSourceMatch` 替代嚴格全等過濾
  - [x] `AdventureDetailComponent` 同步採用一致之 `isSourceMatch` 判定
  - [x] 前端生產建置驗證通過 (`npm run build`)

---

### T32 — 冒險日誌刪除連帶回滾與倉庫消耗解耦機制
- **狀態：** `[x] 已完成`
- **對應計畫：** `implementation_plan.md`
- **變更摘要：**
  1. **資料庫層級聯與快照 (Flyway V6)**：
     - 建立 `adventure_gained_item` 冒險戰利品專屬快照表，與 `adventure_entry` 綁定 `ON DELETE CASCADE`。
     - `inventory_item` 新增 `adventure_entry_id` 外鍵（`ON DELETE CASCADE`），手動建立之裝備保持 NULL。
     - 歷史資料平滑回填（Backfill）。
  2. **後端雙軌維護與狀態回滾**：
     - `AdventureEntryService` 新增獲得物品端點與處理；`deleteEntry` 支援全維度回退角色等級、職業字串與最新 defaults。
  3. **前端詳情頁解耦與表單同步**：
     - 冒險表單儲存時雙軌寫入（快照與倉庫）；詳情頁改讀專屬快照表。
     - 倉庫日常消耗與刪除道具時，歷史日誌紀錄 100% 維持不變；刪除冒險記錄時，倉庫道具、等級、金錢、休整期與頂部 HUD 即時連帶回退。
- **完成項目：**
  - [x] 建立 Flyway `V7__add_adventure_gained_item_and_inventory_fk.sql`
  - [x] 後端 Entity、DTO、Mapper、Service、Controller 實作
  - [x] 前端 Model、Service、Component 更新
  - [x] 前後端建置與編譯驗證通過

---

### T33 — 編輯冒險日誌開放歷史物品與休整期修改（方案 A 增量同步 Delta Sync）
- **狀態：** `[x] 已完成`
- **對應計畫：** `implementation_plan.md`
- **變更摘要：**
  1. **資料庫層精準綁定 (Flyway V8)**：
     - `inventory_item` 增加 `adventure_gained_item_id UUID REFERENCES adventure_gained_item(id) ON DELETE CASCADE`。
     - 建立索引與歷史資料回填，達成倉庫持有物與獲得快照項之 1:1/1:N 精準關聯與自動級聯刪除。
  2. **後端增量差額同步 (Delta Sync)**：
     - `AdventureEntryService.updateGainedItem` 實作消耗品差額運算 $\Delta = Q_{\text{new}} - Q_{\text{old}}$：
       - $\Delta > 0$：倉庫現有數量 $+ \Delta$（若已在倉庫喝光用盡則自動補發 $\Delta$ 瓶）。
       - $\Delta < 0$：倉庫現有數量扣減 $\max(0, \text{qty} + \Delta)$，歸零自動移除。
     - 魔法物品修訂：名稱、稀有度、備註雙軌同步更新快照與倉庫背包。
     - 刪除物品：透過資料庫外鍵自動連帶清理倉庫背包道具。
     - `AdventureEntryController` 新增 `PUT /api/entries/{entryId}/gained-items/{itemId}`。
  3. **前端解鎖編輯與全面動態聯動**：
     - `adventure-form.component.html` 移除所有 `disabled` 唯讀限制，開放編輯魔法物品、消耗品與休整期活動。
     - 開放刪除按鈕，標籤由「歷史快照」更新為友善的「已入庫 / 已有活動」。
     - `adventure-form.component.ts` 收集 `deletedItemIds` 與 `deletedActivityIds`，在儲存時同時調用增、刪、改端點。
     - 編輯或刪除休整期活動時，即時重新加總 `goldDowntimeChange`、`downtimeDowntimeChange`、`magicItemsDowntimeChange`，並刷新頂部 HUD 看板。
- **完成項目：**
  - [x] 建立 Flyway `V8__link_inventory_to_gained_item.sql` 並執行遷移
  - [x] 後端 `InventoryItemMapper`、`AdventureGainedItemMapper`、`AdventureEntryService`、`AdventureEntryController` 更新
  - [x] 前端 `inventory.model.ts`、`adventure.service.ts`、`adventure-form.component.html`、`adventure-form.component.ts` 更新
  - [x] 後端 `./mvnw clean package -DskipTests` 與前端 `npm run build` 驗證 0 錯誤

---

### T34 — 倉庫魔法物品與消耗品加入「取得時間」展示與雙向排序
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **道具卡片整合「取得時間」標籤**：
     - 在永久魔法物品與消耗品卡片整合 `.item-meta-row`，同時呈現「來源」與「取得時間：YYYY/MM/dd」（對應道具在系統中的 `createdAt` 時間戳）。
  2. **一體化膠囊排序按鈕（雙向切換）**：
     - 在倉庫頁面頂部新增一體化膠囊按鈕，支援「由新到舊 (最新在先)」與「由舊到新 (最舊在先)」的一鍵點擊切換。
     - 透過 `computed()` 響應式信號進行毫秒級客戶端排序，並將排序偏好持久化儲存於 `localStorage`。
- **完成項目：**
  - [x] `InventoryListComponent` 引入 `sortOrder` 信號與 `sortItems` 排序邏輯，整合 `localStorage` 記憶
  - [x] `inventory-list.component.html` 新增頂部排序膠囊按鈕與卡片 `item-meta-row` 取得時間標籤
  - [x] `inventory-list.component.scss` 完成現代膠囊樣式與手機端自適應排版
  - [x] 前端建置驗證通過 (`npm run build`)

---

### T35 — 全站圖示來源統一化（統一為 Lucide Icons 現代線條風格）
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **規範落實**：
     - 在 `.agents/rules/project-conventions.md` 確立「全站統一使用 Lucide Icons (`@lucide/angular`)，禁止在同組件/同視圖混用 `mat-icon`」標準。
  2. **倉庫模組 100% 遷移**：
     - `inventory-list` 與 `inventory-form` 全面移除 `<mat-icon>`。
     - 替換為 `LucidePackage`、`LucidePlus`、`LucideSparkles`、`LucideFlaskConical`、`LucideBookmark`、`LucideClock`、`LucidePencil`、`LucideTrash2`、`LucideDroplet`、`LucideArrowLeft`、`LucideSave`。
  3. **冒險清單模組 100% 遷移**：
     - `adventure-list` 徹底替換殘留的 `menu_book`, `event`, `person`, `chevron_right`, `upgrade` 為對應的 Lucide SVG（`LucideBookOpen`, `LucideCalendar`, `LucideUser`, `LucideChevronRight`, `LucideTrendingUp`）。
- **完成項目：**
  - [x] 更新 `.agents/rules/project-conventions.md`
  - [x] 重構 `inventory-list` 與 `inventory-form`，達成 0 `mat-icon` 混用
  - [x] 重構 `adventure-list`，達成 0 `mat-icon` 混用
  - [x] 前端打包驗證通過 (`npm run build`)

---

### T36 — 輕量化安全架構補強（BOLA/IDOR 擁有權隔離、OAuth aud 驗證、CORS/Actuator 收斂與 2小時效期）
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **物件層級授權防護 (BOLA/IDOR 防呆)**：
     - `AdventureEntryController` 與 `InventoryItemController` 所有端點注入 `@AuthenticationPrincipal UserPrincipal principal`。
     - `AdventureEntryService` 與 `InventoryItemService` 強制在每次資料查詢與異動前檢驗角色擁有權（`characterService.findCharacter(characterId, userId)`），非擁有者回傳 404，徹底杜絕跨玩家誤改、誤刪彼此冒險日誌與倉庫道具。
  2. **Google OAuth 安全加固**：
     - `OAuthService.verifyGoogleToken` 新增 `aud` (Audience) 比對，限定僅接受發給本專案 `googleClientId` 的 Token；新增 `email_verified` 檢驗。
  3. **安全組態收斂與登入效期調整**：
     - `application.properties`：將 JWT 登入有效期限由 7 天調整為 **2 小時** (`7200000` ms)。
     - `SecurityConfig.java`：CORS 白名單移除萬用字元子網域（`*.web.app`, `*.firebaseapp.com`）；Actuator 存取限縮為僅開放 `/actuator/health` 與 `/actuator/info`。
     - `WebConfig.java`：移除重複定義的 CORS，由 `SecurityConfig` 統一管控。
     - `GlobalExceptionHandler.java`：脫敏 500 一般未捕捉例外的錯誤回應，保護內部架構與 SQL 細節。
  4. **前端 HTTP Interceptor Token 發送白名單化**：
     - `auth.interceptor.ts` 由黑名單排除改為白名單比對（`req.url.startsWith('/api') || req.url.startsWith(environment.apiUrl)`），防止未來串接外部服務時 Token 外洩。
  5. **CORS 環境變數架構純淨化與舊 Token 例外攔截**：
     - `SecurityConfig.java`：移除任何寫死的業務網域，CORS 完全遵循 12-Factor 原則由環境變數 `CORS_ALLOWED_ORIGIN` 動態注入，維護公開倉庫架構整潔度。
     - `JwtTokenProvider.java`：廣泛捕捉 `JwtException` 與 `IllegalArgumentException`，防止過期/無效 Token 洩漏未處理例外至 Filter 堆疊。
     - `auth.interceptor.ts`：排除 `/api/auth/login`、`/api/auth/register`、`/api/auth/oauth` 附加 `Authorization: Bearer`，避免舊金鑰簽署的 Token 污染登入請求。
- **完成項目：**
  - [x] 後端 Controllers、Services、Config、Exception Handler 程式碼更新
  - [x] 前端 `auth.interceptor.ts` 白名單化更新
  - [x] 後端 `./mvnw clean package -DskipTests` 打包驗證通過
---

### T37 — 角色卡片純文字條列佈局與子職（Subclass）欄位支援
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **規格與資料庫**：
     - 更新 `system-requirements-spec.md` 與 `database-schema.md`。
     - 新增 Migration 9 (`V9__add_subclass_to_character.sql`)：`ALTER TABLE "character" ADD COLUMN IF NOT EXISTS subclass VARCHAR(100);`。
  2. **後端 (Spring Boot / MyBatis)**：
     - `Character` Entity、`CharacterRequest`、`CharacterResponse` 新增 `subclass` 欄位。
     - `CharacterService` 在 create、update 及 toResponse 中正確映射 `subclass` 與 `faction`。
     - `CharacterMapper.xml` 於 `resultMap`、所有 `SELECT`、`INSERT` 與 `UPDATE` 語句補齊 `subclass` 欄位。
  3. **前端 (Angular 22)**：
     - `character.model.ts` 新增 `subclass?: string | null`。
     - `character-form` 新增「子職（選填）」輸入框，完整支援建立與編輯角色時儲存/載入。
     - `character-list` 依照需求移除 icon 標籤，改為整齊俐落的純文字條列式呈現（種族、職業、子職、派系）。
     - `character-shell` 頂部 meta 亦支援展示子職。
---

### T38 — 角色自訂大頭照上傳、互動裁切視窗與圓角正方形肖像卡牌風格
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **規格與資料庫**：
     - 更新 `system-requirements-spec.md` 與 `database-schema.md`。
     - 新增 Migration 10 (`V10__add_avatar_url_to_character.sql`)：`ALTER TABLE "character" ADD COLUMN IF NOT EXISTS avatar_url TEXT;`。
  2. **後端 (Spring Boot / MyBatis)**：
     - `Character` Entity、`CharacterRequest`、`CharacterResponse` 新增 `avatarUrl` 欄位。
     - `CharacterService` 與 `CharacterMapper.xml` 於所有查詢、INSERT 與 UPDATE 完整支援 `avatar_url` 持久化。
  3. **前端 (Angular 22)**：
     - 新增獨立裁切視窗 `AvatarCropperDialogComponent`，支援圖片平移拖曳、雙向滑桿/滾輪縮放、圓角正方形遮罩預覽，輸出 300x300 高解析 WebP 壓縮圖。
     - `character-form` 整合肖像上傳預覽區塊、更換圖片與移除功能。
     - `character-list` 採用 **風格 A（左側大肖像 Hero Portrait 卡牌風，104x124px）**，右側整齊條列各項角色資料與等級。
     - `character-shell` 全面升級為「圓角正方形（RPG 肖像徽章風格）」，支援立繪展示與文字 Fallback 渲染。
- **完成項目：**
  - [x] 資料庫 Migration V10 建立與文檔更新
  - [x] 後端 Entity、DTO、Service、Mapper 調整
  - [x] 建立 `AvatarCropperDialogComponent` 互動裁切元件
### T39 — 全站 UI/UX 優化與魔法物品「是否需同調 (requiresAttunement)」欄位支援
- **狀態：** `[x] 已完成`
- **變更摘要：**
  1. **全站 UI/UX 改善（Commit `ed2615c`）**：
     - 頂部導覽列整合全域返回按鈕（`NavigationEnd` 偵測內頁顯示），移除內頁卡片重複返回鍵。
     - 全站四大資源（等級=靛藍、金幣=琥珀金、休整期=翡翠綠、魔法物品=奧術紫）色調與語義對齊。
     - 等級（Level）在 HUD、冒險清單與角色列表中全面去除圖示，純文字呈現更俐落。
     - 角色卡片 RWD 對齊微調，長名稱 ellipsis 防破版，右上角編輯/刪除觸控區域加寬。
     - 倉庫物品清單改採「方案 4：橫向條列卡片（Row-Card）」，解決舊版名稱擠壓與右側留白問題。
  2. **資料庫與後端同調支援（Commit `ef8d438`）**：
     - 新增 Flyway Migration 11 (`V11__add_requires_attunement_to_inventory_item.sql`)：`ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS requires_attunement BOOLEAN DEFAULT FALSE;`。
     - 更新 `database-schema.md` 與 `system-requirements-spec.md`。
     - `InventoryItem` Entity、Request/Response DTO 新增 `requiresAttunement` 欄位。
     - `InventoryItemMapper.xml` 更新 `resultMap`、`insert` 與 `update`。
     - `InventoryItemService` 處理同調屬性映射。
  3. **前端同調功能串接（Commit `21403db`）**：
     - TypeScript 模型 `InventoryItem` 新增 `requiresAttunement?: boolean`。
     - `inventory-form` 新增「需要同調 (Requires Attunement)」核取方塊（`mat-checkbox`，僅魔法物品顯示）。
     - `inventory-list` 條列卡片於稀有度旁顯示精緻琥珀色「需同調」膠囊標籤。
     - `styles.scss` 定義全域 `.attunement-pill` 樣式。

---

## 如何使用這個 Backlog