# 冒險紀錄表 Web版 — SDLC 計畫文件

## 總覽

**目標：** 將 D&D 冒險聯盟（AL）紙本冒險記錄表數位化，建立一個可搜尋、結構化的網頁應用程式，並支援 PWA（可安裝至桌面）。

**範圍（MVP）：**
- 管理多個角色（預計 6–7 個）
- 每個角色的冒險紀錄表 CRUD，欄位對應官方 AL 記錄表
- 自動帶入邏輯：上一筆的金幣合計 → 下一筆的起始金幣、休假天數合計 → 下一筆起始休假、魔法物品合計 → 下一筆起始魔法物品
- 依日期、冒險代碼、冒險名稱搜尋日誌
- 單人使用，MVP 不需登入
- PWA：可從瀏覽器安裝至桌面

**不在範圍內（MVP 之外）：**
- 使用者驗證 / 多人共享
- NPC 資料庫、地圖、派系追蹤
- 上架 App Store

**技術選型：**
| 層級 | 技術 | 部署位置 |
|---|---|---|
| 前端 | Angular + PWA | Zeabur（靜態網站）|
| 後端 | Spring Boot（Java）| Zeabur |
| 資料庫 | PostgreSQL | Supabase（永久免費）|
| API 風格 | REST | — |

---

## 系統架構

```
[Angular PWA]  <──REST API (HTTPS)──>  [Spring Boot on Zeabur]  <──JPA/JDBC──>  [PostgreSQL on Supabase]
      |
 可從瀏覽器安裝至桌面（PWA）
```

---

## 資料模型

### Character（角色）
| 欄位 | 類型 | 說明 |
|---|---|---|
| id | UUID（主鍵）| 自動產生 |
| character_name | VARCHAR | 例：亞夢 |
| race_classes_levels | VARCHAR | 例：阿斯莫、LV6聖騎士、LV4術師 |
| player_name | VARCHAR | 例：可嵐 |
| faction | VARCHAR | 派系（選填）|
| soul_coins_carried | INTEGER | 預設 0 |
| sheet_number | INTEGER | 例：4 |
| created_at | TIMESTAMP | 自動建立 |
| updated_at | TIMESTAMP | 自動更新 |

### AdventureEntry（冒險記錄）
| 欄位 | 類型 | 說明 |
|---|---|---|
| id | UUID（主鍵）| 自動產生 |
| character_id | UUID（外鍵 → Character）| 所屬角色 |
| adventure_code | VARCHAR | 例：CCC-GHC-BK2-07 |
| adventure_name | VARCHAR | 例：死亡騎士 |
| play_date | DATE | 例：2025-11-20 |
| dm_name | VARCHAR | 例：蔚浩 |
| starting_level | INTEGER | 起始等級 |
| level_accepted | BOOLEAN | 是否升級（Y/N）|
| ending_level | INTEGER | 結束等級 |
| starting_gold | DECIMAL(10,2) | 起始金幣 |
| gold_change | DECIMAL(10,2) | 金幣變化（+/-）|
| gold_total | DECIMAL(10,2) | 金幣合計：起始 + 變化 |
| starting_downtime | INTEGER | 起始休假天數 |
| downtime_change | INTEGER | 休假天數變化（+/-）|
| downtime_used | INTEGER | 本次使用的休假天數 |
| downtime_total | INTEGER | 休假合計：起始 + 變化 − 使用 |
| starting_magic_items | INTEGER | 起始永久魔法物品數 |
| magic_items_change | INTEGER | 魔法物品變化（+/-）|
| magic_items_total | INTEGER | 魔法物品合計：起始 + 變化 |
| adventure_notes | TEXT | 冒險備註與休假活動（自由文字）|
| soul_coin_charges_used | VARCHAR | 使用的靈魂幣，例：[ ] 或描述 |
| created_at | TIMESTAMP | 自動建立 |
| updated_at | TIMESTAMP | 自動更新 |

---

## 子任務清單

---

### 子任務 1 — 專案初始化與版本庫建立

**目的：** 建立 monorepo 結構、工具鏈與 CI/CD 基礎，確保後續子任務在一致的開發環境中進行。

**預期成果：**
- Git repository 初始化，包含 monorepo 目錄結構（`/frontend`、`/backend`）
- Angular 專案建立並啟用 PWA 支援
- Spring Boot 專案建立並包含所需相依套件
- `.gitignore`、`README.md` 與基本專案文件就位
- Zeabur 專案建立並與 repository 連結

**待辦清單：**
- [ ] 初始化 Git repository（GitHub：https://github.com/kotaro-jolyne-0025/dnd-adventure-log.git）
- [ ] 建立 Angular 應用程式：`ng new frontend --routing --style=scss`
- [ ] 加入 Angular PWA：`ng add @angular/pwa`
- [ ] 透過 Spring Initializr 建立 Spring Boot 專案，相依套件：Spring Web、Spring Data JPA、PostgreSQL Driver、Lombok、Validation
- [ ] 設定 monorepo 目錄結構：`/frontend`、`/backend`
- [ ] 新增根目錄 `.gitignore`（涵蓋 Java、Node、Angular 建置產物）
- [ ] 建立 `README.md`，包含專案說明與本機開發指引
- [ ] 初始 commit 並 push 至 GitHub
- [ ] 在 Zeabur 建立專案，連結 GitHub repo，設定前端（靜態）與後端（Java）服務

**相關資源：**
- Spring Initializr：https://start.spring.io
- Angular CLI 文件：https://angular.io/cli
- Zeabur 文件：https://zeabur.com/docs

**狀態：** `[ ] 待執行`

---

### 子任務 2 — 資料庫 Schema 與 Supabase 設定

**目的：** 在 Supabase 建立 PostgreSQL Schema，並設定 Spring Boot 資料來源連線，使後端可以持久化資料。

**預期成果：**
- Supabase 專案建立，`character` 與 `adventure_entry` 資料表對應上方資料模型
- Spring Boot `application.properties` 設定完成並連線至 Supabase PostgreSQL
- Spring Boot 啟動時 Hibernate DDL 驗證通過
- 環境變數（DB URL、帳號、密碼）透過 Zeabur 環境設定管理，不寫入程式碼

**待辦清單：**
- [ ] 建立 Supabase 專案，記錄連線字串憑證
- [ ] 在 Supabase SQL Editor 執行 DDL SQL，建立 `character` 與 `adventure_entry` 資料表
- [ ] 設定 `application.properties`（或 `application.yml`），使用環境變數佔位符設定 Supabase DB 連線
- [ ] 加入 `spring.jpa.hibernate.ddl-auto=validate` 確保 Schema 與 Entity 一致
- [ ] 建立 JPA `@Entity` 類別：`Character`、`AdventureEntry`
- [ ] 建立 JPA `@Repository` 介面：`CharacterRepository`、`AdventureEntryRepository`
- [ ] 驗證 Spring Boot 成功啟動並連線至 Supabase

**相關資訊：**
- Supabase 連線字串格式：`jdbc:postgresql://<host>:5432/postgres`
- 使用 Zeabur 環境變數避免將機密資訊 commit 至 Git

**狀態：** `[ ] 待執行`

---

### 子任務 3 — 後端 REST API（Spring Boot）

**目的：** 實作 Character 與 AdventureEntry 的完整 REST API CRUD，包含金幣、休假天數、魔法物品的自動帶入邏輯。

**預期成果：**
- 角色 REST 端點：`GET /api/characters`、`POST /api/characters`、`GET /api/characters/{id}`、`PUT /api/characters/{id}`、`DELETE /api/characters/{id}`
- 冒險記錄 REST 端點：`GET /api/characters/{id}/entries`、`POST /api/characters/{id}/entries`、`GET /api/entries/{id}`、`PUT /api/entries/{id}`、`DELETE /api/entries/{id}`
- 搜尋端點：`GET /api/characters/{id}/entries?search={keyword}`
- 自動帶入：新增記錄時，API 自動從上一筆記錄的合計值帶入 `starting_gold`、`starting_downtime`、`starting_magic_items`
- 輸入驗證並回傳有意義的錯誤訊息
- CORS 設定允許 Angular 前端來源

**待辦清單：**
- [ ] 建立 `CharacterService`，實作 CRUD 邏輯
- [ ] 建立 `CharacterController`，實作 REST 端點
- [ ] 建立 `AdventureEntryService`，實作 CRUD 邏輯與自動帶入計算
- [ ] 建立 `AdventureEntryController`，實作 REST 端點與搜尋查詢參數
- [ ] 建立 DTO（Data Transfer Object）解耦 API 合約與 JPA Entity
- [ ] 在 DTO 加入 `@Valid` 輸入驗證標註
- [ ] 實作全域例外處理器（`@ControllerAdvice`），統一錯誤回應格式
- [ ] 在 `WebMvcConfigurer` 設定 CORS
- [ ] 使用 Postman 或 curl 測試所有端點

**相關資訊：**
- 自動帶入邏輯在 `AdventureEntryService` 中：查詢該角色最後一筆記錄，取出合計值，設為新記錄的起始值
- 記錄應依 `play_date ASC` 排序，確保帶入邏輯正確

**狀態：** `[ ] 待執行`

---

### 子任務 4 — 前端：角色管理（Angular）

**目的：** 建立 Angular 角色建立、列表、選擇畫面。

**預期成果：**
- 角色列表頁：以卡片形式顯示所有角色（名稱、種族/職業/等級、靈魂幣）
- 建立 / 編輯角色表單，包含所有 Character 資料模型欄位
- 刪除角色，附確認對話框
- 選擇角色後導覽至該角色的冒險紀錄表

**待辦清單：**
- [ ] 建立 Angular `CharacterModule`（或 Angular 17+ standalone component）
- [ ] 建立 `CharacterService`，呼叫後端 REST API
- [ ] 建立 `CharacterListComponent` — 卡片格狀排版
- [ ] 建立 `CharacterFormComponent` — Reactive Form，用於建立/編輯
- [ ] 設定路由：`/characters`（列表）、`/characters/new`（建立）、`/characters/:id/edit`（編輯）
- [ ] 使用 Angular Material Dialog（或同類元件）實作刪除確認
- [ ] 使用 Angular Material 或選定的 UI 元件庫進行樣式設計

**相關資訊：**
- Angular 路由於子任務 1 設定
- 後端 API 於子任務 3 完成後可用

**狀態：** `[ ] 待執行`

---

### 子任務 5 — 前端：冒險紀錄表 CRUD（Angular）

**目的：** 建立 Angular 冒險紀錄表查看、新增、編輯、刪除畫面。

**預期成果：**
- 冒險紀錄表列表頁：以表格/時間軸顯示角色所有記錄，依日期排序
- 記錄詳情頁：顯示所有欄位
- 新增記錄表單：`starting_*` 欄位自動從後端帶入上一筆合計值
- 編輯記錄表單
- 刪除記錄，附確認提示
- 搜尋列：依冒險代碼、名稱或日期篩選

**待辦清單：**
- [ ] 建立 `AdventureEntryModule`（或 standalone component）
- [ ] 建立 `AdventureEntryService`，呼叫後端 REST API
- [ ] 建立 `EntryListComponent` — 資料表，欄位：日期、代碼、名稱、結束等級、金幣合計、DM 名稱
- [ ] 建立 `EntryFormComponent` — Reactive Form，包含所有 AL 記錄表欄位；新增時自動帶入起始值
- [ ] 建立 `EntryDetailComponent` — 唯讀檢視，版面仿照紙本記錄表
- [ ] 設定路由：`/characters/:id/log`（列表）、`/characters/:id/log/new`（新增）、`/characters/:id/log/:entryId`（詳情/編輯）
- [ ] 在列表元件實作搜尋/篩選（呼叫搜尋 API 或前端篩選）
- [ ] 樣式參考 AL 記錄表風格（選做）

**相關資訊：**
- 自動帶入邏輯：表單初始化「新增」時，呼叫 `GET /api/characters/{id}/entries?last=true` 取得前一筆合計值
- 表單應明確分組欄位：等級、金幣、休假天數、魔法物品、備註

**狀態：** `[ ] 待執行`

---

### 子任務 6 — PWA 設定與離線支援

**目的：** 啟用 Angular PWA 功能，使應用程式可安裝至桌面，並支援離線瀏覽快取資料。

**預期成果：**
- 可透過瀏覽器「新增至主畫面」/「安裝應用程式」安裝
- App shell（導覽列、角色列表）可在離線狀態從快取載入
- Service Worker 快取靜態資源與近期記錄的 API 回應
- App Manifest 設定正確的名稱、圖示與主題色

**待辦清單：**
- [ ] 確認 `@angular/pwa` 設定正確（ngsw-config.json）
- [ ] 設定 `ngsw-config.json` 快取：App shell 靜態資源、Google Fonts（如有使用）、API GET 回應
- [ ] 設定 App Manifest：`name`、`short_name`、`theme_color`、`background_color`、圖示（512x512、192x192）
- [ ] 建立 D&D 主題應用程式圖示（可使用簡單 SVG 或免費素材）
- [ ] 在 Chrome DevTools → Application → Manifest 測試 PWA 安裝流程
- [ ] 測試離線行為：載入 App 後斷線，確認快取頁面仍可正常顯示

**相關資訊：**
- `ngsw-config.json` 為 Angular Service Worker 設定檔
- API 快取策略：記錄資料使用 `freshness`（網路優先，失敗才使用快取）

**狀態：** `[ ] 待執行`

---

### 子任務 7 — 部署至 Zeabur

**目的：** 將前端（Angular 靜態建置）與後端（Spring Boot JAR）部署至 Zeabur，設定環境變數，使應用程式可從任何裝置透過公開 URL 存取。

**預期成果：**
- Angular 應用程式部署完成，可透過 Zeabur 公開 URL 存取
- Spring Boot API 部署完成，可被 Angular 前端呼叫
- Supabase DB 連線在正式環境運作正常
- CORS 設定允許正式環境前端 URL
- 可從正式環境 URL 安裝 PWA

**待辦清單：**
- [ ] 設定 Angular `environment.prod.ts`，填入正式環境後端 API URL
- [ ] 為 Spring Boot 服務新增 `Dockerfile` 或 Zeabur 建置設定
- [ ] 設定 Zeabur 靜態網站（Angular）建置指令：`ng build --configuration production`，輸出目錄：`dist/frontend/browser`
- [ ] 在 Zeabur 設定環境變數：`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`CORS_ALLOWED_ORIGIN`
- [ ] 在 Zeabur 部署兩個服務，確認健康狀態
- [ ] 更新 Spring Boot CORS 設定，允許正式環境 Angular URL
- [ ] 在正式環境進行所有 CRUD 操作冒煙測試
- [ ] 從正式環境 URL 測試 PWA 安裝

**相關資訊：**
- Zeabur 若偵測到 `pom.xml` 會自動識別 Spring Boot 專案
- Angular 17+ 靜態輸出目錄為 `dist/<project-name>/browser`

**狀態：** `[ ] 待執行`
