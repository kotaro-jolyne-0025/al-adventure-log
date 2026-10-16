# Design

## Context

見 proposal.md。前端 `detailedMagicItems` 及後端 `validateMagicItemDetails` 同時加總永久物品筆數與消耗品數量。`refreshCurrentMagicItems` 已僅加總 PERMANENT 倉庫數量。Google 採 GIS renderButton／credential callback，帳號選單以 span 顯示 Email。S26 Ultra／Samsung Internet 30.0.5.24 真機追蹤已確認瀏覽器發出 `mailto:` intent 開啟 Gmail，當時網站未收到 OAuth 請求；已載入的選帳 DOM 沒有 `mailto:` anchor。觸發來源仍未定位，使用者決定將修正延期追蹤，暫不變更登入程式。共用 FormFeedbackComponent 有錯誤播報及欄位定位，但冒險頁目前放在表單頂部。

## Goals / Non-Goals

**Goals:** 復用既有快照、來源、庫存差額同步及表單回饋元件，消除重複數量輸入，統一永久物品計數。

**Non-Goals:** 不重建 OAuth 或庫存架構。使用者已確認將角色靈魂幣融合至倉庫消耗品：轉移 soulCoins 並移除獨立輸入，保留 HUD 的唯讀總量，之後只有倉庫作為數量來源。保留 soulCoinChargesUsed 歷史文字，不自行推定一枚硬幣的充能狀態。

## Decisions

1. **以永久明細作為獲得數量來源。** 每筆永久明細仍為一件，依 acquisitionSource 分入冒險或休整期。新明細提供可選來源，預設 ADVENTURE；金幣與天數維持既有輸入。整張永久物品資源卡移除，不顯示該卡的獲得摘要、數量或減少輸入；實際物品明細仍可填寫。既有減少數載入後保留於資料模型，由「明細獲得減去既有減少」生成 magicItemsChange／magicItemsDowntimeChange。休整活動中的永久物品獲得亦必須填明細，不能只填正數。後端完整儲存從明細推導正向獲得，校驗減少及總計；原有基本 CRUD、追加／刪除明細入口亦須保持一致，避免只修前端。保留既有 DTO 欄位作相容輸出，必要時增加獨立減少數欄位以避免同時獲得與減少互相抵銷後無法還原。
2. **歷史數量保守處理。** 已有快照依永久明細計獲得；來源缺失沿用現有保守匹配，不能改名猜來源。無快照或混計消耗品的舊紀錄不得載入後自動儲存修正；進入編輯時提示將按永久明細重新計算，缺失明細需由玩家補齊。其他冒險快照不批次重算，重存不補回已使用或刪除的庫存。同步移除主規格中允許自動待補的舊要求，但既有待補物品仍可補資料。
3. **靈魂幣為消耗品獨立布林標記。** 倉庫與冒險獲得快照新增 is_soul_coin BOOLEAN NOT NULL DEFAULT FALSE，DTO 使用 isSoulCoin；只允許 CONSUMABLE 勾選。表單切換永久類型清除標記並提示，API 與資料庫拒絕非法組合。移除 SOUL_COIN enum／選項，用 V27 將舊 SOUL_COIN 類別一次性轉成 true 並清除分類為 null；舊制式名稱「靈魂硬幣」統一為「靈魂幣」，保留自訂名稱、稀有度、數量、來源、備註與歷史關聯。V25／V26 不修改。勾選或取消均不自動帶入或清除其他欄位，不追蹤充能。保存／回填／快照同步涵蓋基本及完整明細入口，差額同步不補貨；倉庫自行取消標記不回寫歷史。目前剩餘總量僅在頂部 HUD 顯示，倉庫清單不重複顯示總量；HUD 與冒險詳情各依所屬資料的標記與 quantity 加總，不按名字、分類或筆數判斷。
4. **錯誤放進儲存操作區。** 將共用回饋放在手機按鈕同一操作容器的上方或旁邊；窄螢幕可換行，桌機維持清楚的表單回饋。每次提交僅有一個 live alert，定位按鈕展開／捲動至第一個可操作錯誤欄位，API 錯誤顯示伺服器可用說明。使用 errorContainer／onErrorContainer 角色，支援安全區、短視窗、大字與鍵盤。擴充既有操作區即可，不另建全域通知服務。
5. **Samsung Internet 帳號選擇問題列為延期追蹤。** 下一次在 S26 Ultra Samsung Internet 剛出現 Google 帳號選擇頁時重現，捕捉點擊目標與導覽事件，再區分 GIS 頁面行為與瀏覽器 Email 辨識。不得假設父頁 CSS 能修改 Google 跨來源 iframe。觸發來源未確認前不改登入程式或官方 GIS 參數；如後續證據支持調整，先查核 Google 官方文件。保留真正「聯絡我」功能與既有後端 token 驗證。

## Risks / Trade-offs

Google 後端驗證改用 Google API Client Library `GoogleIdTokenVerifier.verify(GoogleIdToken)`，保留 GIS popup 與既有 API 契約。先拒絕格式破損及缺漏／null 必要欄位，再驗簽；只有全部通過才查詢或建立帳號。解析例外回傳不含憑證的可恢復錯誤，公鑰服務失敗拒絕登入且允許重試。採用 library 驗簽是正式環境驗證路徑改善，不視為三星跳 Gmail 的修正；以本機 RSA 金鑰測試真實驗簽，不只 mock verifier。

Google credential 只由登入頁 GIS callback 傳送 ID token；通用 `/auth/callback/:provider` 僅處理 Discord authorization code 與 state，拒絕 Google 或未知 provider 且不提交 API、不消耗 Discord state。Google 不使用 client secret，移除未使用的後端設定屬性；既有雲端設定不在本機修正範圍內。

登入背景確認使用 localStorage 保存 userId 與檢查時間，同一帳號每 24 小時至多一次，啟動及受保護頁面導航共用判斷；無快取使用者或紀錄無效時立即向伺服器恢復帳號資料。登入成功即視為已確認，登出清除紀錄。背景請求開始時記錄時間，暫時網路／5xx 失敗保留已有帳號並避免重新載入反覆請求；缺少使用者資料時仍允許重試恢復。路由本機 JWT 過期檢查與 API 401 不受每日限制，後端每個受保護請求仍驗證憑證及所有權。帳號切換或登出取消舊帳號的確認及個人資料更新請求，防止晚到回應復活登入狀態。啟動確認排入 microtask，避免 AuthService 建構時與 HTTP interceptor 互相注入。

本輪只調整登入背景確認；本機草稿、持久化角色／紀錄快取與離線同步屬於後續選項，不自行加入。現有主題及排序設定已保存本機，搜尋篩選、填表與即時計算在前端，資料讀取具有記憶體快取；已儲存資料仍以雲端為準。

### OAuth hardening follow-up

1. Google 綁定帳號不提供本站密碼重設。忘記密碼維持相同一般回覆並不寄送；驗證及重設端點都重新查核 Google 綁定，涵蓋先前核發的重設 token。密碼帳號與僅 Discord 綁定帳號維持原流程。
2. OAuth 登入及註冊以 RequestBodyAdvice 在 JSON 解析前限制本體為 64 KiB；有界讀取不依賴 Content-Length，超限回傳 413。DTO 另限制 provider、token/code 與 redirect URI 長度。Controller 在呼叫 AuthService 前套用既有資料庫共享限流服務，OAuth 來源限制不依賴每次都可變的 provider token 當作帳號識別。
3. OAuthService 先完成 Google 簽章／Discord 外部請求，再在短資料庫交易內查找／更新既有帳號。不要讓 AuthService 外層交易跨過 OAuth 驗證；保留帳號更新及 OAuth 註冊的原子性。
4. 以 Google API Client 的 GoogleIdTokenVerifier 與 GooglePublicKeysManager 驗證 ID token，讓公鑰快取依 Google `Cache-Control` 更新。保留既有 audience、issuer、exp、email_verified 與 sub 檢查；不自行解析或快取 Google 金鑰。

倉庫兩個分頁共用搜尋模板；分頁與搜尋的留白由搜尋面板自身的 padding 管理，搜尋與篩選由面板 gap 管理。不要依賴分頁群組的外距或額外總量文字來隔開底線，手機不另覆寫同一份頂部留白，以免之後移除摘要或切換分頁時再度貼合。

靈魂幣總量以 quantity 加總，同一冒險可有多筆 isSoulCoin 已標記明細並保留各自快照 ID。歷史獲得總量使用該冒險快照加總，目前持有總量使用同角色倉庫剩餘數量加總，不能共用一個不分用途的計數。不得為 character + category 或 adventure + category 加唯一限制；移轉防重只針對穩定的舊資料轉移識別，不阻止真正新增的第二筆靈魂幣。

Google 登入檢視 SHALL 追蹤完整串接：前端 GIS initialize／renderButton、憑證 callback、loginOAuth 請求、後端 GOOGLE provider 的 tokenOrCode 處理、Google 憑證驗證及網站登入回應。查核實際採 ID token 或 authorization code 的路徑是否一致，client ID／audience、issuer、有效期及適用的 redirect URI／authorized origin 設定是否符合官方要求；若實際使用 authorization code，再檢查 code exchange 與 state 防護。避免將 OAuth access token 與登入 ID token 混用，失敗時應提供可恢復的錯誤而非意外導覽。檢視過程不得在公開文件或輸出記錄 token、client secret 或個人帳號資料。以重現證據區分 Google 帳號選擇介面的瀏覽器互動與網站後端串接失敗；不在未確認前更換整套驗證方式。

- 舊紀錄混計消耗品 → 編輯時可見提示與永久明細推導，只更正該筆，驗證角色數量及其他歷史不被更改。
- 同時獲得／減少及休整來源 → 分開表示獲得、減少，測試來源與淨值，而非以正淨值推定獲得數。
- Google 偶發問題無法在模擬環境重現 → 記錄真機待驗證，不以單元測試或推測宣稱解決。
- 重複錯誤播報及操作列遮擋 → 單一 alert，自然增高；短視窗回到文件流，保留所有欄位與操作可達。

## Migration Plan

新增下一個未使用 Flyway 編號，不更動 V25；轉移前後逐角色核對舊數量與新增庫存數量，測試零值、正數、已有同類庫存及重跑不重複；角色 API 停止接受舊數量直接寫入，避免轉移後復活第二套數量來源。在隔離資料庫驗證重跑、既有值、SOUL_COIN 合法組合及非法組合交易回滾。發布依 VERSIONING.md 另行授權。已寫入新分類後不可直接回退至不認識該值的 API；若需回退，先由維運者按備份程序處理新分類資料，再回退限制與程式。
