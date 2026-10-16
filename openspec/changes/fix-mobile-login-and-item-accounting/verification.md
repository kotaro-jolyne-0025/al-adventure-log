# 實作與驗證紀錄

## Google GIS / OAuth 檢視

- **認證實作收尾（2026-10-16）**：重新核對前面已完成的 library 驗簽、claims 校驗、錯誤處理及登入頁 GIS callback，補齊通用 OAuth callback 的契約不一致：`/auth/callback/:provider` 現僅接受 Discord authorization code，Google／未知 provider 在提交 API 前拒絕，且不消耗 Discord state。移除未使用的 `app.oauth.google.client-secret` 設定；Google 繼續由登入頁 GIS callback 傳送 ID token，不更換登入協定。新增兩個 callback 拒絕回歸；完整前端 `npm test -- --watch=false` 36 檔／228 項通過，production build 通過（既有 heic2any CommonJS 警告）。後端初次測試因舊 class 產物 `ClassFormatError` 未能啟動；clean rebuild 後 `mvnw.cmd -Dtest=GoogleTokenVerificationTest,OAuthServiceTest,AuthFlowIntegrationTest clean package` 43 項通過，打包成功。SRS、設計及任務同步；這些本機程式修改尚未 commit、push 或部署。

- **USB 真機追蹤（2026-10-16，Samsung Internet 30.0.5.24）**：使用者在已連接 CDP 的手機重現立即點選帳號後跳 Gmail。20:04:32.203 偵測到 Google `/v3/signin/accountchooser` 分頁；Android 於 20:04:32.441 記錄 Samsung Internet 發起 `android.intent.action.VIEW`、URI scheme 為 `mailto:`，目標為 Gmail 外部撰寫 Activity。這兩個時間是分頁偵測與系統啟動紀錄，不能當成畫面顯示至點擊的精確耗時。同期受追蹤網站分頁未見 `/api/auth/oauth` 請求。事後讀取已完成載入的 Google 選帳 DOM，帳號節點為 `DIV role=link`，現有 anchor 均非 `mailto:`；這不能排除初始載入階段的瞬態 DOM 或瀏覽器原生 Email 辨識。已確認切換經由 Samsung 發出的寄信 intent，尚未確認由 Google 頁面腳本、初始 DOM 或 Samsung 內部處理哪一者觸發。沒有蒐集憑證／請求內容，文件不保存帳號、裝置序號或原始私人操作紀錄。此次未變更登入程式或部署；後端驗簽修改不會直接攔截這個跨 App intent，問題仍未修復。
- **延後重試對照**：為下一次帳號列點擊裝上的追蹤沒有記錄到點擊；使用者回報這次未跳 Gmail，系統前景留在 Samsung Internet，網站同時已有 `/characters` 頁。由於成功路徑沒有觸發預期帳號選單，無法判定上次 `mailto:` 的觸發來源。結果與「首次出現時立刻點才發生」相符，仍需在新鮮選帳畫面上重現並捕捉點擊目標才能定位。

- **使用者真機對照補充（2026-10-16）**：使用者回報同手機 Chrome 快點未遇到問題；Samsung Internet 在 Google 選帳畫面剛出現時立即點頭像、名稱或 Email 都會跳 Gmail，等待後點選正常。這是使用者操作結果，尚無點擊事件／網路追蹤；會降低「只有 Email 文字連結造成」的假說可信度，但不能直接認定為點擊穿透或後端錯誤。
- **相容性查核**：Google 現行 [GIS API reference](https://developers.google.com/identity/gsi/web/reference/js-reference) 將 `use_fedcm_for_button` 說明為 Chrome desktop M125+／Android M128+，不能當成已確認的 Samsung Internet 修正。官方 [popup／redirect 說明](https://developers.google.com/identity/gsi/web/guides/display-button#credential_handling) 指出 redirect 會將憑證 POST 至 login URI；現有 JavaScript callback API 不可只改 `ux_mode` 就沿用。未找到有文件依據、可控制 Google 選帳頁點擊延遲的 GIS 參數。Samsung Internet 遠端追蹤已確認 Gmail 是由 `mailto:` intent 開啟，觸發來源未定位；依使用者決定，1.2 暫列未來追蹤，未加入固定延遲、跨來源 CSS 或切換登入協定。1.3 已獨立完成正式前端／Console 核對及使用者 Chrome 無痕登入驗證，範圍與限制見下方紀錄。

- GIS `accounts.id` popup callback 取得 ID token，再由 `/api/auth/oauth` 的 GOOGLE 分支驗證後發行網站 JWT；此路徑不使用 authorization code、code exchange 或 redirect callback。工作樹程式已改用 Google API Client Library `IdTokenVerifier.verifyOrThrow()`，以單一 `GOOGLE_CLIENT_ID` 設定 audience，公鑰由 library 管理及快取。
- 後端明確拒絕缺少 client ID、錯誤 audience／issuer、過期 token、缺漏或 null 時間欄位、空白／null sub 或 Email，以及未驗證 Email。格式及必要欄位先校驗，只有簽章驗證通過才查詢帳號；解析錯誤轉為不含憑證的 400 回應，不落入通用 500 日誌。Google 公鑰取回失敗只記錄固定訊息，不記錄或回傳 token。
- 前端明確指定 popup，限制 Google 按鈕官方寬度上限，移除依賴 Google 內部 class／iframe 的強制寬度；元件離開後停止重試，阻止同時提交 callback，限制返回網址為站內路徑。
- 參照 [GIS JavaScript reference](https://developers.google.com/identity/gsi/web/reference/js-reference) 與 [ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)。正式 Google Console 的 authorized JavaScript origins 仍須與實際網站 origin 相符，本次未修改 Console 或正式環境設定。
- 單元測試覆蓋 callback 成功／失敗、空憑證、重複提交及不安全返回網址；後端覆蓋正常 claims、欄位缺失、過期、錯誤 audience／issuer、未驗證 Email 及缺少 client ID。這是模擬測試，並非真正 Google 帳號登入驗證。
- **真機重現（2026-10-16）**：使用者提供的 12.56 秒錄影顯示 S26 Ultra 上的 Samsung Internet 一般瀏覽器分頁（非 PWA）。Google 帳戶選擇頁顯示帳戶名稱及 Email；觸控指示落在 Email 字串附近後，約第 6 秒切到 Gmail 寫信草稿，收件人已填入該帳戶，主旨與內文空白，沒有送出。此片段觀察到 1 次，不能據此估算發生率。
- **根因判斷仍待驗證**：現有畫面顯示 Email 文字區域的點擊後由 Google 帳戶頁轉到郵件 App，可能是 Samsung Internet／Android 將 Email 點擊交給郵件 App；Google 帳戶選擇頁屬第三方跨來源頁面，錄影無法證明其內部連結標記或瀏覽器命中機制。網站登入頁唯一 `mailto:` 位於「聯絡我」彈窗，與錄影中的登入／Google 選帳頁及收件人不符。尚未完成修正與真機登入驗收，不宣稱問題已解決。
- **OAuth 串接核對（2026-10-16）**：程式路徑為 `google.accounts.id.initialize` → GIS `credential` callback → `AuthService.loginOAuth` → `POST /api/auth/oauth` → 後端 GOOGLE ID token 驗證與登入回應。前端使用 `ux_mode: 'popup'`，傳回 ID token；此路徑不使用 authorization code exchange 或 Google redirect callback。
- **使用者正常登入驗證（2026-10-16）**：提供移除正式 Client 兩筆 localhost 設定的操作指引後，使用者回報 Chrome 無痕 Google 登入正常。這是使用者操作結果，未蒐集 token、帳號或網路內容；未再次開啟 Console 獨立核對儲存後的清單。結合正式前端／Console Client 比對、origin 核對及本機無效憑證拒絕測試，1.3 串接檢視完成。本機新版後端仍未部署，其正式登入驗證應在發布後完成；Samsung Internet 快點跳 Gmail 仍依 1.2 延期追蹤。
- **正式 OAuth 設定唯讀核對（2026-10-16）**：Google Cloud Console 中找到的正式 Web Client ID 與 `environment.prod.ts` 及正式網站目前載入 bundle 相符；`https://aladvlog.com` 已列為 authorized JavaScript origin。該 client 另含 `http://localhost:4200` 測試 origin 及多個 redirect URI；目前 Google GIS JavaScript popup callback 路徑不使用這些 redirect URI。Google 現行 [production OAuth policy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance?hl=en#use_separate_projects_for_testing_and_production) 要求 production client 不包含測試環境／僅供開發團隊使用的 origins 或 redirect URIs，故 localhost 是設定清理候選；本次只查核，沒有修改 Console。依專案 GCP 工作流程限制，未讀取 Cloud Run 環境變數，因此無法直接比對正式後端的 `GOOGLE_CLIENT_ID`。
- Google 官方指南建議正式環境使用 client library 驗證 ID token，`tokeninfo` 用於開發除錯。本次保留 `IdTokenVerifier.verifyOrThrow()`，啟動時拒絕 `OAUTH_CLIENT_SKIP_SIGNATURE=true`。更正先前說明：Beta 不等於 deprecated；Google 指南仍以 `GoogleIdTokenVerifier` 示範，不能宣稱此類別即將淘汰。原始碼標記 deprecated 的是基底 `IdTokenVerifier.verify(IdToken)`，不是所有同名 overload。參照 [Google ID token verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)、[IdTokenVerifier 原始碼](https://github.com/googleapis/google-oauth-java-client/blob/main/google-oauth-client/src/main/java/com/google/api/client/auth/openidconnect/IdTokenVerifier.java) 與 [GoogleIdTokenVerifier 原始碼](https://github.com/googleapis/google-api-java-client/blob/main/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GoogleIdTokenVerifier.java)。
- **重新審視與回歸（2026-10-16）**：新增 `GoogleTokenVerificationTest`，使用動態產生的 RSA 測試金鑰及真實 library 驗簽，只有公鑰 HTTP 回應被替換。修正前 25 個案例中有 9 個失敗，涉及未捕捉的解析／缺欄位例外及 null 欄位；修正後 25 項通過，涵蓋兩種合法 issuer、簽章／payload 竄改、缺漏／null claims、錯誤 audience／issuer、過期、未來 iat、格式破損、公鑰快取及公鑰服務失敗後重試。
- `mvnw.cmd -Dtest=GoogleTokenVerificationTest,OAuthServiceTest,AuthFlowIntegrationTest package`：43 項通過，打包成功。含隔離 PostgreSQL 的註冊、回登入、密碼登入／重設，以及格式錯誤 Google 憑證回 400 且不建帳號。既有帳號流程測試仍使用 mock verifier；實際密碼學驗證由新增測試負責。前端 login、oauth-callback、AuthService 三個測試檔共 33 項通過。手機第二次選帳後網站分頁清單出現 `/characters`，但當次追蹤未捕捉 GIS callback 或 `/api/auth/oauth` 請求，因此只記為頁面觀察，不視為已完成真實登入端到端驗證。本次沒有 commit、push 或部署。
- 錄影顯示 Gmail 草稿出現在 Google 帳戶選擇階段，較符合第三方頁面／瀏覽器點擊行為；錄影沒有 callback 或網路追蹤，不能據此斷言後端 API 完全未被呼叫。後端驗簽修正不代表三星跳 Gmail 已解決，1.2 延期追蹤；1.3 依上述獨立串接核對與使用者 Chrome 無痕登入結果完成。

## 物品與 migration

- 永久物品依來源明細筆數計算獲得；冒險與休整期各自保存減少數，支援同次取得及失去。消耗品不納入永久物品計數。
- 靈魂幣改用獨立 `isSoulCoin` 消耗品標記，兩張物品表與服務均限制只允許 CONSUMABLE；同一冒險允許多筆。倉庫總量與歷史總量各自依標記加總 quantity，分類不參與計算。
- 隔離 PostgreSQL 17.10 測試涵蓋 V26 重跑、舊分類與 null、非法類型組合、轉移失敗回滾、已有庫存、轉移後刪除不補貨、兩筆 1／2 合計 3、使用後歷史保留、重存不補貨、正差額更新及各明細 CRUD 的永久快照計算。
- 舊角色獨立靈魂幣輸入已移除；HUD 保留靈魂幣總量，角色回應由庫存計算，直接寫入 soulCoins 被拒絕。舊資料轉移 SQL 尚未套用正式資料庫，將由部署後 Flyway 執行。

## UI 驗證

- Playwright Chromium，以本機前端與模擬 API 執行三種表單：角色必填、物品必填、冒險空白永久明細。
- 320／360／390 CSS 像素、480px 短視窗、明暗主題及 100%／200% 字體，共 36 組：無水平溢出；回饋位於儲存操作區，內容在視窗內、單一 alert，儲存／取消可捲動取得。
- 冒險錯誤的定位按鈕以鍵盤 Enter 啟動後，焦點移至已展開的物品名稱 INPUT。
- 已視覺檢查冒險操作區截圖：提示自然換行，位於儲存上方，不遮擋最後欄位；回饋使用 Material error container 色彩。
- 瀏覽器安全區與真實手機鍵盤的行為仍依既有環境安全區樣式；Chromium 視窗縮放不代表三星實機、非零安全區或實際鍵盤測試。

## 建置與檢查

使用者依截圖釐清後，已移除整張永久性魔法物品資源卡及其數量／減少欄位和自動計算摘要；保留物品明細。舊紀錄更正提示放入物品明細區，歷史減少資料仍保留。此 UI 調整已通過前端 production build 與 OpenSpec strict 驗證。

使用者補充角色看板應保留靈魂幣總量後，已恢復原有資源格與手機四項資源 2×2 排列。數值沿用後端由倉庫 SOUL_COIN／CONSUMABLE 剩餘 quantity 加總的角色回應；庫存異動通知會重新取得角色資料。角色看板回歸測試驗證通知後總量由 3 更新為 2，1 項測試通過；前端 production build、本 change strict 驗證及 10 項主規格驗證通過。未新增角色手填數量欄位。

最終結果記錄於 tasks.md。未 commit、push、發布或操作正式資料庫。

## 靈魂幣獨立標記追加驗證

- 依使用者最終決定，冒險及倉庫消耗品提供獨立「靈魂幣」勾選框，不帶入或清除其他欄位，不新增充能模型；分類只保留九種原有選項。清單及詳情顯示靈魂幣標籤，HUD 保留枚數。
- V27 將舊 SOUL_COIN 分類改為 true 標記並清為 NULL，僅正規化制式舊名稱，保留自訂名稱、稀有度、數量、來源、備註及關聯。V25／V26 未修改，V27 未套用正式資料庫。
- 前端 17 檔／93 項測試通過；production build 成功，原冒險 SCSS 37 bytes 警告仍存在。後端 clean package 成功，66 項測試通過；追加庫存標記 CRUD／歷史獨立回歸後，隔離 PostgreSQL 15 項測試再次通過。
- PostgreSQL 驗證含 V26→V27 轉移守恆、V27 重跑不復原取消標記、欄位保存、舊類別遭拒、永久標記遭拒、冒險明細標記同步、倉庫單獨取消不改歷史、角色回應加總、刪除後改標記重存不補貨。JSON 往返確保鍵名為 isSoulCoin。
- Playwright 使用本機 Chrome／Chromium 核心及模擬 API，驗證 24 組（2 表單 × 3 寬度 × 2 主題 × 2 字級）：勾選框只存在消耗品、空白鍵可切換、其他欄位不改、無水平溢出；已檢視勾選框截圖。清單及詳情各有兩個標籤，1／2 枚合計為 3。此結果不代表三星真機驗證。
- 查核 [PostgreSQL ALTER TABLE 文件](https://www.postgresql.org/docs/current/ddl-alter.html) 與 [Supabase minor release 變更](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)；本次只使用一般 Boolean 欄位與 CHECK，未更動擴充套件、索引或正式設定。

## 最終排版檢視（2026-10-11）

本輪依現有 SRS 手機密度與 M3 skill 檢視本次 UI 改動，沿用標題／短文字新增入口同行、排序獨立一列、Material 勾選框、既有表面／文字／錯誤色彩與字級角色。

- 休整期資源欄位由三欄改為兩欄，手機維持單欄；「若物品有減少請至倉庫手動移除」沿用輔助文字樣式。
- 永久物品獲得來源欄位使用完整可用寬度；冒險消耗品的靈魂幣勾選移到備註前，與同調及倉庫表單順序一致。
- 倉庫靈魂幣剩餘總量獨立放在標題／操作列下，避免被新增入口擠成直欄；手機新增入口使用既有短文字「新增」。詳情歷史總量使用次要文字及穩定間距。HUD 保留五項、手機等級加 2×2 資源排列。
- 角色／倉庫表單的儲存與取消按鈕可隨文字增高，大字時換列；錯誤定位按鈕也可增高換行，錯誤文字使用共享字級角色。永久物品結算標題自然換行，避免被卡片裁切。
- 登入手機容器沿用固定內容邊距，避免大字模式的 rem 外距壓縮 Google 按鈕；註冊提示與連結自然換列。Google 產生的內部樣式未覆寫。

驗證環境為本機 Chrome、模擬角色／冒險／倉庫 API。五個頁面各驗證 320／360／390／768／1440 CSS 像素、雙主題與 100%／200% 根字級，共 100 組，涵蓋角色 HUD、三種表單錯誤與定位、清單及詳情總量／標籤、結算標題、按鈕文字高度；未發現水平溢出或受檢文字／操作裁切。倉庫分頁於切換動畫完成後量測，排除非作用中頁面。登入頁另 20 組使用實際 GIS 產生的按鈕，只驗證容納與排版，未點擊登入或選擇 Google 帳號。

已檢視手機／桌機、雙主題及大字的前後截圖。50 組受檢文字／背景對比（HUD 標籤、錯誤及定位、總量與休整期提示）最低 5:1。根字級模擬不等同作業系統字體、頁面縮放、三星實機鍵盤或非零安全區驗證；原真機待辦保持未勾選。

| M3 自評項目 | 分數（0–2） | 依據／範圍 |
|---|---|---|
| 任務清楚 | 2 | 沿用新增與儲存入口、錯誤提供定位 |
| 資訊層級 | 2 | 勾選在備註前、總量與輔助提示有一致層級 |
| 元件語意 | 2 | 沿用 Material checkbox／button、標籤與 alert |
| Token 一致 | 2 | 既有表面、文字、error container 與字級角色 |
| 自適應 | 1 | 本機 120 組通過，真機鍵盤與安全區仍待驗證 |
| 狀態與回饋 | 2 | 三表單錯誤持續顯示、取消／儲存／定位可達 |
| 無障礙 | 1 | 本輪對比、文字、焦點與既有鍵盤驗證通過；未宣稱完整真機或讀屏認證 |
| 表現克制 | 2 | 沿用既有密度與元件，不增加裝飾容器或動畫 |

最終 `npm test -- --watch=false`：17 檔／93 項通過。`npm run build` 成功；冒險表單與倉庫清單 SCSS 分別超過 10kB 警告門檻 53／96 bytes，均未達錯誤門檻。本輪只有前端排版與驗證文件調整，未重跑後端或操作正式資料庫。

### 倉庫重複總量移除

使用者再依截圖確認，目前剩餘數量只需在頂部角色 HUD 追蹤。已移除倉庫標題下的靈魂幣總量及對應未使用計算／樣式，保留清單物品筆數、各物品標籤、勾選功能與冒險歷史取得總量。此項覆蓋上述倉庫獨立總量列的呈現決定；已同步 SRS、設計與主／delta 規格。`npm run build`、change strict、10 項主規格與 `git diff --check` 通過；移除樣式後倉庫 SCSS 預算警告消失，僅保留冒險表單 53 bytes 的警告。此為單純移除唯讀顯示，未新增或重跑行為測試。

### 倉庫搜尋區留白修正

桌機分頁底線貼住搜尋框的原因是既有分頁群組外距位於整個內容下方，只有全域手機樣式補了搜尋區頂部留白。本次將搜尋面板頂部 16px、搜尋與篩選 12px 間距統一放入倉庫元件樣式，移除全域手機重複設定；永久物品與消耗品共用同一搜尋模板，留白不依賴額外總量文字。此呈現規則已同步 SRS 與主／delta 規格。

Chrome 搭配模擬 API 檢查兩個分頁 × 320／360／390／768／1440 CSS px × 雙主題 × 100%／200% 根字級，共 40 組：分頁至搜尋最小 16px、搜尋列至展開篩選最小 12px，無水平溢出；搜尋結果正確，Enter 清除恢復原清單，手機展開／收合正常。已檢視桌機兩分頁及手機深色截圖。Production build、本 change strict、10 項主規格驗證通過；僅保留既有冒險表單 SCSS 53 bytes 警告。此為樣式修正，未新增單元測試或重跑後端，未宣稱三星真機驗證。

### 每日登入確認與本機儲存盤點

AuthService 的背景 `/auth/me` 確認改用 24 小時間隔，由啟動與受保護頁面導航共用 localStorage 的 userId／checkedAt 紀錄。登入成功即記錄確認，登出清除紀錄。已有使用者的暫時網路／5xx 失敗仍保存本次嘗試時間，避免每次重開重送；沒有快取使用者時不以時間紀錄阻止帳號資料恢復。無效、未來時間或其他帳號的紀錄不採用。啟動確認排入 microtask，避免與 HTTP interceptor 的 AuthService 注入形成循環。

本機 JWT 過期及 API 401 保持即時，後端每個請求仍由 JwtAuthenticationFilter 驗證 JWT 並由服務驗證所有權。登出／登入取消舊帳號的背景確認及暱稱更新請求，401 interceptor 只處理目前 Token 的本站 API 回應，避免舊請求登出新帳號。每日限制只適用背景帳號確認，並非將資料讀取或儲存延遲一天；其他裝置修改的帳號顯示資訊最多到下次確認才更新。現有選單測試改為獨立模擬登入狀態，避免無效的測試 Token 被啟動檢查登出；實際過期／401 行為由新增 AuthService 測試覆蓋。

新增 AuthService 17 項測試通過；完整 `npm test -- --watch=false`：18 個測試檔、110 項通過。`npm run build` 成功，保留既有冒險表單 SCSS 超出 10kB 警告門檻 53 bytes，未達錯誤門檻。change strict、10 項主規格及 `git diff --check` 通過。本輪未改後端或資料庫，未重跑後端驗證；既有三星真機待辦維持未完成。

| 範圍 | 目前行為 | 可考慮的本機儲存 |
|---|---|---|
| 主題、冒險／倉庫排序 | localStorage 已持久化 | 其他純介面偏好可沿用；搜尋篩選目前為前端暫存狀態 |
| 搜尋、篩選、排序與表單輸入／結算預覽 | 前端記憶體及 Signals／FormGroup，不逐次傳雲端 | 可保存搜尋／分頁偏好；未儲存草稿是優先選項，依帳號、角色與紀錄隔離 |
| 角色、冒險列表及預設值、倉庫列表 | RequestCache 記憶體快取；修改後失效，重開需重新讀取；冒險詳情與子快照仍直接 GET | 可用 IndexedDB 保存已讀副本，標示更新時間、提供刷新，資料變更後同步失效，不沿用登入的一天間隔 |
| JS／CSS／圖片／字型 | 正式 PWA 的 assetGroups 快取，沒有 API dataGroups | 現有靜態快取可繼續使用；開啟程式不等於可離線讀寫個人資料 |
| 正式儲存、刪除、使用物品及跨裝置同步 | API 與雲端 PostgreSQL，後端交易更新角色資源及歷史／庫存 | 建議維持雲端作為正式資料來源；離線寫入需另外規劃待同步狀態、衝突與防重複，不能把本機成功視為雲端成功 |

較大的結構化草稿／讀取副本適合 [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)，小型偏好可沿用 localStorage。本輪只完成登入確認頻率與盤點，沒有實作新草稿、永久資料快取或離線同步，也未操作正式環境。

## Google OAuth 資安與效能再審查（2026-10-16，修正前檢查點）

本輪為查核，未再變更應用程式。功能測試通過不等於資安或容量驗收完成；下列問題尚未修正，不能將目前候選修改視為已排除安全／效能風險。

| 項目 | 證據及風險 | 建議處理 |
| --- | --- | --- |
| 高：Google 身分與密碼復原規則不一致（既有共用流程） | `OAuthService.findAndSyncExistingUser` 清除已綁定 Google 帳號的本機密碼，但 `AuthService.forgotPassword`／`resetPassword` 不檢查 provider 或原本是否有密碼；有效重設憑證可替無密碼帳號建立密碼。本機隔離 probe 已確認後者。若 Google 使用非 Gmail／Workspace Email，該信箱後來易主，新持有人可藉本站密碼復原取得原帳號；這是條件式攻擊路徑，並非已發生入侵。 | 明確決定 Google 綁定帳號的密碼復原政策；若維持 Google 身分登入，忘記密碼、舊重設憑證驗證及實際重設須一致阻止重新建立密碼，保留一般回覆避免洩漏帳號資訊。不能僅修改寄信入口。 |
| 中高：外部驗證占用資料庫交易，缺少 OAuth 入口資源限制（既有交易結構仍存在） | `AuthService.loginOAuth` 與 `OAuthService.processOAuthLogin` 均有交易註解。以同樣 Spring transaction interceptor／JDBC transaction manager 的隔離 probe 確認，進入 provider 驗證前已取得 DB connection；冷公鑰快取或 Discord HTTP 交換會在此期間持有連線。解析後 Google HTTP client 2.0.0 的預設 connect/read timeout 各為 20 秒，現有程式未覆寫；`/oauth`、`/oauth/register` 未接既有跨執行個體限流，`OAuthLoginRequest.tokenOrCode` 無長度上限。並行等待外部服務時有連線池耗盡風險，尚未做容量／正式壓測。 | 將外部身分驗證移至取得 DB connection 前，僅帳號查詢／異動保留原子交易；設定外部請求 timeout／retry 上限，沿用共用限流機制保護 OAuth 入口並限制憑證長度。 |
| 中：新增通用 verifier 的快取政策與 Google 指引不同 | 實際解析版本為 google-oauth-client 1.36.0；`IdTokenVerifier` 以 `expireAfterWrite(1, HOURS)` 快取公鑰，並不依回應 `Cache-Control` 計算期限。隔離 probe 讀取實際 verifier 的 cache TTL 為 3,600 秒。這不表示可繞過簽章，但在公鑰有效期／輪替與固定快取期限不一致時，可能暫時拒絕合法登入；目前的重用測試只證明兩次驗證不重抓，沒有驗證輪替。 | 優先評估同一依賴中、Google 官方 Java 指南使用的非 deprecated `GoogleIdTokenVerifier.verify(GoogleIdToken)` overload 與 `GooglePublicKeysManager`，以回應的快取期限管理 Google 公鑰，補公鑰到期／更新及失敗路徑檢查。Beta 標註不能視為淘汰。 |

已確認的防護：Google 簽章、audience、issuer、有效期及必要 claims 驗證在帳號查詢／建立前完成；以 provider + subject 查詢綁定，不以 Email 自動連結既有帳號。註冊 proof 與 access JWT 用途分離、10 分鐘效期、只在前端記憶體承接；整合測試涵蓋 proof 不得存取受保護 API、取消前不建帳號、重複／並行確認僅一筆成功及失敗整包回滾。Discord callback 驗證隨機 state 後交換單次 code，Google 不走該 code callback。Google credential 不送入 URL 或應用日誌，前端不持久保存 Google credential。這些證據不代表已完成全站 XSS／滲透／容量測試。

隔離 probe 使用現有編譯類別、Mockito、Spring transaction interceptor 及模擬 JDBC connection，未使用真實帳號、憑證、資料庫或外部驗證服務。結果：

```text
password_reset_can_create_password_for_passwordless_user=true
db_connection_acquired_before_provider_verification=true
verifier_fixed_cache_ttl_seconds=3600
```

`mvnw.cmd dependency:tree` 確認本次 Google library 關聯版本；以 OSV query API 核對 google-api-client 2.9.1、google-oauth-client 1.36.0、google-http-client／gson adapter／apache-v2 adapter 2.0.0、Guava 33.1.0-jre、Gson 2.13.2，7 項查詢未回傳已知漏洞。這僅涵蓋列出的套件版本，未宣稱完整供應鏈掃描或不存在尚未公開漏洞。先前前端 228 項、後端認證 43 項測試結果可沿用於未改動的應用程式；這輪新增的是上述隔離 probe 及依賴查核。

依據：

- [Google ID token verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token?hl=en)：簽章／audience／issuer／有效期、Cache-Control、sub 身分，以及非 Gmail／Workspace Email 所有權限制。
- [google-oauth-client 1.36.0 IdTokenVerifier](https://github.com/googleapis/google-oauth-java-client/blob/v1.36.0/google-oauth-client/src/main/java/com/google/api/client/auth/openidconnect/IdTokenVerifier.java)：固定一小時快取、固定 Google 公鑰 URL 及 HTTP 重試行為；未依 token 中的 URL 下載公鑰。
- [google-http-client 2.0.0 HttpRequest](https://github.com/googleapis/google-http-java-client/blob/v2.0.0/google-http-client/src/main/java/com/google/api/client/http/HttpRequest.java)：預設 connect/read timeout。
- [GoogleIdTokenVerifier 2.9.1](https://github.com/googleapis/google-api-java-client/blob/v2.9.1/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GoogleIdTokenVerifier.java)、[GooglePublicKeysManager 2.9.1](https://github.com/googleapis/google-api-java-client/blob/v2.9.1/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GooglePublicKeysManager.java)：目前可用的 Google 專用驗證 overload 及依 Cache-Control／Age 計算公鑰期限。
- [Spring DataSourceTransactionManager](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)：交易的 connection 綁定與 lazy connection 行為；[Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)：authorization code／state／redirect URI 的用途。
- [OSV](https://osv.dev/)／`https://api.osv.dev/v1/query`：上述套件與版本的已知漏洞查詢。

## Google OAuth 風險修正（2026-10-16）

修正前檢查點列出的三項問題已處理：

- **Google 密碼復原**：Google 綁定帳號不再寄送本機密碼重設信；驗證與重設端點都重新查核 Google 綁定，因此既發的 token 也不能建立密碼。一般密碼帳號及 Discord 帳號的密碼重設維持原行為。隔離 PostgreSQL 整合測試驗證綁定後不新增信件／token，且資料庫中的密碼仍為 NULL。
- **OAuth 資源與交易邊界**：`/oauth` 和 `/oauth/register` 使用既有 PostgreSQL 共享限流，按來源每 15 分鐘 60 次，超限回 429／`Retry-After`。`provider` 最多 16 字元、`tokenOrCode` 最多 8,192 字元、`redirectUri` 最多 2,048 字元。Google／Discord 網路驗證先完成，之後 `OAuthAccountService` 才開啟短交易查找或同步帳號；登入沒有外層交易。Google key fetch 沿用 Google HTTP client 目前 20 秒 connect/read 預設，Discord HTTP connect/read 設為 5 秒。整合測試在 verifier 中斷言交易未啟動，並在帳號查找時斷言交易啟動。
- **Google key cache**：改用官方文件採用的 `GoogleIdTokenVerifier.verify(GoogleIdToken)` 與 `GooglePublicKeysManager`，由 library 依 Google `Cache-Control: max-age` 與 `Age` 管理期限。保留 audience、issuer、exp、iat、sub、email_verified 及真實 RSA 簽章驗證；無效憑證及 key 服務失敗仍拒絕登入，不記錄 token。

驗證：`backend/./mvnw.cmd clean package` 成功；全後端 **159 項測試通過，0 failure、0 error、0 skipped**，包含 27 項 Google token 檢查、10 項 OAuthService 測試、10 項隔離 PostgreSQL Auth 整合測試，以及限流／密碼復原回歸。Package 建置成功。`openspec validate fix-mobile-login-and-item-accounting --strict`、`openspec validate --specs` 與 `git diff --check` 另外執行確認。

快取測試用 Google library 的 `GooglePublicKeysManager` 解析實際 `Cache-Control`／`Age` 欄位，並以本機 RSA 簽章測試 verifier 在新 key 發布後接受新簽章；未對 Google 公鑰 endpoint 發真實請求，也未完整模擬實際 HTTP 快取逾期下載週期。Google HTTP library 的 key fetch 目前仍用其 20 秒預設 timeout；交易已不跨越該等待，但未做正式流量／連線池壓測。未跑全站滲透測試；未部署、操作正式資料庫、commit 或 push。Samsung Internet 點帳號跳 Gmail 仍照使用者決定列入延期追蹤。

依據：[Google ID token server verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token?hl=en)、[GoogleIdTokenVerifier v2.9.1](https://github.com/googleapis/google-api-java-client/blob/v2.9.1/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GoogleIdTokenVerifier.java)、[GooglePublicKeysManager v2.9.1](https://github.com/googleapis/google-api-java-client/blob/v2.9.1/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GooglePublicKeysManager.java)、[Google HTTP request timeout behavior v2.0.0](https://github.com/googleapis/google-http-java-client/blob/v2.0.0/google-http-client/src/main/java/com/google/api/client/http/javanet/NetHttpRequest.java)。

## Ponytail review 修正（2026-10-16）

前面記載 IdTokenVerifier.verifyOrThrow() 的段落為歷史檢查點，已由「Google OAuth 風險修正」段落的 GoogleIdTokenVerifier.verify(GoogleIdToken) 方案取代；SRS 與設計文件同步為目前 API。

OAuth 登入／註冊新增 JSON 解析前的 64 KiB 本體限制，最多讀取上限加 1 byte 後拒絕；不依賴 Content-Length，超限使用既有錯誤格式回傳 413。保留 DTO 欄位長度與共享來源限流。

公鑰測試保留同一 verifier 與 mock key manager，更新其回傳 key 後驗證新簽章可用且舊 key 簽章遭拒。mock 每次取得 key 都照實計數，不再把自行模擬的計數當成快取重用證據。現有 Cache-Control／Age 測試僅涵蓋 library 的期限解析；沒有模擬真實 HTTP 快取到期與重新下載，不宣稱已完整驗證該週期。

驗證：backend/./mvnw.cmd clean package 通過，163 項測試、0 failures、0 errors、0 skipped，包含 10 項 AuthController 測試、27 項 Google token 測試與 10 項隔離資料庫認證整合測試。OpenSpec 本 change strict、13 項主規格及 git diff --check 通過；既有 mobile-pwa 重複 delta 的封存 INFO 提示仍在。這次沒有前端變更，未重跑前端；未操作正式環境或部署。

請求解析前擴充點依據：[Spring RequestBodyAdvice](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/RequestBodyAdvice.html)。

## 公鑰 HTTP 快取生命週期驗證（2026-10-16）

本節補足前述未模擬 HTTP 快取到期下載的限制。GoogleTokenVerificationTest 改以綁定 127.0.0.1 隨機 port 的 JDK HTTP server 提供真正 X.509 PEM 憑證，使用 NetHttpTransport、GooglePublicKeysManager 及 GoogleIdTokenVerifier 走實際下載、憑證解析、RSA 驗簽及 OAuthService 登入流程。key manager 與 verifier 在每個情境中均維持同一實例，不 mock HTTP transport、快取或 key manager。

測試以 JDK keytool 在 JUnit 暫存目錄產生兩組 RSA key／憑證；私鑰不寫入 repository，JUnit 結束時清理暫存檔。只推進 key manager 的測試時鐘，token 有效期仍使用實際時間，避免把 token 過期誤當成公鑰更新失敗。原本反射呼叫 library 私有期限解析方法的測試已由 HTTP 行為驗證取代。

| 情境 | 實際結果 |
| --- | --- |
| 首次驗簽 | 下載 A 憑證一次並成功；max-age=1200、Age=120，期限為測試時鐘加 1080 秒 |
| 快取重用 | 經過 779.999 秒後，伺服器雖已改提供 B，A token 仍成功，下載累計維持 1 次 |
| 提前刷新 | 780.001 秒時進入 library 的到期前五分鐘刷新區間，B token 成功，A token 遭拒；下載累計 2 次 |
| 已過期刷新 | 獨立情境推進至 1080.001 秒，B token 成功、A token 遭拒，下載累計同為 2 次 |
| 刷新失敗及恢復 | 首次 A 成功後推進至快取過期，公鑰伺服器回 503，原本成功的 A token 也遭拒且沒有帳號資料操作；伺服器恢復並提供 B 後重試成功，下載累計依序為 1、2、3 次 |

執行 backend/./mvnw.cmd -Dtest=GoogleTokenVerificationTest test：27 項通過，0 failures、0 errors、0 skipped，包含上述 3 個 HTTP 測試案例。OpenSpec change strict 與 git diff --check 通過，保留原有 mobile-pwa 重複 delta 的封存 INFO。這次只調整測試及驗證紀錄，未重跑全後端 package 或前端，未操作正式環境或部署。

依據：[GooglePublicKeysManager v2.9.1 原始碼](https://github.com/googleapis/google-api-java-client/blob/v2.9.1/google-api-client/src/main/java/com/google/api/client/googleapis/auth/oauth2/GooglePublicKeysManager.java)。涵蓋本機真實 HTTP 下載及快取生命週期；沒有呼叫 Google 正式 endpoint，未驗證正式環境的 DNS、TLS、對外連線或 Google 實際 key 發布。

## 本機 Google OAuth 設定補正（2026-10-16）

使用者本機登入收到「Google 登入尚未完成設定」。LocalDevLauncher 固定啟用 dev profile，但原本只有前端 environment.ts 提供 dndadvlog-local 的公開 client ID，後端僅從 GOOGLE_CLIENT_ID 環境變數取值；未設定時，在驗簽前即拒絕。新增 application-dev.properties，將開發 client ID 對齊前端；正式 prod 仍由環境變數提供其 client ID。未載入 application-local.properties，也未改動資料庫隔離或其他本機機密設定。

LocalOAuthConfigurationTest 透過 Spring ConfigData 載入驗證 dev client ID 與前端一致，以及 prod 使用明確的 GOOGLE_CLIENT_ID 設定。執行 backend/./mvnw.cmd -Dtest=LocalOAuthConfigurationTest,GoogleTokenVerificationTest test，29 項通過（0 failures、0 errors、0 skipped）；git diff --check 通過。README 已補充設定來源。既有執行中的後端需重啟才會載入；未替使用者停止暫存資料庫程序，以免清除其目前測試資料。真實 Google 帳號登入待使用者重啟後確認，未操作正式環境。

## Discord 開發環境設定（2026-10-17）

使用者提供開發用 Discord Application ID 後，frontend environment.ts 與 backend application-dev.properties 已對齊。dev profile 透過 Spring 的 optional:file:./.env.local[.properties] 載入 backend 工作目錄的私人設定；建立的空白範本只含 DISCORD_CLIENT_SECRET 欄位及說明，已確認符合 .gitignore，未追蹤且不位於打包資源目錄。也可使用既有同名環境變數。正式 profile 與前端 production Client ID 不變。README 記錄 Secret 填寫方式與 http://localhost:4200/auth/callback/discord 的登記要求。

缺少 Discord client ID 或 Secret 時，OAuthService 在對 Discord 發出 HTTP 請求之前即回覆「Discord 登入尚未完成設定，請聯絡管理者」，不查找或變更帳號。設定測試檢查 Google／Discord 開發 Client ID 與前端一致、prod 仍從其變數讀取，以及 Discord Secret 的 placeholder 解析；服務測試覆蓋未設定 Secret 時沒有 HTTP／帳號操作。

驗證：首次測試使用 VS Code 增量編譯產物時發生 Unresolved compilation problems（Flexible Constructor Bodies source level），執行乾淨重編譯後排除。backend/./mvnw.cmd clean -Dtest=LocalOAuthConfigurationTest,OAuthServiceTest,GoogleTokenVerificationTest test：42 項通過，0 failures、0 errors、0 skipped。前端登入及 callback 兩個測試檔共 16 項通過；git diff --check 與 OpenSpec change strict 通過。未重跑完整後端 package 或前端 production build。

真實 Secret 尚待使用者在本機填入，Discord Portal 的 callback 登記與真實登入仍未驗收；未停止現有暫存資料庫程序，未操作正式環境或部署。配置依據：[Spring Boot ConfigData imports](https://docs.spring.io/spring-boot/reference/features/external-config.html#importing-additional-data)。

後續驗收（2026-10-17）：本機重啟輸出確認 dev profile、隔離 PostgreSQL migration 及 Tomcat 8080 成功啟動；使用者其後確認真實 Discord 帳號登入成功。開發 OAuth 登入已有實際成功結果；首次暱稱註冊與再次登入未分別取得回報，不擴大宣稱全部情境完成。正式環境尚未部署或驗收。

## v2.1.2 發布前驗證（2026-10-17）

前後端產品版號同步為 2.1.2。完整前端 36 檔／228 項測試及 production build 通過；後端 clean package 共 168 項測試通過，無失敗、錯誤或略過。主規格 13 項、本 change strict 與 git diff --check 通過。保留既有 heic2any CommonJS 建置警告及 mobile-pwa 重複 delta 的封存 INFO；本 change 尚有延期真機項目，未封存。本次沒有新增或改寫 migration，schema 與前版程式相容。README 的開發設定說明已精簡；私人 Secret、附件與操作紀錄不納入提交。正式部署結果另外驗收，不以本機測試取代。
