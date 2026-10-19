# Tasks

## 1. 後端 Cookie 認證與 API 契約

- [x] 1.1 在既有認證邊界集中設定／清除 Cookie 與 prod/dev 屬性；以後端測試核對 HttpOnly、Secure、SameSite、Path、無 Domain、Max-Age、重複 Cookie 拒絕及到期清除。
- [x] 1.2 調整 JwtTokenProvider、JwtAuthenticationFilter 與已驗證 principal／claims，簽發並要求 cookie-v1 傳輸標記、sessionId、版本及正確 purpose；以測試證明 Cookie-only、舊 JWT 改放 Cookie／Bearer／註冊 proof 均不能認證，原版本撤銷及 503 行為保留。
- [x] 1.3 將內部 JWT 簽發結果與公開 AuthResponse 分離，更新四種成功登入／註冊路徑、GET me、renew；以序列化與 API 測試證明只回 user/session、UTC 時間正確、不含 JWT 或 tokenVersion，待註冊 proof 仍只限定原用途。
- [x] 1.4 新增匿名 CSRF 初始化與 CSRF 保護的冪等 POST logout；驗證 Cookie 已過期仍可清除、登入／續期才更新登入 Cookie、普通 401／403／409 不清除 Cookie，且所有認證回應 no-store。

## 2. CSRF 與原登入前置條件

- [x] 2.1 以現有 Spring Security 7 CsrfFilter 及簽章 CSRF repository 啟用 CSRF，移除 csrf.disable 與 S4502 註記，整合自訂登入／登出後的 CSRF 輪替；透過真實 GET csrf→可讀 Cookie→簽章 header 握手，模擬 Firebase 只轉送 __session，測試有效／缺少／錯誤 token 及跨執行個體驗證，不只以 mock csrf helper 放行。
- [x] 2.2 對公開認證 POST 及所有業務異動保留 CSRF，加入精確 Origin 邊界與一致的 CSRF_INVALID 回應；測試惡意來源、有 Cookie 但無 token、錯誤 token 均零註冊／寄信／儲存／續期副作用，合法業務 403／404 不被誤分類。
- [x] 2.3 在進入受保護業務前核對 X-Session-Id 與已驗證 Cookie，明確排除初始化 GET me 及匿名認證路由；測試 A 意圖搭配 B Cookie、缺少 header 回 AUTH_SESSION_CHANGED／409、同 session 續期可通過，角色所有權與時間戳衝突驗證仍有效。

## 3. Angular Cookie／XSRF 接線與本機環境

- [x] 3.1 設定 Angular XSRF Cookie 名稱／header 與共用的首次初始化，更新 interceptor 移除 Bearer 注入並限制只處理本站 API；以 HttpClient 測試證明正確附加 CSRF／session header、第三方請求不洩漏資料、403 CSRF 不自動重播寫入。
- [x] 3.2 將 dev apiUrl 改為 `/api` 並接上僅轉送本機後端的 Angular proxy，收斂 prod/dev CORS、保留 Content-Disposition 與時間戳 header；用本機 GET csrf、登入、異動及匯出驗證同來源 Cookie 生效，proxy 不可回退正式 API。
- [x] 3.3 更新認證 models、AuthService、guard、app 登出呼叫端與 OAuth 呼叫端，以 user/session metadata 取代 JWT 讀寫／解碼；驗證共用初始化、Cookie 有效而本機資料缺少時可恢復、24 小時確認節流、暫時失敗及到期行為。

## 4. Cookie 寫入競態、續期與登出

- [x] 4.1 在 AuthService 的認證異動入口使用同來源 Web Lock，等待 Cookie HTTP 完成及中繼資料提交後才釋放；以兩分頁時序測試登入／續期／登出互斥、等待後重查 session、過時工作不執行、CSRF 初始化及 401 不產生巢狀鎖死鎖，能力缺少時顯示安全的升級提示而非使用假鎖。
- [x] 4.2 保留前景事件續期、十分鐘節流、一分鐘失敗退避，跨分頁共用最新核發時間；以時序測試驗證只更新 Cookie/session、不清草稿／快取、不重設每日確認、背景／離線／過期／撤銷不續期。
- [x] 4.3 實作即時本機登出、伺服器清除、跨分頁待登出標記與恢復連線後清除順序；測試離線登出重開不復活、未完成清除前不恢復或新登入、成功後同步分頁且不撤銷其他裝置。
- [x] 4.4 依 session id 與世代判斷晚到讀取／profile／401，處理 AUTH_SESSION_CHANGED 及中斷後的 Cookie 對齊；驗證同登入真正 401 仍登出、新登入不被舊 401 影響、舊請求不以新帳號重送，已讀副本／草稿隔離沿用 LocalStore。

## 5. 舊版切換與 PWA

- [x] 5.1 加入一次舊認證資料移除，舊已讀副本失效且保留原 owner 草稿；以升級 fixture 驗證 dnd_auth_token 消失、不轉成 Cookie、同帳號重新登入可恢復草稿。
- [x] 5.2 接入版本暫不一致及舊 PWA 的更新／重試提示；驗證新前端遇舊後端不保存 JWT，舊客戶端缺 CSRF 不被放行，既有更新前保存草稿流程仍正常。
- [x] 5.3 驗證 Angular Worker 不處理登入 JWT、不將 auth/CSRF/renew/logout 加入 API 快取；檢查代理 Set-Cookie／no-store 直通，並以首次造訪、Worker 停止／更新及離線重開確認登入不依賴 Worker 記憶體。

## 6. 整合驗證與文件

- [x] 6.1 更新 AuthFlowIntegrationTest、AuthControllerTest、JwtTokenProviderTest 與其他 Bearer fixtures；在隔離 PostgreSQL 執行相關後端測試，覆蓋密碼／Google／Discord、暱稱註冊、密碼重設回滾／撤銷、停用、限流、續期、受保護資料及匯出，維持既有交易與錯誤語意。
- [x] 6.2 更新 auth.service、login、oauth-callback、oauth-register-dialog 等受契約影響的前端 fixtures；執行認證／guard／interceptor 及資料一致性相關測試與 build，確認無遺留讀取本站 JWT 或注入 Bearer 的 production 呼叫端。
- [x] 6.3 以可用真實瀏覽器和隔離帳號重現兩分頁延遲續期→登出→重新登入及請求送出前換帳號；確認實際 Cookie jar 與 UI 最終身分一致。記錄 Chrome／Edge 的結果及 Samsung Internet／Safari 可取得的實機結果／未涵蓋部分，另核對 Web Locks 相容性；不把單元測試當成 Cookie race 的完整驗證。
- [x] 6.4 同步主 identity-access 規格與 system-requirements-spec.md 的 Cookie、CSRF、API、續期及部署切換契約，核對既有完成但未封存 change 的覆蓋順序；不自動封存舊 change。交付 verification.md 對照本 delta scenarios、命令結果與未涵蓋環境，並通過 openspec validate adopt-httponly-cookie-auth --strict。
- [ ] 6.5 在後續獲授權的 CI/CD 交付中確認前後端切換、正式 Cookie／no-store／來源設定及 CodeQL 不再命中全域 CSRF 停用；留下掃描與瀏覽器證據後才宣稱告警已修正，不以手動 dismiss 代替，也不手動下部署指令。
