# D&D 冒險紀錄系統 — 系統規格書（SRS）

## 2026-09-17 安全修正補充（優先於舊版同步描述）

- 登出、登入及角色資料異動時，相關快取與進行中的讀取請求一併失效；舊請求不得在失效後回填或重播資料。
- 冒險／倉庫異動先清除角色、冒險、預設值及倉庫快取，再通知 HUD 更新。
- 編輯冒險須成功載入主記錄、獲得物品及故事獎勵後才可儲存；讀取錯誤不得視為空清單。載入失敗可重試。
- 完整儲存 API 的三種子清單皆必須明確提供，省略或 null 回傳驗證錯誤；空陣列代表明確移除該類子項目。
- 歷史倉庫 ID 僅在同角色、未綁定其他快照且屬於該冒險時，允許補建快照。無冒險 ID 時僅接受來源精確且唯一匹配，禁止模糊認領。
- 倉庫寫入的冒險 ID、快照 ID 必須屬於當前角色且互相一致，不能跨角色／跨冒險綁定。
- 一般倉庫編輯省略關聯 ID 時保留原本來源，不因編輯名稱／數量而斷開快照關聯。

驗證紀錄：前端 18 個測試與 production build 通過；後端新增 14 個回歸測試，
但 Maven Central DNS 解析失敗，尚未完成後端編譯／測試。V16–V19 未在本輪更動，
仍需在隔離 PostgreSQL 環境驗證 migration 與交易回滾後再合併。


**版本：** 2.2 (Mobile UX & Real-time HUD)
**日期：** 2026
**狀態：** 已實作上線

---

## 1. 系統概述

### 1.1 目的

本系統將 D&D 冒險聯盟（AL）紙本冒險紀錄表數位化，提供玩家一個可搜尋、結構化的冒險紀錄表 (Logsheet) 管理工具，並以 PWA 形式提供類 App 與手機端最佳化的流暢使用體驗。

### 1.2 系統定位

本系統為**有結構的數位記錄工具**。玩家只填本次變化；「起始」與「合計」由系統計算並以唯讀方式呈現，以減少重複輸入與人為錯誤。

### 1.3 系統範圍

| 項目 | 說明 |
| --- | --- |
| 使用者 | 支援玩家個人帳號註冊登入、Google / Discord 第三方 OAuth 登入 |
| 多租戶隔離 | 每位玩家僅能檢視與管理自己所建立的角色與冒險紀錄 |
| 平台 | PWA Web App，支援桌機、平板與全螢幕手機端適配（含 Safe-Area 與觸控熱區） |
| 資料儲存 | 雲端 PostgreSQL（Supabase） |
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
| --- | --- | --- | --- |
| id | UUID | ✅ | 主鍵，自動生成 |
| email | 文字（最多 255 字） | ✅ | 唯一值，登入帳號 |
| password_hash | 文字（最多 255 字） | ❌ | BCrypt 雜湊密碼（純第三方登入時為 NULL） |
| display_name | 文字（最多 100 字） | ✅ | 顯示名稱（玩家名稱） |
| avatar_url | 文字（最多 500 字） | ❌ | 大頭貼 URL（OAuth 自動帶入） |
| is_active | 布林值 | ✅ | 帳號狀態（預設 TRUE） |

#### 2.0.2 第三方綁定欄位 (user_oauth_accounts)

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | UUID | ✅ | 主鍵 |
| user_id | UUID | ✅ | 外鍵關聯 users(id) |
| provider | 文字 (50) | ✅ | 第三方來源：`GOOGLE`、`DISCORD` |
| provider_user_id | 文字 (255) | ✅ | 第三方使用者 ID |
| email | 文字 (255) | ❌ | 第三方回傳之 Email |

#### 2.0.3 重設密碼資料欄位 (password_reset_tokens)

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | UUID | ✅ | 主鍵，自動生成 |
| user_id | UUID | ✅ | 外鍵關聯 users(id) ON DELETE CASCADE |
| token | 文字（最多 255 字） | ✅ | 重設驗證 Token |
| expiry_time | TIMESTAMP | ✅ | Token 過期時間（預設有效期限 15 分鐘） |
| used_at | TIMESTAMP | ❌ | 使用時間（NULL 表示尚未被使用） |
| created_at | TIMESTAMP | ✅ | 建立時間 |

#### 2.0.4 功能清單

| 功能 | 說明 |
| --- | --- |
| 帳號密碼註冊 | 輸入 Email、密碼（>=8字元）、顯示名稱註冊並自動登入 |
| 帳號密碼登入 | 輸入 Email 與密碼進行身分校驗，發放 JWT Token |
| 忘記密碼申請 | 輸入已註冊 Email，系統生成 15 分鐘內有效之安全 Token 並寄送重設信件 |
| 重設密碼確認 | 透過 Token 驗證身分，輸入新密碼（>=8字元）完成重設並引導登入 |
| Google OAuth 登入 | 前端/後端串接 Google OAuth 2.0 授權，自動建立或登入帳號 |
| Discord OAuth 登入 | 前端/後端串接 Discord OAuth 2.0 授權，自動建立或登入帳號 |
| 修改個人顯示名稱 | 玩家可隨時開啟彈窗自訂修改顯示名稱 (暱稱)，即時同步全站導覽列與後端資料庫 |
| 身分攔截與隔離 | 前端路由未登入守衛 (AuthGuard)、後端 JWT 認證過濾與資料所有權校驗 |

### 2.1 角色管理（Character Management）

#### 2.1.1 角色資料欄位

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| 角色名稱 | 文字（最多 100 字） | ✅ | 例：亞夢 |
| 玩家名稱 | 文字（最多 100 字） | ❌ | 由會員帳號 `user_id` 關聯 `users.display_name` 提供單一真實來源，表單不再重複填寫 |
| 種族 | 文字（最多 100 字） | ✅ | 例：阿斯莫 |
| 職業/等級（動態列） | 陣列，每筆含英文標準職業識別值＋等級數字 | ✅ 至少一筆 | 保存為不可空白的開卡基準；DB/API 例：`Paladin6/Sorcerer4`；前端依中文對照表顯示 |
| 開卡金幣／休整期 | 金額／非負整數 | ❌ | 開卡基準，預設皆為 0；後續冒險變化累計於其上 |
| 開卡魔法物品 | 倉庫永久物品明細 | ❌ | 於角色倉庫建立；數量由永久物品 `quantity` 加總，不另存開卡數字 |
| 子職 | 文字（最多 100 字） | ❌ | 選填，例：狂戰士、復仇之誓 |
| 派系 | 文字（最多 100 字） | ❌ | 選填 |
| 角色大頭貼 | 文字（TEXT / DataURL / URL） | ❌ | 選填，300x300 WebP 肖像圖 |

**職業識別值（共 13 種官方核心職業）：**
`Fighter` `Wizard` `Cleric` `Rogue` `Ranger` `Bard` `Druid` `Monk` `Paladin` `Warlock` `Sorcerer` `Barbarian` `Artificer`。資料庫與 API 使用英文值；中文名稱由前端對照表決定（例如 `Warlock` 可顯示為「邪術士」或其他玩家慣用譯名），不得以顯示文字作為儲存識別值。

#### 2.1.2 功能清單

| 功能 | 說明 |
| --- | --- |
| 建立角色 | 填寫表單新增角色，可「開卡」設定起始職業、等級、金幣與休整期；開卡物品於角色倉庫建立 |
| 查看角色列表 | 卡片形式顯示所有角色，小螢幕自動切換為單欄滿版網格 |
| 角色戰情看板 (HUD) | 頂部展示「等級、金幣、休整期天數、魔法物品」4 大核心指標，手機端以 2×2 網格呈現；支援即時響應流，刪除/新增紀錄自動同步最新數值 |
| 編輯角色 | 從 character-shell 編輯基本資料及開卡基準；已有冒險時先預覽重算後的目前職業／資源，確認後更新，既有冒險快照與倉庫物品不自動修改 |
| 刪除角色 | 刪除角色及其所有冒險記錄與倉庫物品（連帶刪除） |

---

### 2.2 冒險紀錄表管理（Adventure Log Management）

#### 2.2.1 冒險記錄欄位

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| 冒險代碼 | 文字（最多 100 字） | ❌ | 例：CCC-GHC-BK2-07 |
| 冒險名稱 | 文字（最多 255 字） | ❌ | 例：死亡騎士 |
| 遊玩日期 | 日期 | ✅ | 新增時預設為當天日期，可手動修改 |
| DM 名稱 | 文字（最多 100 字） | ❌ | 例：蔚浩 |
| 起始等級 | 整數 | ❌ | 系統依日期前置快照計算，唯讀 |
| 等級／職業變化 | 整數清單 | ❌ | 非負；職業增加合計必須等於總等級變化，結束總等級不得超過 20 |
| 起始金幣 | 數字（小數點後 2 位） | ❌ | 系統依日期前置快照計算，僅供計算與詳情檢視；新增／編輯表單不顯示 |
| 金幣冒險變化 | 數字（小數點後 2 位） | ❌ | 正負值均可 |
| 金幣休整期變化 | 數字（小數點後 2 位） | ❌ | 正負值均可 |
| 金幣合計 | 數字（小數點後 2 位） | ❌ | **系統計算（起始值 + 冒險變化 + 休整期變化），不可手動修改；表單結算卡只顯示本筆冒險與休整期的變動，詳情顯示起始值／變化值／合計，金額最多顯示至小數點後兩位並省略尾端零** |
| 起始休整期天數 | 整數 | ❌ | 系統依日期前置快照計算，僅供計算與詳情檢視；新增／編輯表單不顯示 |
| 休整期天數冒險變化 | 整數 | ❌ | 正負值均可 |
| 休整期天數休整期變化 | 整數 | ❌ | 正負值均可 |
| 休整期天數合計 | 整數 | ❌ | **系統計算（起始值 + 冒險變化 + 休整期變化），不可手動修改；表單結算卡只顯示本筆冒險與休整期的淨變動，詳情顯示起始值／變化值／合計** |
| 起始魔法物品數 | 整數 | ❌ | 系統依日期前置快照計算，僅供計算與詳情檢視；新增／編輯表單不顯示 |
| 魔法物品冒險變化 | 整數 | ❌ | 正負值均可 |
| 魔法物品休整期變化 | 整數 | ❌ | 正負值均可 |
| 魔法物品合計 | 整數 | ❌ | **系統計算（起始值 + 冒險變化 + 休整期變化），不可手動修改；表單結算卡只顯示本筆冒險與休整期的淨變動，詳情顯示起始值／變化值／合計** |
| 冒險備註 | 長文字 | ❌ | 自由填寫 |
| 靈魂幣使用 | 文字 | ❌ | 自由填寫 |

儲存冒險紀錄時，正數魔法物品變化的合計必須與已填物品明細數量完全相同；每筆永久物品明細計 1 件，消耗品依數量計算。數量不符時阻止儲存，不得自動建立待補物品或調整變化數字；負數變化代表失去物品，不要求新增物品明細。

**自動帶入邏輯：**
新增或補登時，後端依 `play_date, created_at, id` 找出日期位置的前一筆快照；若沒有前置紀錄，使用角色開卡職業／等級、金幣及休整期基準，魔法物品取未關聯冒險的倉庫永久物品數量。補登與改日期只重算被操作紀錄，不改寫後續歷史快照；character 仍累計所有紀錄的變化。

**升級與職業配置規則（靈活配置）：**

1. **升級觸發**：當勾選「是否升級：是」（`ending_level = starting_level + 1`）或選擇「迎頭趕上」（依等級規則增加結束等級）。
2. **職業等級分配選單**：表單即時展開「職業與等級配置列表」（預設帶入角色當前職業陣列），玩家可自由增減兼職與調整各職業等級。
3. **驗證規則**：各職業等級加總必須等於升級後的結束總等級（`SUM(classLevels.level) === ending_level`）。
4. **角色狀態同步**：新增套用本次變化，修改只套用新舊差額，刪除只撤回最後保存的變化，結果保存至 `character`。

**合計計算邏輯（前端即時 computed 反應，後端儲存時嚴格驗算）：**

- `gold_total = starting_gold + gold_change + gold_downtime_change`
- `downtime_total = starting_downtime + downtime_change + downtime_downtime_change`
- `magic_items_total = starting_magic_items + magic_items_change + magic_items_downtime_change`

#### 2.2.2 休整期活動欄位

| 欄位名稱 | 類型 | 必填 | 說明 |
|---|---|---|---|
| 活動描述 | 長文字 | ❌ | 自由文字，例：迎頭趕上 −10天 術士→5 |

#### 2.2.3 故事獎勵欄位 (Story Awards)

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | UUID | ✅ | 主鍵，自動生成 |
| adventure_entry_id | UUID | ✅ | 外鍵關聯 adventure_entry(id) ON DELETE CASCADE |
| 獎勵名稱 (award_name) | 文字（最多 255 字） | ✅ | 故事獎勵名稱，例：命運始動、巨龍之友 |
| 敘述 (description) | 長文字 | ❌ | 故事獎勵之背景、恩惠效果、代價或劇情影響說明 |

#### 2.2.4 功能清單

| 功能 | 說明 |
| --- | --- |
| 新增冒險記錄 | 表單只輸入本次變化，不顯示資源起始值；合計即時由系統計算，詳情仍呈現起始值／變化值／合計；採用獨立資源卡片（金幣/休整期/魔法物品）與即時合計徽章；支援記錄永久魔法物品、消耗品及故事獎勵 |
| 查看冒險紀錄表 | 時間軸卡片形式，依遊玩日期由舊到新排序，展示等級推進、數值 Delta 變動標籤與**故事獎勵星星膠囊 (`⭐ 故事獎勵名稱`)**；頂部搜尋欄支援即時全文搜尋冒險名稱、代碼、DM 以及**故事獎勵名稱** |
| 查看冒險記錄詳情 | 分區塊顯示（基本資訊 / 資源變動 / 備註 / 獲得永久性魔法物品 / 獲得消耗品 / 休整期活動 / **故事獎勵卡片**）；戰利品直接讀取冒險專屬快照表 (`adventure_gained_item`)，故事獎勵直接讀取 (`adventure_story_award`) |
| 編輯冒險記錄 | 修改記錄資料；全面開放編輯與刪除歷史戰利品、休整期活動與故事獎勵；故事獎勵支援增刪修連帶同步 |
| 刪除冒險記錄 | 刪除單筆記錄時，資料庫以級聯 (`ON DELETE CASCADE`) 自動連帶刪除該冒險建立之倉庫物品與**故事獎勵**；後端全維度回退角色等級與職業字串至上一筆冒險狀態；觸發全域廣播使頂部 HUD 看板數值即時同步回退 |
| 新增休整期活動 | 在冒險記錄下附加純文字活動描述 |
| 編輯休整期活動 | 修改活動描述 |
| 刪除休整期活動 | 刪除單筆休整期活動 |
| 故事獎勵維護 | 支援於冒險表單內動態增減與編輯故事獎勵，並於清單與詳情中完整呈現 |

---

### 2.3 倉庫管理（Inventory Management）

#### 2.3.1 物品欄位

| 欄位名稱 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| id | UUID | ✅ | 主鍵，自動生成 |
| character_id | UUID | ✅ | 外鍵關聯 character(id) ON DELETE CASCADE |
| adventure_entry_id | UUID | ❌ | 外鍵關聯 adventure_entry(id) ON DELETE CASCADE（由冒險產出時寫入，手動開卡/新增時為 NULL） |
| adventure_gained_item_id | UUID | ❌ | 外鍵關聯 adventure_gained_item(id) ON DELETE CASCADE（精準綁定冒險獲得快照項，實現 Delta Sync 差額同步） |
| 物品名稱 | 文字（最多 255 字） | ✅ | 物品名稱 |
| 類型 | ENUM | ✅ | PERMANENT（永久魔法物品）/ CONSUMABLE（消耗品） |
| 稀有度 | ENUM | ❌ | COMMON / UNCOMMON / RARE / VERY_RARE / LEGENDARY / ARTIFACT |
| 物品分類 | ENUM | ❌ | ARMOR / POTION / RING / ROD / SCROLL / STAFF / WAND / WEAPON / WONDROUS_ITEM；選填單選，永久物品及消耗品皆可使用；下拉選單顯示中文 (官方英文)，清單膠囊僅顯示中文 |
| 數量 | 整數 | ❌ | 預設 1 |
| 取得來源 | 文字（最多 255 字） | ❌ | 自由文字（例：冒險代碼或活動名稱） |
| 備註 | 長文字 | ❌ | 自由文字（統一簡稱「備註」） |
| created_at | TIMESTAMP | ❌ | 取得時間（由系統記錄，於介面展示為 `取得時間：YYYY/MM/dd`） |

#### 2.3.2 功能清單

| 功能 | 說明 |
| --- | --- |
| 查看倉庫 | 分兩個 Tab：永久魔法物品 / 消耗品；卡片完整展示名稱、稀有度、選填分類膠囊（稀有度附近）、數量、來源與「取得時間」；未指定分類不顯示膠囊；全站統一使用 Lucide SVG 現代線條圖示 |
| 雙向排序 | 頂部提供一體化膠囊排序按鈕，支援依「取得時間」進行「由新到舊 (最新在先)」與「由舊到新 (最舊在先)」雙向即時切換，並自動持久化記憶於 `localStorage` |
| 新增物品 | 從對應 Tab 新增，類型自動帶入；可選擇單一物品分類；手動新增之物品其 `adventure_entry_id` 為 NULL |
| 編輯物品 | 修改物品資料（含數量、稀有度、物品分類、來源、備註）；分類可清除 |
| 消耗物品 | 點擊「使用 ( -1 )」快速扣減消耗品數量，用盡時自倉庫移除；**倉庫道具之日常消耗不影響來源冒險記錄的歷史快照** |
| 刪除物品 | 刪除單筆物品；僅自倉庫背包移除，**來源冒險記錄之獲得快照維持不變** |

---

### 2.6 版權聲明與法律合規規範（Legal & Compliance）

#### 2.6.1 聲明條款類別與內容

| 聲明類別 | 必備性 | 繁中內容摘要（威世智官方指定） | 英文標準原文 (Mandatory Notice) |
| --- | --- | --- | --- |
| **威世智同好內容標準宣告** | **必備 (Mandatory)** | **「D&D 冒險紀錄表」** 屬於非官方的同好內容，並在同好內容政策的允許範圍內。未經威世智核准或背書。此內容的部分材料為威世智的財產。©威世智有限公司。 | **D&D Adventure Log** is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. |
| **商標權與標誌規範宣告** | 政策遵循 | Dungeons & Dragons, D&D, 以及其各自的標誌皆為 Wizards of the Coast LLC（威世智有限公司）的註冊商標。本站遵守政策不使用官方商標作為標識，遊戲名詞僅作識別與同好交流使用。 | Dungeons & Dragons, D&D, and their respective logos are registered trademarks of Wizards of the Coast LLC. |
| **UGC 使用者內容免責** | 責任自負 | 上傳者須保證其自製筆記、角色卡或冒險紀錄表不侵犯第三方版權。若同好內容引發法律爭端，依政策由上傳者自行承擔責任，本站與威世智不負連帶責任。 | Users are responsible for ensuring that uploaded notes, logs, or custom items do not infringe on third-party copyrights. The platform disclaims liability for UGC. |
| **免費分享與非商業宣告** | 政策合規 (Free is Free) | 依循「免費就是免費」原則，全站免費開放、不銷售同好內容、無商業廣告、不使用官方影片/音樂，嚴禁商業營利。 | This website strictly follows the "Free is Free" policy and is non-commercial and free for community use. |

#### 2.6.2 展示規格與三層架構

1. **全域頁腳（Global Footer - `AppFooterComponent`）**：
   - 部署於全站各主要頁面底部，於淺色（Style A）與深色（Style B）主題下維持清晰閱讀對比度。
   - 專注呈現純淨、乾淨的雙語官方指定標準宣告卡片（英文標準原文與繁中指定宣告）。
2. **獨立公開頁面與即時彈窗（`/legal` & `LegalNoticeDialog`）**：
   - 提供公開獨立路由 `/legal`，無需登入即可瀏覽完整條款。
   - 全域封裝為 Dialog/Modal，在日誌編輯或角色管理中點擊可即時開窗閱讀，不中斷操作流程。
3. **註冊流程合規提示（`RegisterComponent`）**：
   - 註冊按鈕下方明確標註條款同意提示，點擊可開啟條款彈窗。

---

## 3. API 規格

### 3.1 基礎 URL

```
開發環境：http://localhost:8080/api
正式環境：https://<zeabur-backend-url>/api
```

### 3.2 角色 API

| 方法 | 端點 | 說明 | 回應碼 |
| --- | --- | --- | --- |
| GET | `/characters` | 取得所有角色列表 | 200 |
| POST | `/characters` | 建立新角色 | 201 |
| GET | `/characters/{id}` | 取得單一角色 | 200 / 404 |
| PUT | `/characters/{id}` | 更新角色資料 | 200 / 404 |
| POST | `/characters/{id}/opening-baseline-preview` | 唯讀預覽修正開卡基準後的角色目前值 | 200 / 404 |
| DELETE | `/characters/{id}` | 刪除角色（連帶刪除所有冒險記錄與倉庫） | 204 / 404 |

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
| --- | --- | --- | --- |
| GET | `/characters/{id}/entries` | 取得角色所有冒險記錄（依日期升序） | 200 |
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
| --- | --- | --- | --- |
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
| --- | --- | --- | --- |
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
  "requiresAttunement": false,
  "quantity": 1,
  "source": "死亡騎士",
  "notes": ""
}
```

*註：`requiresAttunement`（是否需同調）僅適用於永久魔法物品（`itemType = PERMANENT`），型別為布林值，預設為 `false`。*

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
    ├── 冒險記錄列表（/characters/:id/log）
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
| --- | --- |
| **效能** | 頁面載入時間 < 3 秒（正常網路環境） |
| **可用性** | 正式環境服務可用率 > 99%（依 Zeabur / Supabase 免費層 SLA） |
| **安全性** | 資料庫憑證不得寫入程式碼，須使用環境變數管理 |
| **相容性** | 支援 Chrome、Edge 最新版本（PWA 安裝功能） |
| **離線支援** | 已載入資料可在離線狀態瀏覽 |

---

## 7. 測試規格

### 7.1 測試類型

| 類型 | 工具 | 範圍 |
| --- | --- | --- |
| 單元測試（後端） | JUnit 5 | Service 層業務邏輯 |
| 整合測試（後端） | Spring Boot Test | Controller + Repository |
| 端對端測試（前端） | 手動測試 | 主要 User Story 驗收條件 |

### 7.2 關鍵測試案例

| 測試案例 | 說明 |
| --- | --- |
| TC-001 | 建立角色時角色名稱為空，應回傳 400 驗證錯誤 |
| TC-002 | 建立角色時職業/等級列表為空，應回傳 400 驗證錯誤 |
| TC-003 | 新增冒險記錄，所有欄位為空仍應成功儲存（全部選填） |
| TC-004 | 刪除角色後，該角色所有冒險記錄與倉庫物品應一併刪除 |
| TC-005 | 取得冒險記錄列表，應依 play_date 升序排列 |
| TC-006 | 新增倉庫物品，物品名稱為空應回傳 400 驗證錯誤 |
| TC-007 | 依 type=PERMANENT 篩選倉庫，應只回傳永久魔法物品 |
| TC-008 | 新增冒險記錄時，`gold_total` 應等於後端決定的 `starting_gold + gold_change + gold_downtime_change`，request 不得覆寫初始與總計 |
| TC-009 | 新增冒險記錄時，`downtime_total` 應等於後端決定的 `starting_downtime + downtime_change + downtime_downtime_change` |
| TC-010 | 新增冒險記錄時，`magic_items_total` 應等於後端決定的 `starting_magic_items + magic_items_change + magic_items_downtime_change`；正數缺明細建立具來源待補物品，負數只提示前往倉庫 |
| TC-011 | GET /entries/defaults：有前一筆記錄時，應回傳正確的帶入值 |
| TC-012 | 無前置冒險時，等級／職業、金幣及休整期來自開卡基準，魔法物品來自未關聯冒險的倉庫永久物品 |
| TC-013 | 角色卡片與 character-shell 只讀取 character 目前累計值，不以日期最新快照覆蓋 |
| TC-014 | 已有冒險時預覽並確認開卡基準修正，重算 character 目前值且維持冒險快照不變；取消或預覽失敗不寫入 |

---

## 8. 部署架構

```
[使用者瀏覽器]
      |
      | HTTPS
      ↓
[Angular PWA — Firebase Hosting]
      |
      | HTTPS /api/** Hosting rewrite
      ↓
[Spring Boot API — Cloud Run (asia-east1)]
      |
      | JDBC (SSL)
      ↓
[PostgreSQL — Supabase]
```

### 8.1 環境說明

| 環境 | 前端 URL | 後端 URL |
| --- | --- | --- |
| 開發 | <http://localhost:4200> | <http://localhost:8080> |
| 正式 | https://aladvlog.com | Cloud Run service `dnd-adv-backend`，由 Firebase Hosting `/api/**` rewrite 轉送 |

正式部署由 GitHub Actions（Firebase Hosting）與 GCP Cloud Build trigger（Cloud Run）分別處理。含 Project ID、IAM 和 trigger inline 設定的本機操作手冊不納入公開 SRS。

### 8.2 環境變數清單（後端）

| 變數名稱 | 說明 |
| --- | --- |
| `DB_URL` | Supabase JDBC 連線字串 |
| `DB_USERNAME` | 資料庫帳號 |
| `DB_PASSWORD` | 資料庫密碼 |
| `CORS_ALLOWED_ORIGIN` | 允許的前端 URL（正式環境） |

---

## 9. UI/UX 設計系統與視覺標準

### 9.1 設計核心原則

- **易讀性優先 (High Legibility First)**：採用標準現代無襯線字體，中文字體 `Noto Sans TC`，英文與數字 `Inter`，確保表格與數值對齊清晰。
- **現代深色主題 (Slate Dark Palette)**：以深石板灰為基底 (`#0b0f19` / `#131b2e` / `#1e293b`)，搭配高對比純白標題 (`#f8fafc`) 與柔和次要說明文字 (`#94a3b8`)。
- **狀態與語意色彩**：
  - 收益/增加：`#10b981` (Emerald)
  - 支出/扣減：`#f43f5e` (Rose)
  - 金幣與亮點：`#f59e0b` (Amber)
  - D&D 稀有度色彩：普通 (灰色)、非罕見 (綠色)、罕見 (天藍)、非常罕見 (紫色)、傳奇 (金黃)、神器 (紅色)。
- **卡片化與清晰邊界**：採用 1px 細微邊框 (`rgba(255,255,255,0.08)`) 與適當間距，提升手機與桌機端的瀏覽舒適度與點擊精準度。

### 9.2 行動裝置體驗規格 (Mobile UX Specification)

1. **全螢幕安全區域 (Safe Area Insets)**：
   - 頁面 Meta 包含 `viewport-fit=cover`，支援 iPhone 瀏海/動態島與 Android 虛擬手勢條底欄。
   - 導覽列與固定式動作列（Sticky Action Footer）自動套用 `env(safe-area-inset-top)` 與 `env(safe-area-inset-bottom)`。
2. **表單與觸控人體工學**：
   - 表單輸入框在 `<= 768px` 手機視角下強制維持字體大小 `>= 16px`，防止 iOS Safari 點擊聚焦時畫面強制跳動放大。
   - 關鍵按鈕（如「儲存」、「建立角色」、「消耗品使用」）最小觸控熱區達 42px~46px，支援滿版寬度配置。
3. **資源變動卡片化 (Resource Sub-Cards)**：
   - 冒險表單中的三大資源（金幣、休整期天數、魔法物品）採用獨立卡片化設計。
   - 卡片頂部整合 **即時結算合計徽章 (Real-time Total Badge)**，輸入框自適應單欄/多欄網格，設定 `min-width: 0` 確保任何解析度下絕不破版溢出。
4. **邊框銳利化與抗偽影**：
   - 強化 Outlined 邊框線條色彩對比度，填充純色底層，修復行動端縮放模式下的子像素抗鋸齒模糊。

### 9.3 全域狀態同步架構 (Real-time Reactive State Architecture)

1. **跨組件資料廣播 (`characterChanged$`)**：
   - `CharacterService` 提供 `Subject<string>` 作為全域角色資料異動廣播通道。
   - `AdventureService` 與 `InventoryService` 在執行新增、修改、刪除操作後，透過 RxJS `tap` 自動通知 `CharacterService`。
2. **頂部戰情看板 (Character HUD) 即時更新**：
   - 外層 `CharacterShellComponent` 即時訂閱 `characterChanged$` 與路由 `NavigationEnd` 事件。
   - 子頁面發生冒險紀錄刪除、道具消耗等行為時，外層 HUD 即刻於背景取得最新統計與快照數值，無須使用者手動退回或重新整理頁面。

### 9.4 冒險記錄編輯模式快照與追加規格 (Edit Mode Snapshots & Append Policy)

1. **歷史快照鎖定 (Immutable Historical Snapshots)**：
   - 在冒險記錄編輯模式 (`isEditMode = true`) 下，過去已記錄之戰利品（永久魔法物品、消耗品）與休整期活動均視為歷史快照。
   - 既有卡片標示 `[歷史快照]` 標籤，所有輸入欄位與選單皆設為鎖定（disabled），且不顯示刪除按鈕，保護遊戲中已消耗或流轉的歷史軌跡。
2. **允許追加補登 (Append-Only in Edit Mode)**：
   - 編輯模式開放「新增魔法物品」、「新增消耗品」與「新增休整期活動」按鈕。
   - 本次編輯追加之項目標示 `[新增]` 標籤，各欄位允許正常填寫，並提供刪除按鈕以供儲存前撤銷。
3. **儲存同步行為 (Selective Sync on Save)**：
   - 儲存編輯變更時，僅將新建立之魔法物品與消耗品（`!item.id`）呼叫 Inventory API 寫入倉庫，既有物品不重複建立亦不覆蓋現況。
   - 僅將新建立之休整期活動呼叫 Downtime API 新增至該冒險記錄，既有活動保留原貌。
   - 送出時進行空白卡片防呆校驗，防止送出未填寫名稱或描述之無效項目。
