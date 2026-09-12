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

## 如何使用這個 Backlog