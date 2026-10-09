# Design

## Context

見 proposal.md。角色子頁共用 character-shell，手機 HUD 已採等級一列、四項資源 2×2；表單仍繼承完整摘要。共用手機規則已有 16px 輸入框、44px 操作與可見鍵盤焦點。

## Goals / Non-Goals

**Goals:** 以手機限定 CSS 和既有模板完成第一批密度調整，維持桌機呈現及資料行為。

**Non-Goals:** 篩選展開、表單分段重排、整站配色、版本發布、API 與資料庫變更。

## Decisions

- 新樣式限定 `max-width: 600px`；601px 以上保留原有規則，以 768／1280px 的版面與截圖對照證明無影響。
- 角色摘要縮減 padding、gap 與 HUD 數字至 16px；資源標籤與既有小字不再縮小。數值仍允許換行。
- HUD 由一個 ng-template 共用：一般呈現使用原有位置，手機表單透過 CSS `:has` 顯示原生 details，預設收合。避免新增路由／viewport 訂閱或自行維護展開狀態；原生 summary 支援觸控與鍵盤。桌機僅顯示原有摘要。
- 冒險與倉庫手機工具列共用 Grid：標題及短新增標籤位於第一列，排序第二列、搜尋維持原位置。共用手機樣式集中在 styles.scss，避免兩份相同的規則。
- 名稱、代碼、DM 在手機斷長字並保留圖示，修正實際 clipping；不改搜尋、排序或卡片導覽。

## Risks / Trade-offs

- 大字／長名稱可能使緊湊工具列變高 → 允許換行與自然增高，不使用固定高度裁切；維持 44px 按鈕。
- 手機表單 HUD 展開會推下內容 → 使用正常文件流，資料仍完整可讀。
- `:has` 依賴支援此選擇器的瀏覽器 → 沿用本專案現有 `:has` 支援基準；不宣稱完成 iOS／Android 實機驗證。
- CSS 影響 Material 排列 → 驗證雙主題、320／360／390／600px、大字與鍵盤，並比較桌機基準。

## Migration Plan

無資料遷移。完成後同步 mobile-pwa、SRS 與 DESIGN.md；保留 change 待整體驗收。發布依 VERSIONING.md 與使用者後續指示。本 change 的模板與樣式可獨立還原。
