# Design System: 冒險紀錄表 Web版

> 盤點日期：2026-10-05（Asia/Taipei）。以現有 UI 為基準，供 Google Stitch 生成相容畫面與後續設計討論使用。
> 本文件區分「現況」、「延伸規則」與「待改善項目」。截至 2026-10-06 已完成兩批 P1 改善及操作提示裁切修正，見第 8、10、11、12 節；P2 建議尚未實作。
> 使用者於 2026-10-06 確認本批修改驗收 OK；相關 3 個 OpenSpec change 已封存。驗收確認不額外推定裝置或測試範圍。

## 0. 範圍與使用方式

初次盤點依據前端模板、SCSS、元件內嵌樣式、主題服務、SRS 與資料結構，涵蓋首頁、驗證頁、角色列表／表單／角色頁、冒險列表／表單／詳情、倉庫列表／表單與共用彈窗。兩批改善另以 Playwright／Chromium、本機虛構資料與測試 API 驗證，範圍見第 10、11 節。其餘發現仍為靜態盤點；尚未進行 iOS／Android 實機或螢幕閱讀器驗證。

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

- **Clean Light**：冷調 Slate 背景、白色卡片、靛色主色，乾淨明亮。
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
| 次要文字 `--text-secondary` | `#64748b` | `#a1a1aa` | 說明、欄位資訊 |
| 弱化文字 `--text-muted` | `#94a3b8` | `#71717a` | 低優先 metadata，閱讀性待檢查 |
| 靛色／紫色主色 `--color-primary` | `#4f46e5` | `#a855f7` | 自訂主操作、選取、焦點 |
| 主色 Hover `--color-primary-hover` | `#4338ca` | `#9333ea` | 主操作指向回饋 |
| 半透明導覽底 `--header-bg` | `rgba(255,255,255,0.88)` | `rgba(39,39,42,0.88)` | 黏附頂部導覽列，模糊 12px |

### 功能色

| 語意 | 淺色文字／底色 | 深色文字／底色 | 用途 |
| --- | --- | --- | --- |
| 金幣 `--color-gold` | `#d97706`／`#fef3c7` | `#fbbf24`／`rgba(251,191,36,0.15)` | 金幣、故事獎勵 |
| 同調 `--color-attunement` | `#d97706`／`#fef3c7` | `#fbbf24`／`rgba(251,191,36,0.15)` | 同調需求 |
| 正向 `--color-positive` | `#059669`／`#d1fae5` | `#34d399`／`rgba(52,211,153,0.15)` | 增加、成功、休整期識別 |
| 負向 `--color-negative` | `#e11d48`／`#ffe4e6` | `#fb7185`／`rgba(251,113,133,0.15)` | 扣減、錯誤、刪除 |
| 資訊 `--color-info` | `#0284c7`／`#e0f2fe` | `#38bdf8`／`rgba(56,189,248,0.15)` | 等級、說明、結算分區 |

多個語意色代表不同資料類型，不是任意裝飾色。增減必須同時保留正負號或文字，不能只用紅綠區別。HUD 的資源識別色與資源「本次增減」色是兩種用途。

### D&D 稀有度

| 稀有度 | 淺色 Token | 深色 Token |
| --- | --- | --- |
| 普通 | `#64748b` | `#a1a1aa` |
| 非罕見 | `#16a34a` | `#4ade80` |
| 罕見 | `#2563eb` | `#60a5fa` |
| 非常罕見 | `#9333ea` | `#c084fc` |
| 傳奇 | `#d97706` | `#fde047` |
| 神器 | `#dc2626` | `#f87171` |

現況另有 [inventory.model.ts](frontend/src/app/core/models/inventory.model.ts) 的 `RARITY_COLORS`：`#9e9e9e`、`#4caf50`、`#2196f3`、`#9c27b0`、`#ff9800`、`#e53935`。倉庫篩選 chip 引用此組固定值，與全域稀有度 pill 的雙主題 token 不同。後續延伸以全域 token 為設計基準；既有兩套來源的整合列為改善項目。

### Material 主題的現況差異

Material 淺色 primary 使用 `azure-palette`，深色使用 `violet-palette`；自訂元件使用上述 `--color-primary`。角色表單部分標題使用 `--mat-sys-primary`。因此現況存在兩套主色來源，不能聲稱所有 Material 按鈕已使用相同十六進位主色；後續需確認實際 computed style 再統一。

## 3. Typography Rules — 字體與層級

### 現況

- 英文與數字：`Inter`；繁體中文：`Noto Sans TC`；其後為系統無襯線 fallback。
- 全域內文字級 `15px`，行高 `1.5`。以下 rem 約值以瀏覽器根字級 16px 為前提，使用者設定可改變換算。
- 頁面標題常見 `1.45–1.6rem`（約 23–26px）、字重 600–700；手機多為 `1.2–1.35rem`（約 19–22px）。
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
| 圓角 | `--radius-sm: 6px`、`--radius-md: 10px`、`--radius-lg: 14px`、`--radius-full: 9999px`；驗證頁卡片另用 16px |
| 陰影 | 淺色 small 為 `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`；深色 small 為 `0 1px 3px rgba(0,0,0,.4)`。中／大陰影用於更高層次，不新增外發光 |
| 主要操作 | Material flat button；新增角色／冒險／物品在手機多為滿寬、44px 高。提交按鈕常見 44–46px |
| 次要操作 | stroked／text button；取消與儲存於表單底部並排；手機分配可用寬度 |
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

主要外距為桌機 16–24px、手機 12–16px；清單 gap 常見 10–20px，表單 gap 常見 8–14px。這些是現有慣例，尚未形成完整 spacing token。

### 延伸規則

- 大區塊優先使用 Grid；文字／圖示與小型工具列可使用 Flex。沿用各頁現有容器寬度。
- 保持 `min-width: 0`、可換行與安全區 padding；長名稱、大數值、多標籤需有清楚空間。
- 響應式以內容可用空間決定，不強制把所有現有斷點改成 768px。
- 全站禁止內容水平溢出；現有 `overflow-x: clip` 是防護，不是內容完整可見的證明。
- `viewport-fit=cover` 與安全區變數已存在；新增貼邊操作應沿用。
- 現況角色 HUD 在 <=600px 為單欄，且模板有等級、金幣、休整期、永久物品、靈魂幣五項。SRS 的 2×2 描述與 SCSS 註解需釐清。
- 首頁置中 Hero 與現有登入／註冊入口保留；內容頁不需要新增宣傳 Hero 或標題插圖。

## 6. Motion & Interaction — 動效與互動

### 現況

卡片 hover 微抬升 1–2px，`.clickable:active` 縮至 `0.985`。常見 transition 為 150–250ms；主題底色／文字轉換約 200ms，角色 Tabs 150ms。骨架使用 1.6 秒 opacity pulse；部分 hover 仍使用 `transition: all`。未在 `frontend/src` 找到 `prefers-reduced-motion` 規則。

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
| Token 引用缺漏 | 冒險表單引用未定義的 `--text-disabled`／`--radius-xs` 且無 fallback；首頁 `--border-color`、篩選 `--color-error`、詳情 `--color-warning`／`--color-surface-variant` 依賴 fallback | 先決定是否使用現有語意 token 或補齊定義；不要把未定義名稱納入新畫面規範 |
| 主色與稀有度兩套來源 | Material palette 與自訂 primary 不同；篩選 chip 使用固定 `RARITY_COLORS`，pill 使用雙主題 CSS token | 建立唯一語意來源與 Material 對應，驗證同頁按鈕、focus、chip、pill 在兩種主題下的一致性 |
| 休整期識別色不一致 | 角色 HUD／冒險表單用 `--color-positive`；詳情 `.total-val.stat-downtime` 用 `--color-info` | 明確區分資源識別色和增減色；目前延伸以綠色休整期為基準，將詳情差異列入統一範圍 |
| 部分自訂區塊仍保留淺色常數 | 倉庫數量徽章固定 `#2563eb`，delete hover 固定 `#fee2e2`；角色表單 avatar placeholder 為半透明白字；詳情來源／待補 pill fallback 為 `#eef2f7` | 使用雙主題語意值；檢查淺色占位圖、深色數量與待補標籤，不能只修一般狀態 |
| 暗色故事獎勵覆寫作用域需確認 | 冒險列表 SCSS 以 `body.theme-dark &` 覆寫，但元件沒有宣告停用 Angular 預設樣式封裝 | 檢查編譯後選擇器／computed style 是否命中 body；優先透過既有 token 避免依賴外層選擇器。尚未確認覆寫失效 |
| 手機全文取得依賴 Tooltip | 倉庫物品名／來源與角色名稱等採省略，並搭配 Tooltip；觸控長按可發現性較低 | 詳情／編輯頁提供全文；摘要視需要可換行或展開。確認來源、職業與完整品名有明確入口 |
| 次要文字與焦點識別需檢查 | `--text-muted` 用於小字、備註、placeholder；全域移除 tap highlight，自訂搜尋 input 移除 outline，排序原生 select 為 opacity 0 | 深淺色逐一量測文字與底色；補足自訂按鈕及透明 select 的 focus-visible 回饋。現有搜尋容器有 focus-within，勿直接移除 |
| 長表單操作列可達性 | 冒險表單 `.form-actions` 位於文件底部，沒有 sticky／fixed；SRS 提及 Sticky Action Footer。設定差異確認，鍵盤遮擋待實測 | 先釐清是否要求黏附儲存列；如採用，為內容、鍵盤與 safe area 預留空間，驗證最後欄位不被遮住 |
| HUD 實作與規格落差 | 角色頁模板五項數值；<=600px SCSS 單欄，註解與 SRS 描述 2×2；手機內容因此較長 | 保留現況並確認期望，評估五項的閱讀順序與冒險列表首屏可見性，再決定是否重排 |
| 載入骨架與成品尺寸不一致 | 角色列表骨架 avatar 為 44px 圓形，成品為 128px／手機104px圓角肖像；其他頁面混用 spinner | 列表骨架對齊真實版面與行高；提交 spinner 保留，補上明確進度文字，避免載入完成後明顯跳動 |
| 高度與減少動態處理不足 | 首頁／驗證頁多處使用 `100vh`，root 使用 `100dvh`；法律彈窗用 85vh；未見 reduced-motion 分支 | 新版面使用動態 viewport 策略，驗證地址列及鍵盤開合；減少動態時關閉位移與骨架 pulse |
| 字級／間距與 SRS 配色尚未同步 | SRS §9.1 記載早期 Slate Dark，現行為 Clean Light／Soft Charcoal；頁面自訂圓角、字級與按鈕高度分散 | 後續以獨立 OpenSpec change 釐清與同步；先整理常用尺度，再評估是否需要抽成 token，避免純為抽象而重構 |

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
- 第一批未包含的角色卡小字及卡片鍵盤導覽，已於第二批處理，見第 11 節。第 8 節 P2 項目仍待處理；iOS 鍵盤／安全區、實機手指操作與供應商 OAuth 未由本次桌機 Chromium 驗證取代。

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
