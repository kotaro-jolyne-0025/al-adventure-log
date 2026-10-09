# Design System: 冒險紀錄表 Web版

> 盤點日期：2026-10-05（Asia/Taipei）。以現有 UI 為基準，供 Google Stitch 生成相容畫面與後續設計討論使用。
> 本文件區分「現況」、「延伸規則」與「改善紀錄」。1.2.1 已完成 P1、操作提示裁切、本輪 P2 與開卡值確認；完成範圍與驗證見第 8、10–16 節，使用者於 2026-10-07 完成整體驗收。
> 使用者於 2026-10-06 確認本批修改驗收 OK；相關 3 個 OpenSpec change 已封存。驗收確認不額外推定裝置或測試範圍。

## 0. 範圍與使用方式

初次盤點依據前端模板、SCSS、元件內嵌樣式、主題服務、SRS 與資料結構，涵蓋首頁、驗證頁、角色列表／表單／角色頁、冒險列表／表單／詳情、倉庫列表／表單與共用彈窗。改善另以 Playwright／Chromium、本機虛構資料與測試 API 驗證，範圍見第 10–15 節。尚未進行 iOS／Android 實機或螢幕閱讀器驗證。

來源優先順序：現有模板與樣式用於描述畫面現況；SRS／OpenSpec 用於判斷業務意圖。兩者有落差時列為待釐清項目，不以本文件自動覆蓋既有需求。

主要來源：

- [全域設計 token 與 Material 主題](frontend/src/styles.scss)
- [全站導覽樣式](frontend/src/app/app.scss)與[模板](frontend/src/app/app.html)
- [字體與 viewport 設定](frontend/src/index.html)、[主題服務](frontend/src/app/core/services/theme.service.ts)
- [角色列表](frontend/src/app/features/characters/character-list/character-list.component.scss)、[角色頁](frontend/src/app/features/characters/character-shell/character-shell.component.scss)
- [冒險列表](frontend/src/app/features/adventures/adventure-list/adventure-list.component.scss)、[冒險表單](frontend/src/app/features/adventures/adventure-form/adventure-form.component.scss)、[冒險詳情](frontend/src/app/features/adventures/adventure-detail/adventure-detail.component.scss)
- [倉庫列表](frontend/src/app/features/inventory/inventory-list/inventory-list.component.scss)、[倉庫表單](frontend/src/app/features/inventory/inventory-form/inventory-form.component.scss)
- [系統需求規格](system-requirements-spec.md)、[資料庫綱要](database-schema.md)

### 給 Stitch 的工作指示

> 為「冒險紀錄表 Web版」延伸既有介面。沿用本文件的 Clean Light／Soft Charcoal 雙主題、Inter＋Noto Sans TC、6／10／14px 圓角、細邊框、低陰影與 Lucide 線條圖示。呈現繁體中文的實用紀錄工具，資訊優先於裝飾。沿用角色、冒險、倉庫的既有資訊架構與表單分區。一次生成指定頁面的桌機與手機版本，保留語意色、稀有度文字、數值單位及錯誤／空資料／載入狀態。第 8 節的改善項目只有在任務明確指定時才納入變體。

StitchDesign 預設的禁用 Inter、禁用紫色、單一色彩、強制非對稱 Hero、所有多欄在 768px 以下收合、持續動畫與禁止三欄卡片等規則，不直接套用本專案。使用者要求以現有 UI 為準，故保留 Inter、深色紫色主色、D&D 稀有度多色、首頁置中 Hero、既有響應式斷點及資源摘要網格。無須新增動效函式庫。

## 1. Visual Theme & Atmosphere — 視覺氛圍

### 現況

這是用於跑團時查閱與補登的紀錄工具。視覺為現代無襯線、規律排列、卡片化與明確分區；D&D 氛圍主要由角色肖像、Logo、物品稀有度與資源圖示傳達，沒有羊皮紙背景、裝飾性襯線或大面積奇幻插畫。

- **Clean Light**：冷調 Slate 背景、白色卡片、Material 藍色主色，乾淨明亮。
- **Soft Charcoal**：Zinc 炭灰背景與卡片、紫色主色，以金色及語意色區分資源。
- **密度**：首頁較寬鬆；角色與冒險列表均衡；倉庫與冒險表單較密集。
- **排列**：內容頁左對齊、規律網格；首頁與驗證頁以置中構圖為主。
- **動態**：短暫 hover／active 回饋、主題切換、Tab 轉場與載入提示。

主題會保存使用者選擇；沒有儲存值時依系統深淺色偏好決定，不應假設所有首次訪客都看到淺色。

### 延伸規則

維持「易讀、可掃描、能快速輸入」的優先順序。頁面標題、角色資訊、資源數值與主要操作先於裝飾。新增畫面需提供兩種主題；沿用頁面分區與導覽，不為了視覺變化重排核心操作。

## 2. Color Palette & Roles — 色彩與用途

以下為 `styles.scss` 現有值；淺色與深色各自使用一致的中性色系。

### 基底與主色

| 語意名稱／Token | Clean Light | Soft Charcoal | 用途 |
| --- | --- | --- | --- |
| 冷白／炭灰畫布 `--bg-canvas` | `#f8fafc` | `#18181b` | 整頁背景 |
| 純白／炭灰表面 `--bg-surface` | `#ffffff` | `#27272a` | 卡片、輸入區底色 |
| 層次表面 `--bg-surface-elevated` | `#f1f5f9` | `#3f3f46` | 子卡、HUD、標籤底色 |
| Hover 表面 `--bg-surface-hover` | `#f1f5f9` | `#3f3f46` | 可操作區的指向回饋 |
| 細邊框 `--border-subtle` | `#e2e8f0` | `#3f3f46` | 卡片與分隔線 |
| 強邊框 `--border-medium` | `#cbd5e1` | `#52525b` | 輸入框、工具列 |
| 主要文字 `--text-primary` | `#0f172a` | `#f4f4f5` | 標題、重要內容 |
| 次要文字 `--text-secondary` | `#475569` | `#d4d4d8` | 說明、欄位資訊 |
| 弱化文字 `--text-muted` | `#526176` | `#b4b4be` | metadata、備註、placeholder，保留可讀性 |
| 藍色／紫色主色 `--color-primary` | Material `--mat-sys-primary`（azure） | Material `--mat-sys-primary`（violet） | 自訂及 Material 主操作、選取、焦點共用來源 |
| 主色 Hover `--color-primary-hover` | 主色 88% 與主要文字色混合 | 主色 88% 與主要文字色混合 | 主操作指向回饋 |
| 半透明導覽底 `--header-bg` | `rgba(255,255,255,0.88)` | `rgba(39,39,42,0.88)` | 黏附頂部導覽列，模糊 12px |

### 功能色

| 語意 | 淺色文字／底色 | 深色文字／底色 | 用途 |
| --- | --- | --- | --- |
| 金幣 `--color-gold` | `#92400e`／`#fef3c7` | `#fbbf24`／`rgba(251,191,36,0.15)` | 金幣、故事獎勵 |
| 同調 `--color-attunement` | `#92400e`／`#fef3c7` | `#fbbf24`／`rgba(251,191,36,0.15)` | 同調需求 |
| 正向 `--color-positive` | `#047857`／`#d1fae5` | `#34d399`／`rgba(52,211,153,0.15)` | 增加、成功、休整期識別 |
| 負向 `--color-negative` | `#be123c`／`#ffe4e6` | `#fecdd3`／`rgba(251,113,133,0.15)` | 扣減、錯誤、刪除 |
| 資訊 `--color-info` | `#0369a1`／`#e0f2fe` | `#38bdf8`／`rgba(56,189,248,0.15)` | 等級、說明、結算分區 |

多個語意色代表不同資料類型，不是任意裝飾色。增減必須同時保留正負號或文字，不能只用紅綠區別。HUD 的資源識別色與資源「本次增減」色是兩種用途。

### D&D 稀有度

| 稀有度 | 淺色 Token | 深色 Token |
| --- | --- | --- |
| 普通 | `#526176` | `#b4b4be` |
| 非罕見 | `#166534` | `#4ade80` |
| 罕見 | `#1d4ed8` | `#60a5fa` |
| 非常罕見 | `#9333ea` | `#c084fc` |
| 傳奇 | `#92400e` | `#fde047` |
| 神器 | `#b91c1c` | `#fca5a5` |

[inventory.model.ts](frontend/src/app/core/models/inventory.model.ts) 的 `RARITY_COLORS` 現在對應 `var(--rarity-...)`，不再維護固定 hex；倉庫篩選 chip 與全域 pill 共用上述雙主題 token。明度調整用於閱讀對比，保留原有稀有度色相及文字。

### Material 主題對應

Material 淺色 primary 沿用 `azure-palette`，深色沿用 `violet-palette`；自訂 `--color-primary` 指向 `--mat-sys-primary`，與既有 Material 主操作及焦點一致。供應商登入品牌色獨立保留。

## 3. Typography Rules — 字體與層級

### 現況

- 英文與數字：`Inter`；繁體中文：`Noto Sans TC`；其後為系統無襯線 fallback。
- 全域內文字級 `15px`，行高 `1.5`。以下 rem 約值以瀏覽器根字級 16px 為前提，使用者設定可改變換算。
- 頁面標題常見 `1.45–1.6rem`（約 23–26px）、字重 600–700；v1.3.0 第一批的冒險／倉庫列表與主要表單在 <=600px 採 `1–1.0625rem`（16–17px），其他頁面沿用既有手機字級。
- 首頁 Hero 標題桌機 `2.25rem`（36px），手機 `1.75rem`（28px）、字重 800。
- 物品／冒險標題常見 `1–1.15rem`（16–18.4px）、字重 700。
- 說明與 metadata 常見 `0.75–0.9rem`（12–14.4px）；角色卡種族／職業／子職／派系及等級現為 `0.875rem`（預設 14px），手機不再縮小。
- HUD／結算數值採較粗字重及 `font-variant-numeric: tabular-nums`；沒有專用等寬字體系統。
- Material 手機輸入框／textarea／select 與自訂 `.search-input` 在 `<=768px` 強制 16px。

### 延伸規則

保留 Inter＋Noto Sans TC，以字重、間距及文字色建立層級。資源數值使用等寬數字並保留金／天／件／枚等單位。重要名稱、表單說明與錯誤文字需可讀；新手機畫面以 16px 輸入文字、至少 14px 重要輔助文字作為改善目標，不能把現有小字直接複製為標準。

名稱可以在列表摘要省略，但必須有可取得全文的路徑。敘述與備註可換行並保留原始換行。長段說明可限制約 65ch；中文段落需另檢查行寬，數值欄位不適用此上限。

## 4. Component Stylings — 元件樣式

| 元件 | 現況／延伸基準 |
| --- | --- |
| 卡片 | `.clean-card` 使用表面底、1px 細邊框、10px 圓角與低陰影；只讀資訊、表單分區與可點擊卡片各有用途，保留現有結構 |
| 圓角 | `--radius-xs: 4px`、`--radius-sm: 6px`、`--radius-md: 10px`、`--radius-lg: 14px`、`--radius-full: 9999px`；驗證頁卡片另用 16px |
| 陰影 | 淺色 small 為 `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`；深色 small 為 `0 1px 3px rgba(0,0,0,.4)`。中／大陰影用於更高層次，不新增外發光 |
| 主要操作 | Material flat button；手機冒險／倉庫列表採與標題同行的短文字新增按鈕，至少 44px 高、內容可換行；新增角色沿用既有排列。提交按鈕常見 44–46px |
| 次要操作 | stroked／text button；取消與儲存於表單底部並排；手機冒險表單操作列 sticky，大字可換行，短視窗回到文件流 |
| 刪除 | 文字或圖示按鈕配確認彈窗；語意、位置及確認內容必須清楚，與編輯分開 |
| 輸入框 | Material outlined，使用 `mat-label` 浮動標籤，錯誤在欄位下方；保留既有 Material 行為，不強制改成另一套標籤系統 |
| 資源卡 | 金幣、休整期、永久物品分區，表單區分冒險／故事獎勵／休整期／結算；合計是計算結果，不改為任意可編輯欄位 |
| 標籤 | 稀有度與同調使用 pill；增減使用 delta badge；類別／來源／待補明細必須有文字語意 |
| 搜尋與排序 | 膠囊搜尋框、排序欄位＋方向工具列；排序保留原生 select。手機搜尋列至少 48px 高，清除按鈕至少 44×44px；倉庫額外使用可換行篩選 chips |
| 導覽 | sticky 頂部列含返回、Logo、主題切換、帳號選單；小螢幕收合帳號名稱；角色頁透過 Tabs 進入冒險與倉庫 |
| 圖示與肖像 | Lucide 線條 SVG；圖示常見 16／20／24px。角色肖像為圓角正方形；無頭像時以首字搭配紫靛漸層 |
| 空資料 | 圖示、標題、說明與新增操作；「沒有資料」和「搜尋／篩選無結果」使用不同文案 |
| 載入 | 列表使用骨架；角色頁／詳情與提交操作仍使用 spinner。延伸時列表用骨架，提交用緊湊進度提示並保留文字 |
| 錯誤 | 欄位 `mat-error`、頁面提示或 snackbar；冒險表單已有載入失敗提示與重試入口，其他頁面應依操作性質一致處理 |

歷史快照與新增項目的標示／可編輯狀態涉及業務規則，生成畫面時需依對應任務與規格保留，不以樣式重設資料行為。Google 登入按鈕由供應商元件產生，其品牌外觀需獨立於一般自訂按鈕處理。

## 5. Layout Principles — 版面與響應式

### 現有版面尺度

| 範圍 | 最大寬度／主要安排 | 手機安排 |
| --- | --- | --- |
| 全站頂部列 | 1200px，60px 高 | <=600px 高 56px，左右安全區 |
| 首頁 | 760px，置中 Hero，特色 2×2 | <=640px 特色單欄；<=480px 登入／註冊直排滿寬 |
| 驗證頁 | 卡片 440px，置中 | <=480px 縮減外距 |
| 角色列表／角色頁 | 1080px；角色卡 auto-fill，最小欄寬 360px | <=600px 單欄角色卡 |
| 角色表單／倉庫表單 | 680px | <=600px 欄位多改為單欄 |
| 冒險表單 | 860px，垂直分區 | <=600px 欄位單欄；<=680px 等級控制直排；<=768px 結算摘要單欄 |
| 冒險詳情 | 置於角色頁內，auto-fit 資訊／資源網格 | <=600px 主要資訊與資源單欄 |
| 倉庫列表 | 永久物品 3 欄；消耗品 4 欄，含數量欄 | <=640px 卡片直排；消耗品數量定位於右上角並預留品名空間 |
| 法律頁 | 900px | 隨可用寬度縮減，長文可捲動 |

主要外距為桌機 16–24px、手機 12–16px；常用間距尺度為 4／8／12／16／20／24px。清單 gap 10–20px、表單 gap 8–14px 等既有例外依內容保留；目前無須新增整套 spacing token 或為純粹統一數字重構所有頁面。

### 延伸規則

- 大區塊優先使用 Grid；文字／圖示與小型工具列可使用 Flex。沿用各頁現有容器寬度。
- 保持 `min-width: 0`、可換行與安全區 padding；長名稱、大數值、多標籤需有清楚空間。
- 響應式以內容可用空間決定，不強制把所有現有斷點改成 768px。
- 全站禁止內容水平溢出；現有 `overflow-x: clip` 是防護，不是內容完整可見的證明。
- `viewport-fit=cover` 與安全區變數已存在；新增貼邊操作應沿用。
- 角色 HUD 在 <=600px 讓等級獨立一列，金幣、休整期、永久物品、靈魂幣排列成 2×2，保留五項資料；長數字與單位可分開換行。
- v1.3.0 第一批在上述寬度精簡角色摘要間距，名稱 17px、HUD 數字 16px；冒險／物品新增與編輯、角色編輯子頁的資源預設收合，可由「角色資源」展開，不影響表單輸入。601px 以上保留既有呈現。
- 首頁置中 Hero 與現有登入／註冊入口保留；內容頁不需要新增宣傳 Hero 或標題插圖。

## 6. Motion & Interaction — 動效與互動

### 現況

一般偏好下卡片 hover 微抬升 1–2px，`.clickable:active` 縮至 `0.985`。常見 transition 為 150–250ms；主題底色／文字轉換約 200ms，角色 Tabs 150ms，骨架 1.6 秒 pulse。`prefers-reduced-motion: reduce` 時停用 animation、transition、smooth scroll 及 hover／active 位移，保留靜態進度、文字與焦點。

### 延伸規則

以短暫操作回饋為主，保留現有節奏。新增位移動畫使用 transform／opacity；顏色與邊框可短暫轉換。不對常駐 HUD、數值或按鈕新增無限浮動、打字或呼吸效果。骨架只在載入時出現，並提供減少動態版本。鍵盤焦點與觸控 active 回饋需同樣明確，不依賴 hover 才顯示關鍵操作。

## 7. Anti-Patterns — 延伸時避免的做法

- 不改換既有字體、整套主題或資訊架構來滿足插件的通用審美。
- 不加入霓虹外發光、巨型漸層標題、持續裝飾動畫或自訂滑鼠游標。
- 不把所有狀態與 D&D 稀有度壓成同一強調色，也不只依靠顏色辨識資料。
- 不使用 Emoji 代替現有 Lucide 圖示，不新增無用途的奇幻裝飾。
- 不因避免三欄而拆掉資源摘要；資訊分組與閱讀順序優先。
- 不以更小字體、截斷或隱藏溢出來掩蓋空間不足；完整資訊需有可到達入口。
- 不把 Tooltip 當成唯一名稱或完整資訊入口，手機和鍵盤需可操作。
- 不為視覺提案虛構玩家資料、收益數字或正式帳號資訊。
- 不重新定義不可編輯合計、歷史快照、物品來源或刪除同步規則。

## 8. 值得改善的一致性與手機操作問題

優先級：**P1** 優先處理操作／閱讀障礙；**P2** 統一設計與完善體驗。下列「確認」指原始碼設定可確認，不代表已量測瀏覽器最終畫面。

### P1：手機操作與閱讀

| 項目 | 證據與影響 | 建議／後續驗證 |
| --- | --- | --- |
| 自訂搜尋框字級：已修正 | 原為 `0.92rem`，現由全域手機規則覆寫為 16px；冒險與倉庫搜尋／清除已驗證 | iOS 聚焦、鍵盤收合與畫面尺度仍需實機驗證 |
| 指定操作尺寸：已修正 | Material icon button、搜尋清除、角色卡 footer、頂部帳號選單在 <=768px 至少 44×44px；手機返回按鈕為 44×44px。已量測相鄰矩形與畫面邊界 | 本批涵蓋角色編輯／刪除、倉庫編輯／刪除、清除及頂部操作；篩選 chip 與其他文字連結另行評估 |
| 頭像裁切彈窗：已修正 | [裁切元件](frontend/src/app/features/characters/avatar-cropper-dialog/avatar-cropper-dialog.component.ts) 預覽使用 100% 寬度、最大 320px、正方形比例；滑鼠／單指座標換算為 canvas 空間。320／360／390px 布局及 300×300 匯出已驗證 | 保留內部 320×320 畫布；實機觸控與螢幕旋轉仍需驗證 |
| 深色驗證頁文字：已修正 | [登入](frontend/src/app/features/auth/login/login.component.scss)、[註冊](frontend/src/app/features/auth/register/register.component.scss)、[忘記密碼](frontend/src/app/features/auth/forgot-password/forgot-password.component.scss)、[重設密碼](frontend/src/app/features/auth/reset-password/reset-password.component.scss) 自訂文字改用語意 token，卡片底色用 `--bg-surface`；錯誤用 Material 配對色；文字連結使用可讀的 Material primary | 已檢查雙主題主要說明／失效／成功／登入與註冊錯誤。供應商登入流程未列入本批驗證 |
| 角色卡手機小字與截斷：已修正 | [角色列表樣式](frontend/src/app/features/characters/character-list/character-list.component.scss) 的資訊與等級統一為 0.875rem；名稱及資訊換行、資訊區自然增高；大字時可換到肖像下方 | 長名稱／複合職業／子職／派系在 320／360／390／768／1280px、100%／200% 基準字級已檢查；實機字級設定仍待驗證 |
| 可點擊 div 鍵盤入口：已修正 | [角色卡](frontend/src/app/features/characters/character-list/character-list.component.html) 與[倉庫卡](frontend/src/app/features/inventory/inventory-list/inventory-list.component.html) 採伸展標題連結及獨立操作區；[冒險卡](frontend/src/app/features/adventures/adventure-list/adventure-list.component.html) 與品牌採原生連結；雙主題顯示焦點 | 已驗證 Tab／Enter、新分頁、卡片空白處及獨立編輯／刪除；尚未進行螢幕閱讀器或實機驗證 |

### P2：一致性、主題與資訊取得

| 項目 | 證據與影響 | 建議／後續驗證 |
| --- | --- | --- |
| Token 引用缺漏：已處理 | 補齊 `--text-disabled`／`--radius-xs`；首頁邊框及篩選錯誤色改用既有語意 token | 自訂設計 token 未定義引用檢查通過；詳情未使用的 source／pending pill 樣式已移除 |
| 主色與稀有度兩套來源：已統一 | 自訂 primary 指向現有 Material primary；`RARITY_COLORS` 對應 CSS token | 同頁 chip／pill computed color 相同；沿用 azure／violet，保留稀有度文字與色相 |
| 休整期識別色：已統一 | HUD／表單／詳情採 `--color-positive` | 資源識別維持綠色，金幣、等級與物品仍使用各自語意色 |
| 淺色常數：已處理 | 數量、刪除 hover、avatar placeholder、升級狀態採雙主題語意值 | 檢查一般與 hover 的文字／底色；原 source／pending 樣式沒有模板引用，移除而不新增標籤 UI |
| 暗色故事獎勵：已處理 | 移除依賴 `body.theme-dark &` 的覆寫，直接使用 gold token 及配對底色 | 已量測雙主題實際 computed style，圖示繼承文字色 |
| 手機全文：已改善 | 倉庫品名／來源及角色頁名稱／資訊自然換行、長字可斷行 | 雙主題、五種寬度及 100%／200% 基準字級驗證；保留原生入口與獨立操作 |
| 次要文字與焦點：已改善 | 提高 muted／secondary 及語意文字對比；列表搜尋、排序及自訂按鈕有 3px 焦點框 | 一般、選取與 hover 狀態量測至少 4.5:1；焦點檢查見第 13 節 |
| 長表單操作列：已改善 | 冒險表單在 <=768px 採底部 sticky；<=600px 高度回到文件流；提供安全區與欄位捲動外距 | 雙主題、三種寬度及 100%／200% 字級，最後欄位與操作可達；含 34px 安全區模擬。實機鍵盤仍待驗收 |
| HUD 規格落差：已同步 | 等級一列，四項資源 2×2，長數值及單位可換行 | 保留五項資料與原有順序，SRS 與 OpenSpec 一致 |
| 載入骨架：已對齊 | 與成品共用 card／hero／portrait／footer；資訊列使用相同行高 | 肖像尺寸一致，載入及提交提供文字；實際長內容仍可使卡片增高 |
| 高度與減少動態：已改善 | 首頁／驗證頁改用 dvh；法律彈窗樣式 85dvh；全域 reduced-motion 停用持續動畫與位移 | 短視窗、骨架、spinner 與卡片 hover 檢查通過；未代替實機地址列及鍵盤測試 |
| 字級／間距與 SRS：已同步 | SRS 採現有 Clean Light／Soft Charcoal；整理常用字級、4／8／12／16／20／24px 間距與 4／6／10／14px 圓角 | 保留合理頁面例外，沒有新增僅為抽象的 spacing 系統；新的畫面／配色需求歸下一版 |

## 9. 後續驗收清單

後續改善依專案 Feature SOP 建立或更新 OpenSpec change；本批已執行部分驗收，完成範圍見第 10 節。

- 檢查 320、360、390、600、640、768、900、1080px 寬度及重要斷點前後，涵蓋桌機、手機直向與橫向。
- 兩種主題都驗證空資料、搜尋無結果、載入、錯誤、提交中、長名稱、多標籤、大數值與待補明細。
- iOS Safari 聚焦 Material 與自訂搜尋 input、鍵盤開合、表單最後欄位、彈窗與 safe area。
- 量測實際觸控熱區，確認編輯／刪除／消耗品操作不重疊，確認 icon-only 按鈕具可辨識名稱。
- 以鍵盤及較大文字設定驗證卡片導覽、透明原生排序選單、焦點可見性與 Tooltip 以外的全文入口。
- 檢查 Angular 編譯後深色選擇器與 Material computed style，再判定視覺缺陷是否確實發生。
- 尊重 reduced-motion；只有實作修改後才執行必要 build 與功能驗證。

## 10. 第一批實作與驗證紀錄

- Change：[improve-mobile-ui-ergonomics](openspec/changes/archive/2026-10-06-improve-mobile-ui-ergonomics/proposal.md)；[完整驗證紀錄](openspec/changes/archive/2026-10-06-improve-mobile-ui-ergonomics/verification.md)。
- 手機布局：320／360／390／768px 的角色列表、角色冒險頁、倉庫永久物品與消耗品，共 16 組量測；指定熱區至少 44×44px，無矩形重疊或水平溢出，搜尋文字至少 16px。
- 裁切：320／360／390／1280px，預覽寬約 232／258.39／286.59／320px；滑鼠與合成單指事件按比例換算，確認匯出 300×300，並檢查 320px 彈窗截圖。
- 雙主題驗證頁：16 組表單／失效／登入錯誤／註冊錯誤／忘記密碼成功／重設成功檢查；受測重要文字最低對比約 4.76:1（淺色）及 5.81:1（深色）。
- 第一批未包含的角色卡小字及卡片鍵盤導覽，已於第二批處理，見第 11 節。第 8 節 P2 已於第 13、15 節完成實作；iOS 鍵盤／安全區、實機手指操作與供應商 OAuth 未由本次桌機 Chromium 驗證取代。

## 11. 第二批實作與驗證紀錄

- Change：[improve-card-readability-and-keyboard-navigation](openspec/changes/archive/2026-10-06-improve-card-readability-and-keyboard-navigation/proposal.md)；[完整驗證紀錄](openspec/changes/archive/2026-10-06-improve-card-readability-and-keyboard-navigation/verification.md)。
- 角色卡次要資訊及等級為 0.875rem；資訊自然換行，大字時資訊欄可排到肖像下方。五種寬度與兩種基準字級，共 10 組檢查無裁切、重疊或水平溢出。
- 明暗主題各驗證角色、冒險、永久物品及消耗品卡，合計 8 組；主連結可用 Tab／Enter，焦點可見，支援 Ctrl＋點擊新分頁與卡片空白處點擊。
- 角色與兩類倉庫編輯／刪除分別驗證鍵盤及滑鼠；取消刪除留在原頁，不送出資料異動。品牌連結亦驗證鍵盤導覽。
- 本批驗證使用 Chromium 及虛構 API；200% 檢查透過根字級 16px→32px 模擬，未代替實機系統字級、瀏覽器縮放或螢幕閱讀器驗證。

## 12. 操作提示裁切修正

- 使用者回報刪除角色後提示在部分手機樣式被切掉；檢查發現 Snackbar 文字的 flex 最小寬度與共用 overlay 寬度限制使訊息及關閉操作超出可見範圍。
- 共用提示容器依 viewport 保留外距與安全區，label 可收縮及斷長字，保留 Material 的文字區垂直捲動；94vw 寬度規則限於 Dialog panel。
- 六種寬度（320／360／390／600／768／1280px）、明暗主題及 100%／200% 根字級，共 24 組刪除虛構角色流程已驗證，提示和關閉操作留在視窗內；實機安全區仍待驗證。
- Change：[fix-mobile-snackbar-containment](openspec/changes/archive/2026-10-06-fix-mobile-snackbar-containment/proposal.md)；[驗證紀錄](openspec/changes/archive/2026-10-06-fix-mobile-snackbar-containment/verification.md)。

## 13. P2 第一批：列表控制項焦點

- Change：[improve-search-and-sort-keyboard-focus](openspec/changes/improve-search-and-sort-keyboard-focus/proposal.md)；[驗證紀錄](openspec/changes/improve-search-and-sort-keyboard-focus/verification.md)。
- 冒險與倉庫共用焦點樣式，以可見容器框選搜尋輸入和透明排序 select；排序方向、搜尋清除、稀有度／同調篩選、清除篩選及無結果清除按鈕也顯示焦點。使用既有 Material primary，不改原生鍵盤處理。
- 明暗主題、320／390／1280px 及兩種列表，12 組 Chromium 檢查通過：Tab 可到達、方向鍵更改排序、Enter／Space 操作按鈕，焦點框不受祖先 overflow 裁切，也不超出視窗左右。
- 既有搜尋 focus-within、搜尋中樣式與篩選選取狀態保留；前端 production build 和 OpenSpec 驗證通過。此批未涵蓋 200% 字級、實機手機或螢幕閱讀器。

## 14. 本輪 UI 改善與交付範圍

使用者已確認：完成本文件的 P2 即結束 **1.2.1** 的改善範圍；往後新增的版面或配色需求列入下一個版本。開發持續在 `v1.2.1` 分支累積，沿用現有風格。完成實作與自動檢查後先交付整體驗收，再依明確指示回 main。

| 階段 | 工作範圍 | 完成依據 |
| --- | --- | --- |
| 1. 色彩與基礎樣式 | 補齊／替換缺漏 token、統一主色與稀有度來源、休整期識別色、深色常數與故事獎勵作用域，量測次要文字對比 | 雙主題實際 computed style、文字／背景對比及典型狀態檢查；避免僅改 token 名稱 |
| 2. 手機閱讀與操作 | 完整品名／來源入口、長表單動作列、角色 HUD 資訊密度；涉及版面選擇時先提出具體方案 | 小視窗、長內容與大字完整閱讀；儲存／取消可達且不遮住欄位；HUD 與 SRS 行為一致 |
| 3. 載入與動態 | 骨架對齊真實卡片，整理動態 viewport 與 reduced-motion | 載入前後尺寸對照、短視窗及捲動檢查、減少動態偏好生效 |
| 4. 整體驗收與交付 | 更新 SRS／DESIGN.md／OpenSpec，跨頁檢查明暗主題、空資料、長內容、鍵盤及手機操作 | 建置與必要功能驗證通過、使用者整體驗收後再安排回 main |

各階段用 OpenSpec 追蹤規格與任務，保留驗證證據。提交、push 與回 main 依使用者當次明確指示執行；回 main 會觸發既有前端 CI/CD，因此列為整體驗收後的交付步驟。

## 15. P2 完整改善與 1.2.1 驗證

- Change：[complete-v1-2-1-ui-consistency](openspec/changes/complete-v1-2-1-ui-consistency/proposal.md)；[完整驗證紀錄](openspec/changes/complete-v1-2-1-ui-consistency/verification.md)。
- 第 8 節 P2 均已有改善或確認處理：色彩／token 共用、文字對比、全文換行、手機 HUD、冒險操作列、骨架、dvh、reduced-motion 及規格同步。
- P2 檢查使用虛構 API 的 Chrome，涵蓋明暗主題、320／360／390／768／1280px、100%／200% 根字級，以及短視窗、34px 安全區模擬、一般／選取／hover 狀態。
- 68 組 P2 結果、32 個既有單元測試、production build 及 OpenSpec strict 檢查通過；受測文字最低對比為淺色 4.81:1／深色 4.64:1。另完成卡片、焦點及 24 組 Snackbar 回歸。
- 前端 package／lockfile 與首頁標示為 1.2.1。使用者於 2026-10-07 完成整體驗收並授權提交、push 至 `v1.2.1`；PR 合併 main 為後續交付步驟。新的視覺提案及配色重選留到下一版。
- 實機鍵盤／地址列／安全區與螢幕閱讀器仍需使用者驗收；未使用的法律彈窗元件只有樣式檢查，不宣稱已有可操作入口。

## 16. 1.2.1 驗收補充：修改開卡值確認

- 編輯角色的開卡職業／等級、金幣或休整期有實際變更時，儲存前使用既有 Material 確認視窗；已有冒險時保留重算預覽。
- 「繼續編輯」為初始鍵盤焦點；取消或關閉保留輸入，確認後才更新。未變更開卡值與新建角色直接儲存。
- Change：[confirm-opening-baseline-save](openspec/changes/confirm-opening-baseline-save/proposal.md)；[驗證紀錄](openspec/changes/confirm-opening-baseline-save/verification.md)。44 個單元測試、production build、24 組雙主題／手機／大字／鍵盤流程與 OpenSpec strict 驗證通過。

## 17. v1.3.0 第一批：手機字級與密度

- 使用者將 v1.3.0 目標改為手機排版，桌機維持現況，並回報字體偏大。此次限定 <=600px 的主要標題、角色摘要、冒險／倉庫工具列與冒險長文字；篩選區、完整表單重排及其他頁面另行安排。
- 390×844px 的同一份虛構資料，第一筆冒險由 685px 提前至 609px，第一件永久物品由 818px 提前至 746px；表單摘要由 309px 降至 163px，資源仍可展開。
- 601／768／1280px 共 18 張修改前後截圖 SHA-256 一致；88 組雙主題／小視窗／長文字檢查及原生資源展開、保留輸入、搜尋、排序、新增導覽通過。
- 手機操作／200% 根字級檢查採系統後備字體與元素邊界量測；原有字體的畫面對照另外保存。使用者於 2026-10-09 確認手機排版驗收 OK，詳見[完整驗證紀錄](openspec/changes/archive/2026-10-09-improve-mobile-layout-density/verification.md)。production build、主規格及 change strict 驗證通過。
- 第一批完成時未更新產品版號；後續驗收與版本同步見第 18 節。

## 18. v1.3.0 第二批：手機篩選與空白區塊

- `<=600px` 倉庫篩選預設收合，入口與搜尋框並列，顯示稀有度／同調已選數；保留搜尋與篩選條件，操作至少 44px。390px 第一件物品由 746px 提前至 676px。
- 冒險表單的永久物品、消耗品、故事獎勵與休整活動，空白時沒有展開／收合入口，有明細後才提供切換。基本資料、資源變化、結算與新增入口持續可用；新增卡片或提交驗證失敗時展開相關內容，欄位與快照保留。此規則依 2026-10-09 使用者驗收意見修正。
- 手機切換入口再依使用者確認簡化為「小箭頭＋中文標題＋明細筆數」，直接點標題切換，移除獨立外框切換按鈕。新增仍獨立，空白不顯示箭頭；標題區至少 44px 高並有鍵盤焦點。重新驗證 48 組手機條件、64 項測試與 6 組桌機完整表單尺寸均通過。
- 48 組手機尺寸／雙主題／放大字級檢查、鍵盤／指標操作與切換寬度保留輸入通過。601／768／1280px 的 9 張首屏截圖一致，6 組完整表單元素位置與尺寸一致；完整頁面擷取仍有既有備註自動增高的時機差異。
- production build 無警告、驗收修正後 64 項測試與 OpenSpec 驗證通過，mobile-pwa 與 SRS 已同步。使用者於 2026-10-09 確認手機排版驗收 OK，兩批 change 已封存，詳見[驗證紀錄](openspec/changes/archive/2026-10-09-compact-mobile-filters-and-form-sections/verification.md)。驗收確認不額外推定裝置或測試範圍；發布準備已同步前後端產品版號為 1.3.0，完整發布依 VERSIONING.md 執行。

## 19. v1.4.0 改善目標：Material Design 3 盤點

- 2026-10-09 使用專案 `material-design-3-ui` 技能完成原始碼與規格盤點；已有 M3 雙主題、業務語意色、鍵盤焦點及手機密度基礎，仍有狀態復原與自訂互動語意缺口。本輪未重新量測 UI，不宣稱已全面符合 M3／WCAG。
- [完整盤點與評分](openspec/changes/align-v1-4-0-material-design-3/audit.md)、[改善提案](openspec/changes/align-v1-4-0-material-design-3/proposal.md)、[待實作任務](openspec/changes/align-v1-4-0-material-design-3/tasks.md)。
- P1：讀取錯誤與重試、物品編輯載入門檻、分頁內容關聯、裁切鍵盤操作、表單錯誤定位／狀態播報、M3 破壞性確認。
- P2：補表面／字體／容器語意角色，保留既有品牌及業務色；補頁面標題／跳到內容、斷點／大字／雙主題／實機與輔助技術驗收。
- P3：寬視窗與倉庫容器先提供具體方案比較，確認後才調整桌機；不以套用 skill 為由強加 rail、FAB、Expressive 或全面換配色。
- 本節為 1.4.0 實作追蹤，核心改善與本次約定驗收已結案，前後端產品版號同步為 1.4.0；已驗收的 1.3.0 字級、操作範圍與收合行為持續為回歸基準。螢幕閱讀器實測依使用者決定略過，完整發布另依 VERSIONING.md 執行。

### 19.1 已實作的角色映射

| 產品角色 | 既有／新增 token | Material 對應與使用範圍 |
|---|---|---|
| 畫布 | `--surface-canvas` → `--bg-canvas` | surface；保留 slate／zinc 品牌底色 |
| 一般資料／表單容器 | `--surface-container-low` → `--bg-surface` | surfaceContainerLow；角色身份、冒險摘要及表單區域 |
| 高一層表面 | `--surface-container-high` → `--bg-surface-elevated` | surfaceContainerHigh；摘要資源／浮層的既有層次 |
| 文字 | `--on-surface`／`--on-surface-variant` | onSurface／onSurfaceVariant，對應既有主要／次要文字 |
| 邊界 | `--outline-variant` → `--border-subtle` | outlineVariant；一般容器細邊框 |
| 主操作／焦點 | `--color-primary` | Material primary；淺藍／深紫主題保持 |
| 刪除確認 | `--mat-sys-error`／`--mat-sys-on-error` | public button overrides；取消為初始焦點 |
| 頁面錯誤 | `--color-negative`／`--color-negative-bg` | 品牌錯誤提示；保留文字、定位或重試，與業務支出共用色系但以文案區分 |
| 字體角色 | `--type-page-title`／`--type-section-title`／`--type-body`／`--type-label` | 1.35／1.1／1／.875rem 的產品角色；手機既有字級覆寫優先 |

品牌表面與 Material 元件表面保留各自 token，角色對應不代表所有實際色碼完全相同。D&D 金幣、休整期、稀有度、同調與故事獎勵是業務識別色；OAuth 官方品牌及裁切深色畫布為用途明確的例外。連續清單與寬視窗參考區仍是選配，不因角色映射改動已驗收版面。

- Outlined 表單框線使用 Angular Material 公開 `form-field-overrides` 設定 normal／hover／focus／error；底層由表單容器提供，不覆寫內部 notch 邊框。
- 新增 `ReadError` 與 `FormFeedback` 提示：持續顯示可復原錯誤，區分 HTTP 錯誤、初次空資料與背景未更新。物品編輯未成功讀取時不可儲存；刪除失敗恢復本地物品，背景刷新強制重新讀取。
- 路由分頁／分類內容建立真實 panel 關聯；裁切提供具名稱的位移與縮放、重設、取消及確認。頁面 title、跳到內容與進入焦點只處理新路由，保留同頁篩選焦點。
- [實作與驗證紀錄](openspec/changes/align-v1-4-0-material-design-3/verification.md)、[寬視窗選配比較](openspec/changes/align-v1-4-0-material-design-3/layout-options.md)。實機、螢幕閱讀器與真正瀏覽器 zoom 驗收尚未完成，不能宣稱全面符合 M3／WCAG。
- 手機驗收補充：倉庫分類分頁與搜尋列間距為16px（`<=600px`），避免內容panel連接後搜尋框緊貼分頁底線；搜尋、篩選及操作尺寸保持。
- 倉庫列表上方及空資料的新增入口，桌機／手機均顯示「新增物品」；目前分類仍決定新增表單的預選物品類型。
- 2026-10-09使用者確認手機驗收通過；不額外推定裝置或逐項測試配置。螢幕閱讀器、真正瀏覽器200% zoom與寬版選配決策仍待完成，詳見驗證紀錄最新補充。
- 2026-10-09後續確認真正瀏覽器200%縮放驗收通過，完成相關文案修正。縮放驗收以此更新為準；目前剩輔助技術驗收與寬版选配決策。
- 後續使用者明確要求略過本版螢幕閱讀器人工驗收；保留功能與語意，不宣稱朗讀實測通過。目前只剩寬版選配決策，驗收範圍以verification.md最新決策為準。
- 使用者後續明確「先保留」，1.4.0維持既有寬版與倉庫布局，候選方案不採用；目前change任務已結案，螢幕閱讀器略過限制保留。摺疊手機驗證另行討論。
