# Design

## Context

動機與範圍見 [proposal.md](proposal.md)，原始碼證據見 [audit.md](audit.md)。目前沿用 Angular Material M3 雙主題及額外業務 token，已有手機分支；主要欠缺在各頁狀態一致性與自訂互動語意。1.3.0 的手機呈現與開卡值／資源計算已驗收，不能因套用 skill 擅自重排或改計算。

## Goals / Non-Goals

**Goals:** 沿用現有元件與訊號，把可復原錯誤、頁面內容關聯、鍵盤操作及語意角色一致套用於核心流程；提供可追溯的驗收矩陣。

**Non-Goals:** 不升級框架、不加入設計或動效函式庫、不導入 Android 元件行為、不改 OAuth／後端／資料庫。不強迫重選配色、換字體、全面移除卡片或增加 FAB／rail／Expressive。

## Decisions

### 1. 在現有頁面建立最小狀態分支

列表以 loading／loaded／error 搭配資料與搜尋衍生結果，避免以空陣列代表失敗。沿用冒險編輯的載入門檻與重試做法，物品編輯新增成功載入門檻並在 handler 與按鈕兩層阻止未就緒儲存。HTTP 404、認證／權限與暫時網路錯誤分流；認證仍交給既有安全流程。背景刷新保留最後成功資料及非阻斷更新失敗提示。先各頁修正，只有確實重複時才抽共用提示模板；不引入通用狀態框架。

### 2. 區分路由分頁與同頁分類

角色採 Angular Material tab nav 與 tab nav panel 包覆實際 router-outlet，以 router link 保留網址行為。倉庫採現有 tab group，讓永久物品／消耗品內容位於各自 panel，共用搜尋工具可保留在共同區域。比手工補 ARIA 到空 tab group 更容易維護。驗證直接網址、返回、選取、焦點與層級內容關聯；路由內容仍是同角色下的兩個目的區。

### 3. 裁切與驗證提供完整鍵盤復原

裁切保留 pointer/touch 行為，增加有名稱的位移控制（上下左右）與 slider 名稱／值；位移使用既有 transform 與邊界限制，保留預覽比例及 300×300 匯出。新增文字說明，不要求使用者猜測 canvas 操作。長表單以錯誤摘要及定位入口連結至對應欄位，先展開再聚焦；既有明細條件、資源校驗與快照不變。

驗證頁 loading 按鈕保留「登入中／註冊中」等文字，status／alert 或既有 Material LiveAnnouncer 按情境選一個；不要把同一錯誤同時以多處 assertive 播報。搜尋結果只適度播報摘要。route title、skip link 與導覽焦點只處理真正頁面進入，避免同頁更新搶焦點。

### 4. 明確使用 M3 角色，保留品牌與業務例外

建立對應表：canvas→surface、一般卡片→surfaceContainerLow、較高層表面→surfaceContainer／High、主要文字→onSurface、次要文字→onSurfaceVariant、細邊框→outlineVariant、主操作→primary/onPrimary、錯誤／刪除→error/onError 或 errorContainer/onErrorContainer。既有 slate／zinc 品牌底色可以在 token 層覆寫角色；不直接把所有畫面換成庫預設表面色。稀有度、金幣、休整期保持業務 token；OAuth 官方品牌、裁切深底等列入有理由例外。

字體以 headline／title／body／label 建立少量產品 token，必要時 alias Material type role；映射到 1.3.0 的已驗收字級，而非機械套用 Android 尺寸。容器定義 identity card、活動摘要卡、表單 region、連續清單用途。透過 public theme overrides 取代可以移除的內部 .mdc 覆寫，不一次重寫所有樣式。

確認視窗新增 general／destructive 意圖，刪除使用 button overrides 的 error/onError 配對，取代無效 color="warn"。明確取消初始焦點；開卡值及更新重新整理確認沿用一般語意。

### 5. 跨裝置驗收及選配設計分開

核心驗收：首頁、驗證四頁、角色列表／shell／表單／裁切、冒險列表／詳情／表單、倉庫列表／表單、法律頁及共用 dialog／Snackbar。涵蓋雙主題、正常／空／錯誤／loading／busy／選取／focus／hover、長名稱與中文；以虛構資料／API 回應測試，不改正式資料。

尺寸用 CSS px：320、360、390、600、601、767、768、769、1280、1600；599px 用於 600 邊界補充。根字級 200% 與真正瀏覽器 zoom 200% 分開記錄；補短視窗、觸控與硬體鍵盤、實機虛擬鍵盤／安全區及螢幕閱讀器。完整矩陣取代表性情境交叉，不必每一種狀態乘上所有尺寸；說明覆蓋範圍與未測項目。

M3-09 只比較現況與寬視窗 supporting pane／list-detail，以及倉庫容器替代。先製作同資料方案與任務效率依據，採用時再更新 change 或另提案，避免覆寫已確認桌機規格。

## Risks / Trade-offs

- [surface／字體映射改變密度及配色] → 保留現有品牌 token 與手機尺寸，雙主題 screenshots／對比／大字量測後逐區替換。
- [tabs 內容移動導致狀態重建或焦點失去] → 明確保存搜尋及篩選，確認直接網址與返回，補流程回歸。
- [錯誤摘要或 live region 太吵] → 每次操作僅一份必要播報，鍵盤／螢幕閱讀器人工確認。
- [單靠原始碼不能判定真實對比、screen reader 與 IME] → 保留本輪「待驗證」標示；實機未完成時不宣稱全面通過。

## Migration Plan

2026-10-09驗收修訂：依使用者明確「跳過」指示，本版略過螢幕閱讀器人工朗讀驗收。上述可及性語意及鍵盤／焦點設計保持，程式與瀏覽器證據保留；僅不執行實際輔助技術朗讀，不宣稱已驗證播報相容性或全面WCAG符合。任務2.5／5.2依修訂後驗收範圍結案，驗證紀錄保留此例外與未提供的手機配置。

按 P1 狀態→導覽／鍵盤→確認→P2 token／驗收順序實作，逐批保留可檢查紀錄。完成後同步 SRS、DESIGN.md 與 mobile-pwa，再依使用者指示安排 1.4.0 發布與版號同步。無資料 migration；回復以已確認前端修改為範圍，保留資料與既有快取規則。發布與部署一律依 VERSIONING.md。
