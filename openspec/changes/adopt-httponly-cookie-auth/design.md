# Design

## Context

動機見 proposal.md。已查核的實作與限制：

- Spring Boot 4.1／Spring Security 7；`JwtAuthenticationFilter` 只讀 Bearer header，每次驗簽後透過 `users.token_version` 與啟用狀態查核撤銷。JWT 已有 `sessionId`，續期沿用原 sessionId／版本。
- Angular 22 的 `AuthService` 用 localStorage JWT 做恢復、期限判斷、跨分頁同步及晚到回應隔離；guard、interceptor、登入／OAuth 測試直接依賴此契約。每日帳號確認與前景續期是兩種不同流程。
- 正式前端由 Firebase Hosting 的 `/api/**` rewrite 轉送至 Cloud Run；Firebase 只轉送 `__session` Cookie。本機使用 Angular 同來源 `/api` proxy，需另以濾除其他 Cookie 的 fixture 模擬正式邊界。
- PWA 使用 Angular `ngsw-worker.js`；`ngsw-config.json` 只快取應用資源，沒有 API dataGroup。本機已讀副本與草稿由 `LocalStore` 依帳號管理，不能當成認證來源。
- `renew-login-on-activity` 與 `revoke-jwt-on-password-reset` 已完成但未封存；本 change 接續其行為，只替換已改變的認證傳輸契約。工作區的匯出功能修改（含 CORS 的 Content-Disposition）與本規劃共存，不重寫。

## Goals / Non-Goals

**Goals:** 本站登入 JWT 不進入頁面可讀儲存或回應；所有狀態異動需通過 CSRF；Cookie 更換時仍保留原有帳號隔離與續期一致性。

**Non-Goals:** 不新增 BFF 服務、refresh token 系統、資料庫 session／黑名單、第三方 OAuth 流程重寫或新套件；不改兩小時滾動效期、不另增絕對最長登入期限、不新增全裝置登出。這些選項不因儲存位置調整而擴成本次範圍。

## Decisions

### 1. 保留 JWT，只由伺服器設定登入 Cookie

沿用目前簽章、token_version 與逐請求查核，讓 Cookie 處理集中在認證邊界。不要將內部簽發結果的 JWT 欄位直接序列化；對外 DTO 與內部簽發結果分開，避免用前端自行丟棄 token 的方式假裝隔離。

| Cookie | 正式設定 | 本機 dev 設定 |
| --- | --- | --- |
| 登入 | `__session`；HttpOnly、Secure、SameSite=Lax、Path=/、無 Domain | `aladvlog-session-dev`；HttpOnly、SameSite=Lax、Path=/、無 Domain；僅明確 dev profile 可停用 Secure |
| CSRF | `__Host-aladvlog-xsrf`；可由 JS 讀取、Secure、SameSite=Lax、Path=/、無 Domain | `aladvlog-xsrf-dev`；可由 JS 讀取、SameSite=Lax、Path=/、無 Domain |

登入 Cookie 的 Max-Age 取 JWT 剩餘秒數，登入及成功續期重新設定；刪除時用相同 name/path/security 屬性與 Max-Age=0。正式 Secure 由 prod 設定強制，不依未確認的代理 scheme 自動降級。CSRF Cookie 不含登入 JWT 或可授權 API 的秘密；其中是 purpose=csrf 的簽章 token。

新 JWT 加上簽章保護的 `transport=cookie-v1`，必須有合法 sessionId、tokenVersion 與 access purpose。Cookie filter 不接受缺少此標記的舊 JWT；因此攻擊者也不能把舊 localStorage JWT 手動改放 Cookie header 繼續使用。只讀命名的登入 Cookie，拒絕重複／歧義 Cookie；不提供 Bearer、query、body 或註冊 proof 作為替代認證來源。登入回應、URL、localStorage、sessionStorage、IndexedDB、Cache Storage、日誌與錯誤回應都不得出現本站登入 JWT。

替代方案：把 JWT 放入 Cookie 又保留 Bearer 相容，會留下舊憑證通道；改成資料庫 session 會擴大資料模型與撤銷行為。本次採單一 Cookie 通道與一次重新登入。

### 2. 明確的 API 契約與前端登入中繼資料

`session` 是非憑證資料：`{ id, issuedAt, expiresAt }`，時間使用明確的 UTC ISO 8601，id 對應已驗證 JWT 的 sessionId。它不含 tokenVersion／JWT，無法單獨認證或續期。

| API | 對外結果／Cookie 行為 |
| --- | --- |
| GET `/api/auth/csrf` | 匿名可用；初始化 CSRF Cookie，204；不回傳登入 JWT，不延長登入 |
| POST login／register／已綁定 oauth／oauth-register | 成功後設定登入 Cookie、輪替 CSRF，回 `{ user, session }`；失敗不覆寫登入 Cookie |
| POST oauth，需自選暱稱 | 維持 `{ registrationRequired: true, registrationToken }`；proof 只留記憶體，不建立登入 Cookie |
| GET `/api/auth/me` | 有效 Cookie 回 `{ user, session }`；可用於無本機資料的初始化；不續期、不設定登入 Cookie |
| PUT `/api/auth/me` | 沿用現有使用者資料回應，不更換登入 Cookie |
| POST `/api/auth/renew` | 由已驗證 Cookie 的原 claims 續期並設定 Cookie，回 `{ session }`；不從 header 取 JWT，不用最新帳號版本取代原版本 |
| POST `/api/auth/logout` | 通過 CSRF 後刪除本站登入 Cookie 並輪替 CSRF，204；Cookie 已過期／不存在也可完成清除 |

認證、CSRF 與 session 回應一律 `Cache-Control: no-store`；不得由 CDN、HTTP cache、Angular Worker 或本機已讀副本快取、重播。Firebase／其他代理必須保留 Set-Cookie／no-store，不記錄 Cookie header 或 response token。

前端只保存使用者、session 中繼資料與原有每日檢查時間。用 `session.id` 加本機變更世代替代 JWT 字串作為請求歸屬快照；本機中繼資料永遠不能使伺服器放行請求。移除 JWT 解碼、Bearer 注入及儲存邏輯。中繼資料存在且未到期時可延續現有離線唯讀行為；線上 API 仍每次驗證 Cookie。資料缺少／損壞時，由一次共用 GET me 恢復，guard 等待這次初始化；沒有本機登入資料且完全離線時不猜測登入有效。

### 3. 使用 Spring CSRF 與 Angular 既有 XSRF 支援

移除全域 csrf.disable 與 Sonar S4502 註記；使用 Spring Security 7 CsrfFilter、延遲載入及明確 header handler，搭配 SignedCsrfTokenRepository。簽章由既有 JWT library 與金鑰提供，以 purpose=csrf、隨機 jti、兩小時期限及登入 sessionId 綁定，與 access／registration proof 嚴格分開。未登入 token 綁定 anonymous；登入後與登出後分別換成新登入／anonymous 綁定。同登入續期保留 sessionId，所以原 CSRF token 仍有效。只驗證簽章有效而已過期的登入 Cookie sessionId 供登出綁定，不因此授予 API 認證。

後端驗證 X-XSRF-TOKEN 的簽章、用途、期限及 Cookie sessionId；不讀取可讀 CSRF Cookie 作為驗證來源，因 Firebase 不會轉送它。普通 GET 不建立或輪替 CSRF Cookie，只有 GET csrf 與成功登入／登出設定它。維持無 HttpSession、無執行個體記憶體 token，Cloud Run 不需黏著工作階段；所有執行個體使用同一份已部署簽章金鑰。

Angular 以 withXsrfConfiguration 讀取獨立 CSRF Cookie，在同來源的 POST／PUT／PATCH／DELETE 加入 `X-XSRF-TOKEN`。第一次異動前共用一次 CSRF 初始化；成功登入／登出輪替後確保下一次異動取得新 token。自訂 JWT 登入沒有內建表單登入的 success handler，因此需在認證端點明確執行 Cookie 輪替與初始化，不假設框架會自動處理。

CSRF 驗證涵蓋匿名登入／註冊／忘記密碼／重設密碼、OAuth API、續期、登出與所有業務異動；`permitAll` 不等於 CSRF 豁免，不能忽略 `/api/**` 或 `/api/auth/**`。GET／HEAD／OPTIONS 維持不做業務寫入；Discord 的前端 GET callback 仍驗證 state，再以有 CSRF 的本站 POST 交換 code，Google GIS 流程不改。

缺少／錯誤 CSRF 一律在業務執行前回 403 與機器可辨的 `CSRF_INVALID`，不執行儲存、發信、註冊或續期。客戶端重新取得 CSRF 並保留輸入，要求使用者再次提交；不自動重播業務寫入，也不把此 403 當成登入失效。對來源不符的寫入額外以允許的精確 Origin 驗證；沒有 Origin 時仍必須提供有效 CSRF token。SameSite 是附加防線，不替代 token 驗證。

### 4. 同來源呼叫與環境隔離

正式沿用 `/api`；dev 也改為 `/api` 並由 Angular dev proxy 明確轉送至本機 127.0.0.1:8080，涵蓋 `/api/**`。這樣沿用 Angular 的同來源 XSRF 與預設 Cookie 行為，避免自製跨站憑證攔截器及到處加 withCredentials。OAuth redirect URL 仍是瀏覽器前端 origin，不改成 proxy target。

CORS 不允許任意 credentialed origin；prod 移除無條件 localhost wildcard，僅允許部署明確設定的第一方 origin；dev 只允許明確本機來源。保留現有 Content-Disposition 等必要 header；如仍經跨來源路徑，允許清單需包含 X-XSRF-TOKEN、X-Session-Id 及既有時間戳 header，且不得把此路徑當成預設瀏覽器登入入口。

### 5. Cookie 更新必須串行，資料請求必須綁定原登入

JavaScript 丟棄舊回應無法撤銷瀏覽器已套用的 Set-Cookie。使用瀏覽器原生 Web Locks 的同來源共用鎖，串行化 CSRF 初始化／輪替、登入、註冊、OAuth 完成、續期及登出；一般資料讀寫不排入此鎖。

- 等待鎖後重新核對目前 session／登出標記；同一登入的續期在所有分頁共用最新核發時間，滿十分鐘才送出。鎖持有至 HTTP 完整完成或確定中止及中繼資料提交；不以 Observable 取消訂閱後立刻放鎖，不使用 keepalive、sendBeacon 或 unload 認證寫入。
- 登出意圖先跨分頁標記並隱藏本機帳號、清除已讀副本、停止續期，排在進行中的 Cookie 請求之後完成伺服器清除。新的登入排在清除之後；舊排隊工作核對失敗即取消，不能把舊續期放在新登入後送出。
- Cookie／中繼資料更新中斷時，下次在線上的初始化或持鎖操作先以 GET me 對齊真實 Cookie；不可只相信最後一次本機寫入。非認證端點的 401／403／409 不回傳刪除登入 Cookie 的 Set-Cookie，避免普通晚到錯誤清除新登入。
- 同一持鎖操作內的 CSRF 初始化不得再次取得同一鎖；401 攔截器只標記本機失效與排定後續清除，不在原 HTTP 完成前等待另一個持鎖登出，避免巢狀等待造成死鎖。
- 既有目標是現代 HTTPS 瀏覽器與 localhost 安全環境；實作需在 Chrome／Edge、Samsung Internet、Safari 驗證 Web Locks。功能不可用時暫停 Cookie 認證異動並顯示可理解的升級提示，不能退回不具互斥保證的 localStorage 假鎖或把 JWT 存回頁面；現有離線副本規則仍適用。

所有受保護資料請求、PUT me 與 renew 都帶非憑證的 `X-Session-Id`，由攔截器在發送意圖建立時捕捉；後端在進入業務前核對 Cookie 的已驗證 sessionId。沒有／不符時回 409 `AUTH_SESSION_CHANGED`，禁止以自動切換後的 Cookie 執行舊帳號意圖。GET me 初始化與匿名認證端點不要求此 header。這是請求歸屬前置條件，不能替代 Cookie 認證、CSRF 或既有資料所有權驗證。

前端以目前 session 快照處理 401，續期同 id 仍接受真正撤銷；不同登入的舊 401 不登出新登入。409 AUTH_SESSION_CHANGED 走身分重新對齊與舊請求失效，不當成資料時間戳衝突，不自動重送寫入。不改動正常業務 403／404／409 的既有語意。

### 6. 登出、離線與跨分頁

登出先隱藏本機身分並沿用 `LocalStore` 的副本清除／草稿保留規則，再持鎖 POST logout。離線或清除暫時失敗時保存「待完成登出」的非憑證標記，顯示伺服器登出尚待連線；不宣稱 Cookie 已清除，不在重開時以 me 自動恢復該登入。恢復連線後先處理待登出，再允許新登入／恢復／續期，成功後清除標記並同步所有分頁。

登出只清除目前瀏覽器的登入 Cookie，不透過遞增 token_version 把其他裝置一起登出，也不宣稱已撤銷外部取得的 JWT 副本。重設密碼及停用帳號仍依現有逐請求版本機制生效。

同登入續期只更新 session 時間，不更動本機資料 owner、不清快取、不觸發草稿切換、不重設每日確認時間。新 session（含同帳號重新登入）才使舊請求世代失效；跨分頁以現有 storage 事件同步中繼資料與登出意圖，不廣播任何 JWT。離線恢復時不自動提交草稿。

### 7. Service Worker 方案評估

使用者提供的文章提出主頁登入後以 postMessage 將 JWT 存入 Worker 記憶體，再由 Worker 加上 Bearer。這能隔離一般頁面直接讀取 Worker 變數，但其範例的 JWT 仍先經主頁登入回應，不能保證已在執行的惡意腳本無法攔截；惡意頁面腳本也仍可要求已登入操作。

Worker 可被瀏覽器停止並以空記憶體重啟；把憑證改存 IndexedDB／Cache Storage 又會回到頁面可讀的儲存。要穩定保留登入，仍須增加憑證恢復通道與生命週期協調。本專案還需與 Angular Worker 的 fetch、安裝及更新共存，會增加維護與回歸範圍，並不直接消除後端 csrf.disable 的 CodeQL 告警。

因此本次採 Cookie＋CSRF；現有 Angular Worker 繼續負責應用資源快取與更新，不保管登入 JWT、不攔截注入認證、不快取 auth／csrf／renew／logout API。首次造訪 Worker 尚未啟用、Worker 被停止或套用 PWA 更新後，Cookie 認證都應正常運作。Cookie 亦無法阻止 XSS 在受害頁面直接操作 API；此設計降低的是憑證被讀出並帶走重用的風險。

參考（查閱於 2026-10-20；OAuth 文件的 Worker 隔離分析僅用來評估該替代方案，不把本站 JWT 誤認為第三方 OAuth access token）：

- [Firebase Hosting：只轉送 __session Cookie](https://firebase.google.com/docs/hosting/manage-cache#using_cookies)

- [使用者提供的 Service Worker 文章](https://codelove.tw/@tony/post/xL08Px)
- [MDN：Worker 記憶體與生命週期](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope)
- [IETF：Service Worker token 儲存的隔離限制](https://datatracker.ietf.org/doc/html/rfc10017#section-8.2)
- [Angular：擴充既有 Service Worker](https://angular.dev/ecosystem/service-workers/custom-service-worker-scripts)
- [Angular：HttpClient XSRF](https://angular.dev/best-practices/security#httpclient-xsrf-csrf-security)
- [Spring Security：SPA CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [MDN：跨分頁 Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

## Risks / Trade-offs

- Cookie 由瀏覽器自動送出，過去 Bearer 不自動附帶的條件不再成立 → CSRF 與來源驗證必須和 Cookie 同批上線，不留僅關閉告警的空窗。
- 登入／登出期間更換共用 Cookie 可能影響其他分頁 → 持鎖、session 前置條件、晚到回應與真實瀏覽器多分頁測試一起驗收，不能只測前端 signal。
- 本機中繼資料可能與 Cookie 不符，完全離線無法問伺服器 → 只延用未到期的同帳號唯讀狀態；線上以 me／401 校正，不以本機資料授權。
- Web Locks 暫缺與離線登出清除失敗 → 依上述能力檢查／待登出標記處理，不悄悄降低互斥或恢復已登出身分。
- JWT 滾動續期及 Cookie 清除不是每次登入的伺服器撤銷 → 保留既有風險邊界，不宣稱 HttpOnly 可以消滅 XSS 或撤銷被複製的有效 JWT。
- Cache/CDN 若忽略 no-store 或重播 Set-Cookie 可破壞身分隔離 → 以實際代理回應與 Worker cache 驗收，未查核正式設定時不宣稱已生效。

## Migration Plan

1. 實作及隔離驗證通過後，先由既有 CI/CD 發布新前端，再啟用後端 Cookie-only＋CSRF 契約；可有短暫要求重試／重新登入的窗口，不為相容舊版持續接受 Bearer 或關閉 CSRF。
2. 新前端在使用舊資料前移除 `dnd_auth_token` 及舊認證中繼資料；使已讀副本失效但保留依 owner 隔離的草稿，不做 JWT 轉 Cookie。重新登入同帳號後依現有規則恢復草稿。舊 PWA 先使用既有更新入口取得新版；後端 CSRF 錯誤訊息需提示舊版使用者檢查網站更新。
3. 新前端遇尚未更新的舊後端時，CSRF 初始化端點不可用就顯示安全登入更新中，禁止 fallback 寫入 localStorage JWT；兩端完成後重新登入一次。新後端直接拒絕未帶 cookie-v1 標記的舊憑證，即使被人手動放進 Cookie。
4. 驗收新增登入回應不含 JWT、Cookie flags、缺少／錯誤 CSRF 的零副作用、所有登入來源、續期／登出與多分頁、密碼重設撤銷、PWA 更新及離線副本／草稿；由 CodeQL 下一次掃描確認告警不再出現，不手動 dismiss 代替修正。同步規格時以本 change 的新 Cookie 契約為最後版本，避免日後封存較舊的已完成認證 change 時再次覆蓋成 Bearer 相容；本次不代為封存舊 change。
5. 本次規劃不執行發布。若未來需要回退，前後端需一起評估並清除新 Cookie；退回 Bearer/localStorage 與 csrf.disable 是安全性倒退，不能默默作為自動回退方案。既有 JWT 簽章金鑰與資料表不需變更。
