# D&D 冒險日誌系統 — 系統規格書（SRS）

**版本：** 2.0 (Auth & Multi-tenancy)
**日期：** 2026
**狀態：** 規劃中

---

## 1. 系統概述

### 1.1 目的
本系統將 D&D 冒險聯盟（AL）紙本冒險記錄表數位化，提供玩家一個可搜尋、結構化的冒險日誌管理工具，並以 PWA 形式提供類 App 的使用體驗。

### 1.2 系統定位
本系統為**有結構的數位記錄工具**。數值欄位以手動填寫為主，但「合計」類欄位由系統自動計算，「起始」類欄位在新增時由系統從上一筆記錄自動帶入，以減少重複輸入與人為錯誤。

### 1.3 系統範圍
| 項目 | 說明 |
|---|---|
| 使用者 | 支援玩家個人帳號註冊登入、Google / Discord 第三方 OAuth 登入 |
| 多租戶隔離 | 每位玩家僅能檢視與管理自己所建立的角色與冒險日誌 |
| 平台 | PWA Web App，可安裝至 Windows / Mac / 手機桌面 |
| 資料儲存 | 雲端 PostgreSQL（Supabase）|
| 存取方式 | 任何裝置透過瀏覽器開啟公開 URL，經身分認證後存取個人數據 |

### 1.4 不在範圍內
- NPC 資料庫、地圖管理
- 複雜的遊戲規則自動化（例如技能檢定、法術列表管理）
- 上架 App Store / Play Store

---

## 2. 功能規格

### 2.0 會員與身份驗證（Authentication & Authorization）

#### 2.0.1 使用者資料欄位 (users)
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| id | UUID | ✅ | 主鍵，自動生成 |
| email | 文字（最多 255 字）| ✅ | 唯一值，登入帳號 |
| password_hash | 文字（最多 255 字）| ❌ | BCrypt 雜湊密碼（純第三方登入時為 NULL） |
| display_name | 文字（最多 100 字）| ✅ | 顯示名稱（玩家名稱） |
| avatar_url | 文字（最多 500 字）| ❌ | 大頭貼 URL（OAuth 自動帶入） |
| is_active | 布林值 | ✅ | 帳號狀態（預設 TRUE） |

#### 2.0.2 第三方綁定欄位 (user_oauth_accounts)
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| id | UUID | ✅ | 主鍵 |
| user_id | UUID | ✅ | 外鍵關聯 users(id) |
| provider | 文字 (50) | ✅ | 第三方來源：`GOOGLE`、`DISCORD` |
| provider_user_id | 文字 (255) | ✅ | 第三方使用者 ID |
| email | 文字 (255) | ❌ | 第三方回傳之 Email |

#### 2.0.3 功能清單
| 功能 | 說明 |
|---|---|
| 帳號密碼註冊 | 輸入 Email、密碼（>=6字元）、顯示名稱註冊並自動登入 |
| 帳號密碼登入 | 輸入 Email 與密碼進行身分校驗，發放 JWT Token |
| Google OAuth 登入 | 前端/後端串接 Google OAuth 2.0 授權，自動建立或登入帳號 |
| Discord OAuth 登入 | 前端/後端串接 Discord OAuth 2.0 授權，自動建立或登入帳號 |
| 修改個人顯示名稱 | 玩家可隨時開啟彈窗自訂修改顯示名稱 (暱稱)，即時同步全站導覽列與後端資料庫 |
| 身分攔截與隔離 | 前端路由未登入守衛 (AuthGuard)、後端 JWT 認證過濾與資料所有權校驗 |

### 2.1 角色管理（Character Management）

#### 2.1.1 角色資料欄位
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| 角色名稱 | 文字（最多 100 字）| ✅ | 例：亞夢 |
| 玩家名稱 | 文字（最多 100 字）| ✅ | 新增時預設自動帶入當前登入者顯示名稱，可手動修改 |
| 種族 | 文字（最多 100 字）| ✅ | 例：阿斯莫 |
| 職業/等級（動態列）| 陣列，每筆含職業名稱（ENUM）＋等級數字 | ✅ 至少一筆 | 例：聖騎士 Lv.6、術士 Lv.4 |
| 派系 | 文字（最多 100 字）| ❌ | 選填 |

**職業 ENUM 選項（共 13 種官方核心職業）：**
`戰士` `法師` `牧師` `遊蕩者` `遊俠` `吟遊詩人` `德魯伊` `武僧` `聖騎士` `契術師` `術士` `野蠻人` `奇械師`

#### 2.1.2 功能清單
| 功能 | 說明 |
|---|---|
| 建立角色 | 填寫表單新增角色，可「開卡」設定起始職業與等級（可兼職） |
| 查看角色列表 | 卡片形式顯示所有角色 |
| 編輯角色 | 修改角色基本資料（名稱、玩家、種族、派系）；職業/等級於建立開卡後鎖定為唯讀，僅能透過冒險升級記錄推進 |
| 刪除角色 | 刪除角色及其所有冒險記錄與倉庫物品（連帶刪除）|

---

### 2.2 冒險日誌管理（Adventure Log Management）

#### 2.2.1 冒險記錄欄位
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| 冒險代碼 | 文字（最多 100 字）| ❌ | 例：CCC-GHC-BK2-07 |
| 冒險名稱 | 文字（最多 255 字）| ❌ | 例：死亡騎士 |
| 遊玩日期 | 日期 | ✅ | 新增時預設為當天日期，可手動修改 |
| DM 名稱 | 文字（最多 100 字）| ❌ | 例：蔚浩 |
| 起始等級 | 整數 | ❌ | 新增時自動從上一筆結束等級帶入，可手動修改 |
| 結束等級 | 整數 | ❌ | 手動填寫 |
| 起始金幣 | 數字（小數點後 2 位）| ❌ | 新增時自動從上一筆金幣合計帶入，可手動修改 |
| 金幣變化 | 數字（小數點後 2 位）| ❌ | 正負值均可 |
| 金幣合計 | 數字（小數點後 2 位）| ❌ | **系統計算（起始金幣 + 金幣變化），不可手動修改** |
| 起始休假天數 | 整數 | ❌ | 新增時自動從上一筆休假合計帶入，可手動修改 |
| 休假天數變化 | 整數 | ❌ | 正負值均可 |
| 休假天數合計 | 整數 | ❌ | **系統計算（起始休假 + 休假變化），不可手動修改** |
| 起始魔法物品數 | 整數 | ❌ | 新增時自動從上一筆魔法物品合計帶入，可手動修改 |
| 魔法物品變化 | 整數 | ❌ | 正負值均可 |
| 魔法物品合計 | 整數 | ❌ | **系統計算（起始魔法物品 + 魔法物品變化），不可手動修改** |
| 冒險備註 | 長文字 | ❌ | 自由填寫 |
| 靈魂幣使用 | 文字 | ❌ | 自由填寫 |

**自動帶入邏輯：**
新增記錄時，後端查詢該角色最後一筆記錄（依 `play_date` + `created_at` 降序），取出 `ending_level`、`gold_total`、`downtime_total`、`magic_items_total`，作為新記錄的起始值回傳給前端預填。

**升級與職業配置規則（靈活配置）：**
1. **升級觸發**：當勾選「是否升級：是」（`ending_level = starting_level + 1`）或選擇「迎頭趕上」（依等級規則增加結束等級）。
2. **職業等級分配選單**：表單即時展開「職業與等級配置列表」（預設帶入角色當前職業陣列），玩家可自由增減兼職與調整各職業等級。
3. **驗證規則**：各職業等級加總必須等於升級後的結束總等級（`SUM(classLevels.level) === ending_level`）。
4. **角色狀態同步**：冒險記錄儲存時，將同步更新該角色的當前職業配置（`character_class_level`）。

**合計計算邏輯（後端儲存時執行）：**
- `gold_total = starting_gold + gold_change`
- `downtime_total = starting_downtime + downtime_change`
- `magic_items_total = starting_magic_items + magic_items_change`

#### 2.2.2 休整期活動欄位
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| 活動描述 | 長文字 | ❌ | 自由文字，例：迎頭趕上 −10天 術師→5 |

#### 2.2.3 功能清單
| 功能 | 說明 |
|---|---|
| 新增冒險記錄 | 填寫表單，起始值自動帶入，合計由系統計算 |
| 查看冒險日誌列表 | 表格形式，依遊玩日期由舊到新排序 |
| 查看冒險記錄詳情 | 分區塊顯示（基本資訊 / 資源變動 / 備註 / 休整期活動）|
| 編輯冒險記錄 | 修改記錄資料 |
| 刪除冒險記錄 | 刪除單筆記錄 |
| 新增休整期活動 | 在冒險記錄下附加純文字活動描述 |
| 編輯休整期活動 | 修改活動描述 |
| 刪除休整期活動 | 刪除單筆休整期活動 |

---

### 2.3 倉庫管理（Inventory Management）

#### 2.3.1 物品欄位
| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| 物品名稱 | 文字（最多 255 字）| ✅ | 例：+1 長劍 |
| 類型 | ENUM | ✅ | PERMANENT（永久魔法物品）/ CONSUMABLE（消耗品）|
| 稀有度 | ENUM | ❌ | COMMON / UNCOMMON / RARE / VERY_RARE / LEGENDARY |
| 數量 | 整數 | ❌ | 預設 1 |
| 取得來源 | 文字（最多 255 字）| ❌ | 自由文字，例：死亡騎士 |
| 備註 | 長文字 | ❌ | 自由文字 |

#### 2.3.2 功能清單
| 功能 | 說明 |
|---|---|
| 查看倉庫 | 分兩個 Tab：永久魔法物品 / 消耗品 |
| 新增物品 | 從對應 Tab 新增，類型自動帶入 |
| 編輯物品 | 修改物品資料（含數量）|
| 刪除物品 | 刪除單筆物品 |

---

## 3. API 規格

### 3.1 基礎 URL
```
開發環境：http://localhost:8080/api
正式環境：https://<zeabur-backend-url>/api
```

### 3.2 角色 API

| 方法 | 端點 | 說明 | 回應碼 |
|---|---|---|---|
| GET | `/characters` | 取得所有角色列表 | 200 |
| POST | `/characters` | 建立新角色 | 201 |
| GET | `/characters/{id}` | 取得單一角色 | 200 / 404 |
| PUT | `/characters/{id}` | 更新角色資料 | 200 / 404 |
| DELETE | `/characters/{id}` | 刪除角色（連帶刪除所有冒險記錄與倉庫）| 204 / 404 |

#### POST /characters 請求範例
```json
{
  "characterName": "亞夢",
  "playerName": "可嵐",
  "race": "阿斯莫",
  "classLevels": [
    { "className": "聖騎士", "level": 6 },
    { "className": "術士", "level": 4 }
  ],
  "faction": ""
}
```

#### GET /characters 回應範例
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "characterName": "亞夢",
    "playerName": "可嵐",
    "race": "阿斯莫",
    "classLevels": [
      { "className": "聖騎士", "level": 6 },
      { "className": "術師", "level": 4 }
    ],
    "faction": "",
    "createdAt": "2025-01-01T00:00:00",
    "updatedAt": "2025-01-01T00:00:00"
  }
]
```

---

### 3.3 冒險記錄 API

| 方法 | 端點 | 說明 | 回應碼 |
|---|---|---|---|
| GET | `/characters/{id}/entries` | 取得角色所有冒險記錄（依日期升序）| 200 |
| GET | `/characters/{id}/entries/defaults` | 取得新增記錄的預設起始值 | 200 |
| POST | `/characters/{id}/entries` | 新增冒險記錄 | 201 |
| GET | `/entries/{id}` | 取得單筆記錄詳情 | 200 / 404 |
| PUT | `/entries/{id}` | 更新冒險記錄 | 200 / 404 |
| DELETE | `/entries/{id}` | 刪除冒險記錄 | 204 / 404 |

#### GET /characters/{id}/entries/defaults 回應範例
前端新增記錄時呼叫，取得自動帶入的起始值：
```json
{
  "startingLevel": 8,
  "startingGold": 4756.66,
  "startingDowntime": 90,
  "startingMagicItems": 10
}
```
> 若無前一筆記錄，所有欄位回傳 `null`。

#### POST /characters/{id}/entries 請求範例
```json
{
  "adventureCode": "CCC-GHC-BK2-07",
  "adventureName": "死亡騎士",
  "playDate": "2025-11-20",
  "dmName": "蔚浩",
  "startingLevel": 7,
  "endingLevel": 8,
  "startingGold": 3756.66,
  "goldChange": 1000.00,
  "startingDowntime": 80,
  "downtimeChange": 10,
  "startingMagicItems": 9,
  "magicItemsChange": 1,
  "adventureNotes": "擊敗死亡騎士",
  "soulCoinChargesUsed": ""
}
```
> `goldTotal`、`downtimeTotal`、`magicItemsTotal` 由後端計算，不需由前端傳入。

---

### 3.4 休整期活動 API

| 方法 | 端點 | 說明 | 回應碼 |
|---|---|---|---|
| GET | `/entries/{id}/downtime-activities` | 取得記錄的所有休整期活動 | 200 |
| POST | `/entries/{id}/downtime-activities` | 新增休整期活動 | 201 |
| PUT | `/downtime-activities/{id}` | 更新休整期活動 | 200 / 404 |
| DELETE | `/downtime-activities/{id}` | 刪除休整期活動 | 204 / 404 |

#### POST /entries/{id}/downtime-activities 請求範例
```json
{
  "description": "迎頭趕上 −10天 術師→5"
}
```

---

### 3.5 倉庫 API

| 方法 | 端點 | 說明 | 回應碼 |
|---|---|---|---|
| GET | `/characters/{id}/inventory` | 取得角色所有物品 | 200 |
| GET | `/characters/{id}/inventory?type=PERMANENT` | 依類型篩選 | 200 |
| GET | `/characters/{id}/inventory?type=CONSUMABLE` | 依類型篩選 | 200 |
| POST | `/characters/{id}/inventory` | 新增物品 | 201 |
| PUT | `/inventory/{id}` | 更新物品 | 200 / 404 |
| DELETE | `/inventory/{id}` | 刪除物品 | 204 / 404 |

#### POST /characters/{id}/inventory 請求範例
```json
{
  "itemName": "+1 長劍",
  "itemType": "PERMANENT",
  "rarity": "UNCOMMON",
  "quantity": 1,
  "source": "死亡騎士",
  "notes": ""
}
```

---

### 3.6 統一錯誤回應格式
```json
{
  "timestamp": "2025-01-01T00:00:00",
  "status": 404,
  "error": "Not Found",
  "message": "找不到角色 ID：550e8400-e29b-41d4-a716-446655440000",
  "path": "/api/characters/550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 4. 資料庫設計

詳見 `database-schema.md`

---

## 5. 畫面導覽結構

```
角色列表（/characters）
├── 新增角色（/characters/new）
├── 編輯角色（/characters/:id/edit）
└── 角色頁（/:id）
    ├── 冒險日誌列表（/characters/:id/log）
    │   ├── 新增冒險記錄（/characters/:id/log/new）
    │   └── 冒險記錄詳情（/characters/:id/log/:entryId）
    │       ├── 編輯冒險記錄（/characters/:id/log/:entryId/edit）
    │       └── 休整期活動（附屬於詳情頁，不獨立路由）
    └── 倉庫（/characters/:id/inventory）
        ├── 永久魔法物品 Tab
        └── 消耗品 Tab
```

---

## 6. 非功能性需求

| 項目 | 需求 |
|---|---|
| **效能** | 頁面載入時間 < 3 秒（正常網路環境）|
| **可用性** | 正式環境服務可用率 > 99%（依 Zeabur / Supabase 免費層 SLA）|
| **安全性** | 資料庫憑證不得寫入程式碼，須使用環境變數管理 |
| **相容性** | 支援 Chrome、Edge 最新版本（PWA 安裝功能）|
| **離線支援** | 已載入資料可在離線狀態瀏覽 |

---

## 7. 測試規格

### 7.1 測試類型
| 類型 | 工具 | 範圍 |
|---|---|---|
| 單元測試（後端）| JUnit 5 | Service 層業務邏輯 |
| 整合測試（後端）| Spring Boot Test | Controller + Repository |
| 端對端測試（前端）| 手動測試 | 主要 User Story 驗收條件 |

### 7.2 關鍵測試案例
| 測試案例 | 說明 |
|---|---|
| TC-001 | 建立角色時角色名稱為空，應回傳 400 驗證錯誤 |
| TC-002 | 建立角色時職業/等級列表為空，應回傳 400 驗證錯誤 |
| TC-003 | 新增冒險記錄，所有欄位為空仍應成功儲存（全部選填）|
| TC-004 | 刪除角色後，該角色所有冒險記錄與倉庫物品應一併刪除 |
| TC-005 | 取得冒險記錄列表，應依 play_date 升序排列 |
| TC-006 | 新增倉庫物品，物品名稱為空應回傳 400 驗證錯誤 |
| TC-007 | 依 type=PERMANENT 篩選倉庫，應只回傳永久魔法物品 |
| TC-008 | 新增冒險記錄時，`gold_total` 應等於 `starting_gold + gold_change` |
| TC-009 | 新增冒險記錄時，`downtime_total` 應等於 `starting_downtime + downtime_change` |
| TC-010 | 新增冒險記錄時，`magic_items_total` 應等於 `starting_magic_items + magic_items_change` |
| TC-011 | GET /entries/defaults：有前一筆記錄時，應回傳正確的帶入值 |
| TC-012 | GET /entries/defaults：無任何記錄時，所有起始值應回傳 null |
| TC-013 | 角色卡片「目前等級」應等於最後一筆冒險記錄的 ending_level |

---

## 8. 部署架構

```
[使用者瀏覽器]
      |
      | HTTPS
      ↓
[Angular PWA — Zeabur 靜態網站]
      |
      | REST API (HTTPS)
      ↓
[Spring Boot API — Zeabur Java 服務]
      |
      | JDBC (SSL)
      ↓
[PostgreSQL — Supabase]
```

### 8.1 環境說明
| 環境 | 前端 URL | 後端 URL |
|---|---|---|
| 開發 | http://localhost:4200 | http://localhost:8080 |
| 正式 | https://<zeabur-frontend>.zeabur.app | https://<zeabur-backend>.zeabur.app |

### 8.2 環境變數清單（後端）
| 變數名稱 | 說明 |
|---|---|
| `DB_URL` | Supabase JDBC 連線字串 |
| `DB_USERNAME` | 資料庫帳號 |
| `DB_PASSWORD` | 資料庫密碼 |
| `CORS_ALLOWED_ORIGIN` | 允許的前端 URL（正式環境）|
