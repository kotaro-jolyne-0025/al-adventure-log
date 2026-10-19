# Verification

驗證日期：2026-10-20。使用本機隔離帳號、暫存資料庫及瀏覽器 profile；沒有操作正式帳號、部署或執行 Git 提交。

## 自動化結果

| 命令（在對應目錄執行） | 結果 |
| --- | --- |
| backend：`./mvnw.cmd -Plocal-dev test -q` | 212 tests，0 failures，0 errors；隔離 PostgreSQL |
| backend：`./mvnw.cmd -Plocal-dev '-Dtest=AuthFlowIntegrationTest,SignedCsrfTokenRepositoryTest' test -q` | 最後訊息調整後重跑 27 tests，全數通過 |
| frontend：`npm test -- --watch=false` | 39 files，238 tests 全數通過 |
| frontend：`npm run build -- --configuration development --optimization --service-worker=ngsw-config.json --output-hashing=all` | 通過，供實際 Worker／瀏覽器驗證使用 |
| frontend：`npm run build` | 正式設定建置通過，含 Angular Worker 產物 |
| `openspec validate adopt-httponly-cookie-auth --strict` | 通過 |
| `git diff --check` | 通過 |

建置原有的 heic2any CommonJS 警告與本次認證調整無關。

## Delta scenarios 對照

| 規格需求 | 已驗證的情境與證據 |
| --- | --- |
| HttpOnly browser authentication cookie | AuthCookieServiceTest 檢查正式 __session 的 HttpOnly、Secure、Lax、Path、無 Domain、到期／刪除；整合測試檢查 Cookie-only，Bearer／舊 JWT／registration proof 不可認證。瀏覽器確認登入 JSON、document.cookie 及 localStorage 沒有登入 JWT，首次造訪與 Worker 停止後可恢復登入。 |
| Firebase Hosting 濾除其他 Cookie | SignedCsrfTokenRepositoryTest 只用登入 Cookie＋簽章 header 驗證，涵蓋不同 repository／provider 實例、期限、用途、不同登入、偽造 token 與過期登入 Cookie 的登出綁定。整合測試及本機代理都移除 __session 以外的 request Cookie，登入、profile、續期、登出通過。 |
| CSRF protected state changing requests | 整合測試對 login/register/oauth/oauth-register/forgot-password/reset-password/renew/logout/PUT me 分別測缺少、錯誤 token 及惡意 Origin；不建立帳號、不寄信、不改密碼／版本、不設定登入 Cookie。合法業務所有權與衝突語意維持；前端測首次初始化、錯誤不自動重播、第三方不帶本站 header。 |
| Credential free session metadata | 前端測共用恢復、每日確認節流、暫時 503 保留登入、缺少 Web Locks 提示；瀏覽器在沒有本機資料／Worker 的新 context，以有效 Cookie 恢復帳號。離線沿用既有 owner 隔離規則，metadata 不授權 API。 |
| Cookie logout completion | 整合測試涵蓋重複、匿名與過期 Cookie 登出及普通錯誤不清 Cookie；瀏覽器測離線登出→離線重開→恢復連線，保持待清除狀態，最後 Cookie 消失且 me 回 401。僅清瀏覽器 Cookie，不遞增帳號撤銷版本。 |
| Requests remain bound to their originating login | 後端對缺少／不同 X-Session-Id 回 409 AUTH_SESSION_CHANGED；瀏覽器將 A 的請求意圖配 B Cookie，實際回 409。相同 session 續期不改歸屬。 |
| Cookie authentication release transition | 前端測舊後端缺 session 契約或 csrf 端點 404 時提示更新，不保存 JWT；後端拒絕舊 client 缺 CSRF 及舊 JWT 放入 Cookie。瀏覽器植入舊 storage fixture 後，舊 JWT／已讀副本移除，同帳號 IndexedDB 草稿保留。 |
| Daily background account confirmation | 前端測共用初始化、24 小時節流、暫時失敗保留、過期處理及舊請求取消；guard 等待恢復。瀏覽器植入中斷標記及不一致 Cookie，重新開啟即與伺服器對齊，不受近期每日確認紀錄阻擋。 |
| Current access credential validation | 後端測每次核對版本／啟用、已刪除／停用／撤銷／用途不符拒絕、資料庫失敗 503、個人資料更新及 Google／Discord 流程。重設密碼回滾與全帳號撤銷原測試通過。 |
| Activity based login renewal | 前端測前景事件、十分鐘節流、一分鐘退避、背景／離線不續期、等鎖後重讀其他分頁核發時間；後端拒絕到期／撤銷登入續期。成功只改 Cookie/session，保留快取、草稿及每日確認時間。 |
| Renewal preserves login ownership | 前端以真正排隊的測試 Web Lock 驗證 renew→logout→login、舊 401 不清新登入。Chrome／Edge 實際延遲 Set-Cookie 回應驗證時序，最後 Cookie jar、伺服器及所有分頁 UI 是同一個新帳號。 |

## 實際瀏覽器

本機 API 代理只轉送 __session，保留 Set-Cookie／no-store／Origin；後端以 local-dev 啟動暫存 PostgreSQL。本機 HTTP 特例停用 Secure，正式 Secure 屬性由後端單元測試核對。

| 瀏覽器 | 版本 | 結果 |
| --- | --- | --- |
| Microsoft Edge（Windows，headless） | 155.0.4283.62 | 下列流程通過 |
| Google Chrome（Windows，headless） | 155.0.8059.85 | 下列流程通過 |
| Safari／iOS Safari | 無可用實機 | 未執行；不可將 Chromium 結果視為 Safari 證據 |
| Samsung Internet | 無可用實機 | 未執行；未以修改 user agent 代替實機 |

實際流程：

1. UI 密碼登入、角色列表、修改暱稱、PDF／Excel 匯出及第二分頁恢復；核對 Cookie scope、HttpOnly 與登入 JWT 不可讀。
2. 代理在後端完成 renew 後扣住 Set-Cookie 回應；另一分頁登出並登入第二帳號。扣住期間沒有 logout/login 被送出；放行後伺服器順序為 renew→logout→login，所有分頁與真正 Cookie 身分相符。
3. 離線登出、離線重開、連線恢復清除，確認不復活；舊 JWT 清除、IndexedDB 草稿保存及舊已讀副本失效。
4. 沒有 Worker 的新 context、停止 Worker 後 reload、Worker 更新檢查；CacheStorage 的 /api/ 項目為 0。
5. 以本機 manifest timestamp 產生新 Angular Worker 應用版本，透過 UI「檢查更新→重新整理以更新→確認」安裝並 reload，登入 session 維持且沒有 API cache。這是本機版本生命週期驗證，不代表正式 CDN 發版切換。既有 DraftUpdateCoordinator／AppUpdateService 測試也通過更新前保存及拒絕不安全 reload 的情境。

瀏覽器腳本與截圖保留在 ignored 的 output/playwright/，不將 Cookie、完整 token、個人紀錄或 profile 加入版本控制。

Web Locks 需要 secure context，持鎖 async callback 完成後才釋放；[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) 記錄跨瀏覽器基線為 2022-03。[MDN 相容性資料](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/LockManager.json) 列出 Chrome 69、Firefox 96、Safari 15.4，Edge／Samsung Internet 為 mirror。支援資訊不能代替未取得的實機驗證；程式仍以 navigator.locks 能力檢查阻止不支援的 Cookie 異動。

## 文件與後續交付

- 主 identity-access 規格已合併完整 delta 情境；SRS、proposal、design 已對齊 Firebase Hosting 的 [Cookie 轉送限制](https://firebase.google.com/docs/hosting/manage-cache#using_cookies)。無 HttpSession／單一實例 token 狀態，不需要 Cloud Run 黏著工作階段。
- renew-login-on-activity 與 revoke-jwt-on-password-reset 保持原狀；之後封存舊 change 不得覆蓋本次 Cookie 契約。本 change 保持開啟；封存時須避免重複加入已同步的 ADDED requirement。
- 正式設定建置、diff 與嚴格規格檢查在本機交付前完成；結果不等同正式流量驗收。
- 任務 6.5 未完成：尚未執行 CI/CD 發布、新 CodeQL 掃描或正式 aladvlog.com 的 Firebase／Cloud Run Cookie、CDN no-store、Origin 與切換窗口驗證，不能宣稱 GitHub 告警已關閉。
- 真正 Google／Discord 供應商瀏覽器授權與寄信送達未執行，由後端整合測試的隔離替身覆蓋。
