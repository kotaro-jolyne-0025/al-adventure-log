# Tasks

## 1. 手機登入

- [x] 1.1 以已確認的 S26 Ultra 三星瀏覽器，在 Google 帳號選擇畫面點擊帳號重現；記錄實際寄信觸發位置、頻率及是否為 PWA，無法重現時明確保留待驗證狀態。2026-10-16 使用者錄影捕捉 1 次：點擊落在 Google 帳戶 Email 附近後進入 Gmail 空白草稿；錄影為 Samsung Internet 一般分頁（非 PWA），未送出郵件。單次錄影無法估算發生率。
- [ ] 1.2（延期追蹤，使用者決定 2026-10-16）修正 GIS 帳號選擇或個人化按鈕在 Samsung Internet 的相容問題。已於 S26 Ultra／Samsung Internet 30.0.5.24 重現 Android `mailto:` intent 開啟 Gmail；網站同期沒有 `/api/auth/oauth` 請求，已載入選帳 DOM 無 `mailto:` anchor。延後點選曾成功留在網站；觸發來源仍未定位，暫不改 GIS 參數或登入程式。待可在剛出現的選帳頁再次重現並捕捉點擊目標後，再依證據修正並驗證手機登入及真正聯絡入口；保留 OAuth 憑證驗證，修改 GIS 參數前查核官方文件。
- [x] 1.3 完成 Google OAuth 2.0／GIS 串接核對：追蹤前端 callback、loginOAuth、後端 GOOGLE provider、憑證驗證及登入回應；查核 ID token／authorization code 路徑、client ID／audience、issuer、有效期、適用的 origin／redirect URI 與 code exchange／state。參照 Google 官方文件，核對正式配置並驗證真實合法登入及無效、過期、錯誤 audience 憑證遭拒；記錄 Samsung Internet 重現結果但不以修復該瀏覽器問題作為本項完成條件。禁止記錄憑證值。2026-10-16 已比對正式 bundle／Console Web Client、確認正式 origin，使用者依設定清理指引操作後回報 Chrome 無痕 Google 登入正常；無效憑證拒絕由本機回歸測試覆蓋。這不代表本機新版後端已部署或通過正式驗證。

- [x] 1.4 重新審視後端 Google 驗證改動，處理格式破損、缺漏／null 欄位造成的未捕捉例外；使用本機 RSA 金鑰驗證真實簽章及拒絕路徑，補上 API 400／無帳號副作用回歸。後端 43 項測試及打包、前端登入相關 33 項測試通過；正式配置與三星真機問題仍依 1.2／1.3 追蹤。

- [x] 1.5 對齊已約定的 Google ID token 契約：前端 authorization-code callback 僅接受 Discord，Google／未知 provider 在提交 API 前拒絕並保留 Discord state；移除未使用的 Google client-secret 設定，驗證 Google GIS 登入與 Discord callback 及後端認證回歸、建置並同步文件。2026-10-16 完整前端 36 檔／228 項、production build 通過；後端 clean rebuild 後 43 項認證測試與 package 通過。

## 2. 永久魔法物品計數

- [x] 2.1 前端移除冒險與休整期的手填獲得數欄位，依永久明細及來源推導獲得、獨立記錄減少並生成淨值；更新既有表單測試，驗證純消耗品為 0、混合明細、增刪、來源切換、同時獲得與減少及休整活動不重複計數。
- [x] 2.2 後端完整儲存由永久明細推導獲得，排除消耗品並保留減少資訊；同步基本 CRUD 與獨立明細增刪入口。更新既有 AdventureEntrySaveServiceTest／AdventureEntryServiceTest，驗證各入口一致、永久明細名稱與單筆數量校驗、角色永久物品數及總計。
- [x] 2.3 如同時獲得與減少無法由既有淨值還原，加入來源分開的減少數 DTO／Entity／MyBatis／新 migration 欄位；驗證零預設、舊列相容、往返讀寫與同時獲得減少重存一致。
- [x] 2.4 編輯舊紀錄時按永久快照計獲得並提示更正，保留缺失明細與舊減少的可恢復流程；以既有歷史／差額同步測試確認重存不補貨、不增加已刪庫存、不批次重算其他快照。

## 3. 靈魂硬幣消耗品類別

- [x] 3.1 增加 SOUL_COIN enum、前端型別／標籤與消耗品選單，永久表單不提供該值，類型切換清除並提示；驗證冒險及倉庫新增、編輯回填、詳情標籤與使用減一。
- [x] 3.2 新增 Flyway migration 擴充 inventory_item／adventure_gained_item 類別 CHECK 並限制 SOUL_COIN 只能為 CONSUMABLE，所有服務寫入校驗相同組合；隔離 PostgreSQL 驗證重跑、九種舊值與 null、新值讀寫、非法組合及交易回滾，不改已套用 migration。
- [x] 3.3 驗證靈魂硬幣歷史快照、正負差額與庫存消耗規則，使用後只改備註不補貨，永久物品數不變。
- [x] 3.4 新 migration 將舊 soulCoins 正數一次性轉入未關聯冒險的靈魂硬幣消耗品，使用穩定轉移識別防止重複，成功才清零舊值；隔離資料庫驗證零值、正數、已有同類庫存、重跑及失敗回滾，核對逐角色數量守恆。
- [x] 3.5 移除 character-form 靈魂幣輸入，保留 character-shell 靈魂幣資源格並由倉庫剩餘 quantity 加總，角色 API 不再接受直接寫入舊 soulCoins；如保留相容回應則由倉庫計算。驗證新增／編輯角色不新增第二套餘額，舊客戶端提交有明確提示，手機摘要與倉庫數量一致。

- [x] 3.6 靈魂硬幣歷史獲得及目前持有總量各依相應快照／庫存 quantity 加總，允許同一冒險多筆同類明細；驗證同冒險兩筆數量 1、2 合計 3、不同來源及移轉庫存共同加總、使用後持有減少但歷史不變、重存不重複入庫。

## 4. 手機儲存回饋


- [x] 4.1 復用 FormFeedbackComponent，在冒險、角色及物品儲存操作區旁／上方顯示持續錯誤，避免重複 alert，保留欄位定位與輸入；驗證必填、空白明細、資源不足、API 業務錯誤及網路失敗，修正重試後訊息更新。
- [ ] 4.2 以 320／360／390 CSS 像素、短視窗、安全區、雙主題與 200% 字體驗證提示換行、最後欄位與儲存可達、定位展開相關區塊及鍵盤焦點；記錄 UI 驗證結果。

## 5. 整合與交付

- [x] 5.1 執行前端相關測試與 npm run build、後端相關回歸測試與 mvnw clean package，記錄確切結果及未驗證真機項目，不將打包稱為真機驗證。
- [x] 5.2 更新 SRS、database-schema.md 與主規格，對齊永久明細推導及移除新建待補規則；執行 openspec validate fix-mobile-login-and-item-accounting --strict、git diff --check，完成後更新本任務清單，不提交或發布。

## 2026-10-11 驗證結果與保留項目

- [x] 6.1 依使用者截圖釐清，移除整張永久物品資源卡及其數量／減少輸入與獲得摘要，保留物品明細與歷史減少資料；同步規格並驗證前端建置。`npm run build`、OpenSpec strict 驗證及 `git diff --check` 通過。
- [x] 6.2 依使用者釐清恢復角色 HUD 靈魂幣總量，顯示倉庫剩餘 quantity 加總，保留移除角色手填欄位；驗證角色異動通知後總量由 3 更新為 2。角色看板測試、前端 production build、OpenSpec strict 與 10 項主規格驗證通過。
- [x] 6.3 原休整期活動資源變動下方的提示改為「若物品有減少請至倉庫手動移除」。

- 前端：`npm test -- --watch=false` 17 個測試檔、91 項全數通過；`npm run build` 成功。冒險表單 SCSS 超過 10kB 警告門檻 37 bytes，未達建置錯誤門檻。
- 後端：`mvnw.cmd clean package` 成功，63 項測試全數通過；含隔離 PostgreSQL 17.10 的 migration／交易／快照測試。
- 規格：`openspec validate --specs` 10 項通過；本 change strict 驗證與 `git diff --check` 通過。
- 4.2 已完成 Chromium 36 組版面條件（3 表單 × 3 寬度 × 2 主題 × 2 字級）及欄位定位鍵盤檢查；實際手機鍵盤與非零裝置安全區仍保留待驗證，未將縮放模擬視為真機。
- 1.3 已完成程式串接檢視、真實簽章／拒絕路徑測試、正式前端 Client／Console origin 核對及使用者回報的 Chrome 無痕 Google 登入驗證；本機新版後端部署後仍需確認正式登入。1.1 已重現並記錄；1.2 依使用者決定延期追蹤，未宣稱修復。
- 詳見 [verification.md](verification.md)。change 保持進行中，未封存、commit、push 或發布；V26 未套用正式資料庫。

## 7. 靈魂幣獨立標記（取代第 3 節的舊分類設計）

- [x] 7.1 更新規格與設計；新增 V27，轉換舊分類為布林標記，保留資料並驗證重跑及非法類型限制。
- [x] 7.2 更新 Entity／DTO／Mapper／Service，各明細 CRUD 與差額同步保存標記，HUD 按標記加總。
- [x] 7.3 冒險及倉庫消耗品提供勾選框、不預填其他欄位、移除舊分類選項；詳情與清單顯示標籤，名稱統一靈魂幣。
- [x] 7.4 驗證勾選往返、取消不改欄位、多筆加總、歷史獨立、刪除重存不補貨；前後端建置、M3 手機／鍵盤操作、規格同步與檢查。

## 8. 最終排版檢視

- [x] 8.1 檢視本次改動涉及的登入、角色表單／HUD、冒險表單／詳情及倉庫表單／清單；核對既有 M3 欄位順序、提示層級、響應式對齊、雙主題及大字模式，修正具體排版問題並記錄瀏覽器與建置驗證。Chrome 120 組版面條件、50 組文字對比檢查及截圖檢視通過；前端 17 檔／93 項測試、production build 通過，細節見 verification.md。
- [x] 8.2 依使用者截圖移除倉庫標題下的靈魂幣總量，僅保留頂部角色 HUD 追蹤；移除未使用計算與樣式、同步規格並驗證建置。Production build、本 change strict、10 項主規格及 git diff --check 通過。
- [x] 8.3 修正倉庫分頁底線與搜尋框擁擠：將留白統一由搜尋面板管理，檢查兩分頁、手機／桌機、雙主題及大字模式的間距與搜尋／清除操作。40 組 Chrome 檢查、截圖檢視、production build、change strict 與 10 項主規格通過。

## 9. 每日登入狀態確認與本機儲存盤點

- [x] 9.1 背景帳號確認改為每 24 小時一次，啟動／導航共用本機時間紀錄；保留即時登出、JWT 過期及 API 401，取消舊帳號的確認與個人資料更新請求。
- [x] 9.2 驗證重開、24 小時邊界、暫時失敗、缺少快取、帳號切換、登出及過期／401；完成前端測試、建置與規格同步檢查。新增 17 項 AuthService 測試，完整前端 18 檔／110 項通過，production build 通過。
- [x] 9.3 盤點現有本機處理與雲端操作，提出草稿、偏好與持久化讀取快取的適用範圍，不擴大實作離線同步。盤點及建議記錄於 verification.md。

## 10. OAuth 安全與資源限制

- [x] 10.1 同步身份存取規格與設計：Google 綁定帳號不得透過本機密碼重設取得密碼；OAuth 驗證須限制請求大小／頻率、外部驗證不得占用資料庫交易，Google 公鑰快取遵從官方快取時效。
- [x] 10.2 修正忘記密碼、連結驗證與重設：Google 綁定一律不寄送／接受，舊 token 使用時重查綁定；一般密碼帳號與 Discord 流程不變。測試申請、驗證、重設及已核發 token 路徑與不洩漏帳號狀態。
- [x] 10.3 加入 OAuth DTO 長度限制及既有共享限流服務的來源限制；於資料庫交易之外驗證 Google／Discord 身分，僅將資料庫查找與帳號變更放入短交易。驗證 429、過大請求、無慢網路交易持有連線、成功寫入原子性與既有登入回歸。
- [x] 10.4 改用 Google API Client 官方 GoogleIdTokenVerifier／GooglePublicKeysManager 的快取政策，保留嚴格 claims 檢查；測試真實 RSA 簽章、Cache-Control／Age 快取時間解析、輪替後簽章 key、過期／錯誤 key／無效 claims 拒絕及 Google 服務暫時失敗。
- [x] 10.5 更新主身份存取規格及 SRS，記錄驗證結果、限制與未涵蓋項目；執行相關後端測試、套件、OpenSpec strict 與 git diff --check，不部署或提交。

## 11. Ponytail review 修正

- [x] 11.1 OAuth 登入及註冊在 JSON 解析前限制本體為 64 KiB，回傳 413；驗證未宣告 Content-Length 的有界讀取、大小邊界與 Unicode 輸入，保留既有欄位限制與限流。
- [x] 11.2 系統需求及設計文件改為實際使用的 GoogleIdTokenVerifier.verify(GoogleIdToken)，歷史驗證紀錄標明舊 API 已被替換。
- [x] 11.3 同一 verifier／key manager 測試更新後 key 的簽章接受及舊 key 拒絕；移除 mock 模擬快取次數的假象，準確記錄未驗證真實 HTTP 快取到期下載。
- [x] 11.4 以 loopback HTTP、執行時產生的 X.509 憑證及真正 Google verifier／key manager，驗證 Cache-Control／Age、快取重用、提前刷新及逾期換 key、公鑰下載失敗拒絕舊 token 與恢復重試；27 項 Google token 測試通過，限制與下載次數見 verification.md。
- [x] 11.5 補上 dev profile 的開發 Google client ID，與前端 environment.ts 對齊；驗證 Spring 設定載入與 prod 仍使用環境變數，更新本機啟動說明。2 項設定測試與 27 項 Google token 測試通過；真實本機 Google 登入待重啟後由使用者確認。
- [x] 11.6 配置使用者提供的開發用 Discord Application ID，對齊前後端並以 dev-only Spring ConfigData 載入被忽略的 backend/.env.local；缺少 Client Secret 時在 HTTP 呼叫前拒絕並提供明確錯誤。後端 42 項、前端登入／callback 16 項測試通過，未設定真實 Secret 或更動正式 OAuth 設定。
- [ ] 11.7 使用者在本機填入開發用 Discord Client Secret 並確認 localhost callback 登記後，重啟隔離後端，驗證真實 Discord 授權、首次暱稱註冊及再次登入；2026-10-17 已回報真實 Discord 登入成功，首次暱稱註冊與再次登入尚未分別確認，本項保留未完全完成。
