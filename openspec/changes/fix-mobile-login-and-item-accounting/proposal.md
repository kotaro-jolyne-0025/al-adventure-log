# Proposal

## Why

手機使用者回報 Google 帳號操作偶發開啟寄信畫面，以及儲存驗證訊息離操作位置太遠。冒險表單與後端目前將消耗品納入永久魔法物品明細驗證，且要求玩家重複輸入獲得數量，需要一起調整規格與實作。

## What Changes

- 排查 S26 Ultra 三星瀏覽器在 Google 帳號選擇畫面點擊帳號時偶發開啟寄信的問題，並檢視 Google OAuth 2.0／Google Identity Services 前後端串接與設定；已確認發生位置，根因仍待重現，OAuth 串接問題列為待驗證假說。
- 魔法物品數量僅計永久物品，消耗品數量不影響其驗證、結算或角色數量。
- 移除整張「永久性魔法物品」資源卡，不顯示數量輸入、減少欄位或該卡的自動計算摘要；保留實際物品明細，按冒險／休整來源自動計算。既有減少紀錄仍由資料層保留。
- 在冒險消耗品與倉庫表單提供獨立「靈魂幣」勾選框，保存 isSoulCoin，取代 SOUL_COIN 類別；只追蹤枚數，不帶入名稱、稀有度、分類或敘述。舊分類轉成標記並清除舊分類值，其他資料保留。角色 HUD 依已標記消耗品 quantity 加總。
- 手機冒險、角色與物品表單於儲存操作附近顯示驗證與儲存失敗訊息，提供欄位定位並保留輸入。
- 靈魂幣允許同一冒險分開記錄多筆；歷史獲得與目前持有總量各按對應項目的 quantity 加總，不按筆數或冒險次數計算。
- 登入狀態的背景 `/auth/me` 確認改為每 24 小時至多一次，重新開啟與頁面切換共用本機紀錄；實際登入、登出、Token 過期及 API 未授權仍即時處理。
- Google 綁定帳號不透過本站忘記密碼／重設連結建立本機密碼；OAuth 登入及註冊加上共享來源限流與輸入大小上限，第三方驗證移至資料庫交易外，Google 公鑰依官方 Cache-Control 快取。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `identity-access`: 帳號登入與帳號資訊操作不得意外啟動寄信；背景帳號確認每日一次，Google 綁定帳號密碼復原及 OAuth 資源限制對齊。
- `adventure-log`: 永久物品明細自動計算獲得數量，消耗品排除於魔法物品結算。
- `inventory-provenance`: 新增消耗品靈魂幣標記，統一新舊明細與庫存同步規則。
- `mobile-pwa`: 儲存操作附近的持續錯誤提示與定位。

## Impact

前端登入元件、character-form／character-shell、adventure-form、inventory model／表單／詳情，以及共用 FormFeedbackComponent。後端 OAuth／密碼復原服務及 DTO、既有限流服務，AdventureEntryService 的完整儲存及其他物品寫入入口、CharacterService／DTO／MyBatis、ItemCategory enum 與資料庫 category CHECK。使用新 Flyway migration 擴充限制及轉移舊靈魂幣數量，不修改已套用 V25。更新相關測試、SRS 與資料庫文件；Google 憑證驗證新增 Google API Client Library 依賴，其餘功能不新增依賴；不操作正式資料庫、不發布。

既有 adventure-log 的 `Magic item changes require matching item details` 要求消耗品計入數量，與本次需求相反；inventory-provenance 的 `Traceable placeholder magic items` 又保留自動待補規則，與目前完整儲存拒絕缺少明細的行為不一致。本 change 必須明確同步這兩項規格，不只修改畫面。
