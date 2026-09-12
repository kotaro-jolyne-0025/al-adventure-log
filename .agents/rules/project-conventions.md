# D&D 冒險日誌專案開發規範 (Project Conventions)

本檔案定義本專案的 AI 協作角色、架構原則、代碼風格與開發標準。所有在此專案進行的開發工作皆必須遵守此規範。

---

## 1. 🎯 核心角色與工作流程 (PM & Tech Lead 原則)

### 1.1 文件優先 (Spec-First)
- **變更任何業務邏輯前**：先檢查並同步更新 `system-requirements-spec.md` (SRS)、`database-schema.md` 或 `user-stories.md`。
- **不可憑空發明業務規則**：所有數值計算公式（如：`合計 = 起始 + 冒險變化 + 休整期變化`）、等級升級規則、快照機制等必須與規格文件嚴格一致。
- **發現衝突主動預警**：若使用者需求與現有架構或歷史快照機制產生衝突，必須主動分析影響並提出解法選項，不可默默忽略。

### 1.2 任務追蹤與交付
- **對齊 Backlog**：所有需求與改動需對應到 `backlog.md` 中的項目（例如 T01~T15 或新增的 TX 項目）。
- **完成後即時更新**：完成實作與驗證後，立即將 `backlog.md` 對應項目的狀態改為 `[x]` 並補充完成摘要。

---

## 2. 🎨 前端開發規範 (Frontend Conventions)

* **技術棧**：Angular 22 + Angular Material + SCSS + PWA
* **路徑**：`frontend/src/app/`

### 2.1 現代 Angular 規範
1. **Standalone Components**：
   - 所有組件一律使用 Standalone 模式（`standalone: true`）。
   - 僅導入該組件實際使用到的模組與組件，保持打包體積精簡。
2. **狀態管理 (Signals)**：
   - 頁面與組件內部狀態優先使用 Angular Signals（`signal()`、`computed()`、`effect()`）。
   - 衍生數值（如表單中的資源合計即時計算、結束等級計算）必須使用 `computed()`。
3. **依賴注入**：
   - 全面使用現代 `inject()` 函式（例如 `private fb = inject(FormBuilder);`、`private adventureService = inject(AdventureService);`），避免肥大的 constructor 注入。
4. **表單管理**：
   - 採用 `ReactiveFormsModule`（`FormGroup` / `FormControl`）。
   - 唯讀欄位與即時計算欄位使用 computed signal 或表單 disabled 狀態呈現，確保使用者體驗流暢且防呆。
5. **UI & 主題風格**：
   - 使用 Angular Material 組件（MatCard, MatTable, MatButton, MatFormField, MatSelect, MatSlideToggle 等）。
   - 保持 D&D 冒險風格的高質感深色/紫金系視覺（`#7b1fa2` 主色系），支援響應式排版（手機、平板與桌面）。
6. **圖示標準 (Icon System)**：
   - 全站統一使用 **Lucide Icons (`@lucide/angular`)**，建立現代 SVG 線條視覺風格。
   - 禁止在同組件或同一行中混用 `mat-icon` 與 Lucide，逐步將舊有 `mat-icon` 重構遷移至 Lucide。

---

## 3. ☕ 後端開發規範 (Backend Conventions)

* **技術棧**：Spring Boot (Java 17) + Spring Data JPA + PostgreSQL Driver
* **路徑**：`backend/src/main/java/com/dndadvlog/backend/`

### 3.1 架構與分層職責
1. **Controller 層 (`controller/`)**：
   - 僅負責路由、HTTP 請求接收、參數校驗（`@Valid`）與 HTTP Status 回傳。
   - **禁止直接暴露 JPA Entity**，一律透過 DTO 進行 Request / Response 封裝。
2. **Service 層 (`service/`)**：
   - 封裝所有核心業務邏輯：資源合計計算、職業等級升級/撤回處理、快照生成（Starting/Ending Snapshot）。
   - 涉及多表更新的方法必須加上 `@Transactional`，確保交易原子性。
   - 不信任前端傳入的合計計算值，一律在後端重新依公式計算並寫入資料庫。
3. **Repository 層 (`repository/`)**：
   - 繼承 `JpaRepository<Entity, UUID>`。
   - 複雜查詢使用清晰語意的 JPQL 或 Derived Query Methods。
4. **例外處理 (`exception/`)**：
   - 拋出特定業務例外（如 `ResourceNotFoundException`）。
   - 由 `@ControllerAdvice` (`GlobalExceptionHandler`) 統一攔截並轉換為標準格式的錯誤回應。

---

## 4. 🗄️ 資料庫與 Supabase Migration 規範

* **資料庫**：PostgreSQL (Hosted on Supabase)
* **Schema 參考文件**：`database-schema.md`

### 4.1 資料庫變更原則
1. **禁止 Hibernate 自動 DDL**：
   - `application.properties` 中的 `spring.jpa.hibernate.ddl-auto` 必須維持 `none`。
2. **手動 Migration 腳本**：
   - 所有資料表建立、欄位增刪改必須以 SQL 形式記錄在 `database-schema.md`。
   - 腳本必須具備冪等性（Idempotency）：
     - `CREATE TABLE IF NOT EXISTS ...`
     - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
     - `CREATE INDEX IF NOT EXISTS ...`
3. **主鍵規範**：所有業務資料表一律使用 UUID（`gen_random_uuid()`）作為主鍵。

---

## 5. 🚢 部署規範 (Zeabur Native Buildpacks)

1. **原生自動建置**：
   - 專案採用 Zeabur 原生建置（Java Maven + Node Static Web），不維護自訂 Dockerfile。
2. **環境變數驅動**：
   - 後端資料庫連線一律使用環境變數：`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`。
   - 後端 CORS 來源使用 `CORS_ALLOWED_ORIGIN`（支援逗號分隔多個來源）。
   - 禁止將帳密與機密金鑰 commit 到 Git 中。
3. **前端 API 設定**：
   - 前端生產環境透過 `environment.prod.ts` 連接後端公開網址。


