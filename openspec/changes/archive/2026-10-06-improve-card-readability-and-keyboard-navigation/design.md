# Design

## Context

見 proposal.md。現有角色卡資訊區固定 90–128px，資料列固定 18–24px，手機字級隨 breakpoint 縮小。三類列表卡均有容器 click；角色與倉庫卡內又有編輯／刪除。已有 RouterLink、語意主題色與 clean-card 共用樣式。

## Goals / Non-Goals

**Goals:** 原生 HTML 與 CSS 提供完整資訊、自然焦點順序、清楚連結名稱及原有滑鼠導覽。

**Non-Goals:** 不新增自訂鍵盤事件、套件或全站焦點架構；不更動 API、P2 版型及現有冒險表單／倉庫 SCSS 工作區修改。

## Decisions

- 角色資訊採 0.875rem、1.5 行高與自動高度；名稱換行，資訊值可斷長字。保留肖像尺寸與配色；資訊欄以 10rem 為 flex basis，放大文字時可換到肖像下方。單純加大字但保留固定高度會讓內容重疊，因此一併移除相關高度限制。
- 冒險卡無互動子元素，整卡改 RouterLink anchor；角色／倉庫使用標題連結的絕對定位 pseudo-element 擴展點擊範圍。編輯／刪除區在其上且為兄弟元素，避免整卡 anchor 包住 button。
- 共用樣式為連結保留既有字色／無底線，卡片焦點使用內縮 outline，避免被 overflow hidden 裁掉。品牌採原生 anchor 並補足明確名稱及焦點。
- 不使用 role、tabindex 或手寫 Enter／Space handler 模擬連結，讓瀏覽器原生支援 href、修飾鍵與新分頁。

## Risks / Trade-offs

- [伸展連結擋住按鈕] → 操作區提高 stacking，驗證實際點擊、Tab／Enter 與取消刪除。
- [卡片變高] → 允許完整閱讀；在手機及 200% 基準字級檢查溢出與操作列。
- [觸控／讀屏差異] → 瀏覽器驗證不等同實機或螢幕閱讀器認證，記錄限制。

## Migration Plan

僅前端與文件變更，依現有 CI 部署；本次不 commit／push／部署。需要回復時僅回復本 change 的變更，不覆蓋既有工作區內容。
