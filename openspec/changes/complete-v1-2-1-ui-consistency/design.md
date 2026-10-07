# Design

## Context

範圍見 proposal.md。styles.scss 已有雙主題 token，Material 使用淺色 azure／深色 violet；自訂主色及 model 稀有度另有固定色。角色頁有五項 HUD，手機單欄；冒險表單操作位於底部。骨架肖像與成品不一致，主要置中頁使用 100vh。

## Goals / Non-Goals

**Goals:** 完成已盤點 P2，沿用現有字體、卡片、主題色系與資料操作；以 CSS／模板及既有 Material 完成。

**Non-Goals:** 新視覺提案、整套配色重選、業務功能、API、資料庫及自動發布。

## Decisions

- 主色別名指向目前 Material primary，hover 從該色與表面混合，保留現有 Material palette。相比自訂新 palette，這樣不引入新的品牌選擇。
- 稀有度 model 對應 CSS variable，chip 與 pill 共用主題色；缺漏引用優先改用現有 token，補 radius-xs: 4px 與 text-disabled 作為現有引用需要的尺度／語意。
- 文字／語意色保持原色相，調整明度以達 4.5:1；量測包含帶透明度底色與 elevated surface，單純換名不足以改善閱讀。
- 倉庫名稱／來源與角色資訊自然換行，直接顯示全文，保留原連結與操作區；避免額外展開狀態與 JS。
- 手機 HUD 第一項等級跨兩欄，下方四項資源 2×2，單位／長數字可斷行，維持資料順序。
- 冒險操作列在 <=768px 採 bottom sticky 並保留文件流位置；<=600px 高度時取消 sticky。欄位預留 scroll-margin，避免短視窗及最後欄位被覆蓋；不引入鍵盤偵測程式。
- 骨架直接重用成品 card／hero／portrait class，模擬相同資訊列及 footer；動態 viewport 使用 dvh，reduced-motion 全站停用持續動態及位移。保留 spinner 作為靜態進度圖示，附文字說明。
- 保留工作目錄中既有兩個 SCSS 使用者修改，只在必要位置做增量修正，不還原或重新格式化。
- 靜態盤點的 source-pill／pending-pill 沒有模板引用，移除未使用樣式及未使用的詳情頁稀有度對應欄位，不另新增來源／待補標籤 UI。

## Risks / Trade-offs

- 主色統一與對比調整會使部分文字亮度不同 → 保留色相及既有 Material，附雙主題截圖及量測。
- 完整名稱較長使卡片變高 → 文字自然增高；大字與長資料驗證操作區不重疊。
- dvh／短視窗不能代表所有實機鍵盤 → 桌機模擬高度及 safe-area，另保留實機驗收限制，不宣稱實機驗證。
- 骨架無法預知每筆長內容高度 → 與一般完整資訊卡對齊，長資料成長視為內容需求，不保證所有卡片零位移。

## Migration Plan

無資料遷移。透過現有分支交付；使用者驗收後才依明確指示合併 main，沿用 CI/CD。必要時還原本 change 的樣式及模板即可回復。
