# Spec Delta

## ADDED Requirements

### Requirement: HttpOnly browser authentication cookie
系統 SHALL 只透過 HttpOnly Cookie 保存及交換本站登入憑證，正式環境 MUST 使用 Secure、SameSite=Lax、Path=/、無 Domain 的 host-only `__session` Cookie，以配合 Firebase Hosting 的 Cookie 轉送限制。登入及續期回應 MUST NOT 將本站登入憑證放入 JSON、URL、可由頁面讀取的持久儲存、快取或日誌。Cookie 有效期 SHALL 對齊登入憑證效期，伺服器 MUST NOT 因 Cookie 尚存在而接受已過期憑證；本機 HTTP 例外 SHALL 僅存在於明確的隔離開發設定。本站登入 MUST 在 Service Worker 尚未就緒、被停止或更新時仍可使用。

#### Scenario: 成功登入及重新開啟
- **WHEN** 玩家成功登入並在有效期內重新開啟網站
- **THEN** 瀏覽器保留有效的登入 Cookie，可恢復登入；頁面腳本及登入 JSON 都不能取得本站登入憑證

#### Scenario: 正式 Cookie 安全屬性
- **WHEN** 正式網站成功登入或續期
- **THEN** 登入 Cookie 具有規定屬性，僅經 HTTPS 傳送、不設定 Domain，且不由不安全的請求來源設定降低 Secure 保護

#### Scenario: Firebase Hosting 濾除其他 Cookie
- **WHEN** Firebase Hosting 只把 __session Cookie 與 X-XSRF-TOKEN header 轉送到 Cloud Run
- **THEN** 登入與 CSRF 仍有效；CSRF 須驗證簽章、purpose、期限與原登入 sessionId，不依賴第二顆 Cookie 或單一執行個體記憶體

#### Scenario: 使用其他認證載體
- **WHEN** 請求只有 Authorization Bearer、URL 憑證或本機登入中繼資料而沒有有效登入 Cookie
- **THEN** 不取得認證；受保護 API 拒絕存取，不自動改用其他載體

#### Scenario: 註冊憑證冒充登入 Cookie
- **WHEN** 限定第三方註冊用途的 proof 被放入登入 Cookie
- **THEN** 不授予登入權限，也不能續期

#### Scenario: Worker 重啟與首次造訪
- **WHEN** 使用者首次造訪、Service Worker 被停止或套用 PWA 更新
- **THEN** 登入、Cookie 認證及 CSRF 仍可正常運作，不必等待 Worker 從記憶體恢復憑證

### Requirement: CSRF protected state changing requests
系統 SHALL 對所有會改變狀態的 API 驗證獨立 CSRF token，包含匿名登入、註冊、忘記密碼、重設密碼、第三方登入／註冊、續期、登出及資料異動。Cookie 自動附帶的登入資訊 MUST NOT 單獨通過 CSRF 驗證；有來源資訊的寫入 SHALL 同時符合允許的第一方來源。缺少或不符 token MUST 在業務執行前回傳 403 與可辨識的 CSRF 錯誤，不得發生註冊、寄信、儲存或續期副作用。安全讀取方法 MUST NOT 執行業務異動。CSRF 初始化 SHALL 匿名可用，不延長登入，且不得回傳登入憑證；登入與登出後 SHALL 更新 CSRF token。

#### Scenario: 惡意網站誘導異動
- **WHEN** 跨站請求可能附帶登入 Cookie，但缺少正確 CSRF token 或來源不受允許
- **THEN** 系統在業務執行前拒絕請求，原資料及登入效期維持不變

#### Scenario: 匿名認證操作也需要 CSRF
- **WHEN** 未登入者送出缺少有效 CSRF 的註冊、登入、OAuth、忘記密碼或重設密碼請求
- **THEN** 系統回傳 CSRF 錯誤，不建立帳號、不登入、不寄送郵件、不修改密碼

#### Scenario: 首次合法提交
- **WHEN** 玩家首次開啟網站並提交登入或其他合法異動
- **THEN** 前端先完成共用的 CSRF 初始化，再送出有正確 CSRF 的請求；只有通過驗證後才執行業務

#### Scenario: 多分頁導致 CSRF 已輪替
- **WHEN** 一個分頁的提交使用已被另一分頁登入或登出輪替的舊 CSRF token
- **THEN** 拒絕該次異動，保留目前輸入並更新 CSRF，提示再次提交；不自動重播業務寫入或將此 403 當成登入過期

#### Scenario: 續期與資料儲存
- **WHEN** 有效登入以正確來源、CSRF 與原登入識別送出續期或資料異動
- **THEN** 正常執行既有業務，原資料驗證及所有權限制仍適用

### Requirement: Credential free session metadata
系統 SHALL 只向頁面提供非憑證的登入識別、核發／到期時間及使用者資料，以支援顯示、期限判斷、跨分頁同步及請求歸屬；MUST NOT 回傳 JWT 或帳號撤銷版本。中繼資料 MUST NOT 直接授予 API 權限。缺少本機資料時 SHALL 共用一次伺服器登入狀態讀取，完成前不允許以猜測身分操作受保護功能。認證、CSRF 及登入狀態回應 MUST NOT 被 HTTP、CDN、Service Worker 或離線副本快取重播。

#### Scenario: 本機資料缺少但 Cookie 有效
- **WHEN** 玩家在線上重新開啟網站，本機沒有可用使用者或登入中繼資料，但瀏覽器仍有有效 Cookie
- **THEN** 由一次共用伺服器確認恢復真實登入及到期時間，並讓等待中的受保護導航繼續

#### Scenario: 篡改本機資料
- **WHEN** 使用者修改本機登入識別或到期時間，但 Cookie 不存在、到期或已撤銷
- **THEN** 伺服器仍拒絕受保護請求，不因本機資料授權

#### Scenario: 離線重新開啟
- **WHEN** 裝置離線，但保有未到期的同帳號登入中繼資料與有效已讀副本
- **THEN** 可沿用現有唯讀副本與草稿隔離規則，不開放正式異動、不延長效期；沒有可用登入資料時不猜測 Cookie 有效

### Requirement: Cookie logout completion
系統 SHALL 提供 CSRF 保護的伺服器登出，使用相同 Cookie 範圍清除目前瀏覽器的登入 Cookie，並同步所有分頁。Cookie 已過期或不存在時仍 SHALL 可完成清除。登出意圖 SHALL 立即隱藏本機登入、阻止續期並依既有規則清除已讀副本、保留但隱藏草稿。網路失敗 SHALL 明確保留待完成登出狀態，恢復連線後在任何登入恢復、新登入或續期前完成清除，MUST NOT 悄悄恢復已要求登出的身分。此操作 MUST NOT 撤銷其他裝置的登入。

#### Scenario: 線上登出
- **WHEN** 玩家在線上登出且伺服器確認清除 Cookie
- **THEN** 所有分頁進入未登入狀態，重新整理不恢復登入，原帳號已讀副本被清除，草稿仍隱藏保存

#### Scenario: Cookie 早已到期
- **WHEN** 玩家以有效 CSRF 清除不存在或到期的登入 Cookie
- **THEN** 登出仍可成功完成，不陷入需要先登入才能登出的循環

#### Scenario: 離線登出後重開
- **WHEN** 玩家離線要求登出或伺服器清除暫時失敗，接著重新開啟網站
- **THEN** 維持未登入與待完成登出提示，不由原 Cookie 恢復；恢復連線後先清除，再允許登入

#### Scenario: 其他裝置
- **WHEN** 玩家只在目前瀏覽器登出
- **THEN** 其他瀏覽器或裝置的有效登入不被撤銷，不把本機 Cookie 清除宣稱為全裝置撤銷

### Requirement: Requests remain bound to their originating login
受保護資料讀寫與續期 SHALL 綁定發起意圖時的非憑證登入識別。伺服器 MUST 核對此識別與已驗證 Cookie，缺少或不符時在業務執行前以可辨識的 409 身分變更錯誤拒絕；MUST NOT 自動以新 Cookie 重播舊帳號的意圖。身分初始化讀取及匿名認證操作 SHALL 有明確例外，但不能成為資料讀寫的繞過路徑。原有角色／子資源所有權驗證 MUST 保留。

#### Scenario: 等候發送期間換帳號
- **WHEN** A 的請求已建立，但瀏覽器在發送前已切換成 B 的登入 Cookie
- **THEN** 請求因原登入識別不符而被拒絕，不取得 B 的資料，也不以 B 的身分寫入

#### Scenario: 同登入續期
- **WHEN** 請求建立後同一登入完成續期，Cookie 更新但登入識別相同
- **THEN** 原請求仍可通過登入歸屬核對，不因憑證輪替被當成換帳號

### Requirement: Cookie authentication release transition
切換版本後系統 SHALL 要求舊 localStorage 登入重新認證，並拒絕未限定 Cookie 傳輸的舊登入憑證，即使該憑證被手動放入 Cookie。新前端 SHALL 移除舊登入憑證及失效登入資料，使舊已讀副本失效但保留依帳號隔離的草稿；MUST NOT 將舊憑證複製成 Cookie。前後端版本暫不一致時 SHALL 提示更新或稍後重試，MUST NOT 退回頁面保存 JWT 或停用 CSRF。

#### Scenario: 舊版登入升級
- **WHEN** 玩家從保存 localStorage JWT 的舊版升級
- **THEN** 舊 JWT 被移除並要求重新登入，同帳號重新登入後仍可依原規則找到本機草稿

#### Scenario: 以舊 JWT 手動製造 Cookie
- **WHEN** 請求將舊版核發、缺少 Cookie 傳輸標記的 JWT 放入新登入 Cookie
- **THEN** 系統拒絕認證，不能以變更傳輸位置避開切換限制

#### Scenario: 舊 PWA 或後端尚未完成更新
- **WHEN** 舊 PWA 送出未具備 CSRF 的登入，或新前端無法取得新後端的安全初始化能力
- **THEN** 顯示更新／重試指引，不重新開啟 Bearer 通道、不將 JWT 存回 localStorage、不以停用 CSRF 維持相容

## MODIFIED Requirements

### Requirement: Daily background account confirmation
系統 SHALL 在啟動及受保護頁面導航時，以非憑證的本機登入中繼資料決定是否需要背景確認帳號；已有帳號的自動 `/auth/me` 確認 SHALL 每 24 小時至多一次，重開頁面 SHALL 共用本機檢查紀錄。登入成功 SHALL 視為已確認，登出 SHALL 清除紀錄。沒有快取使用者／登入中繼資料或檢查紀錄無效 SHALL 立即共用一次確認；待完成登出時 MUST NOT 執行身分恢復。暫時網路或伺服器失敗 SHALL 保留已有登入資料並沿用此次檢查時間。實際登入／登出、本機到期判斷及 API 401 處理 MUST NOT 等待每日確認；後端 SHALL 維持每個受保護請求的憑證及所有權驗證。帳號切換及登出 SHALL 取消舊帳號的確認與個人資料更新請求，不讓晚到回應恢復或覆寫目前帳號。

#### Scenario: 同日重開及切換頁面
- **WHEN** 同一帳號持有未到期的登入中繼資料，且在上次確認後未滿 24 小時重新開啟或切換受保護頁面
- **THEN** 使用本機帳號資料，不重複呼叫背景確認；後端仍以真正 Cookie 驗證每次資料請求

#### Scenario: 超過一天
- **WHEN** 上次確認滿 24 小時後玩家重新開啟或前往受保護頁面
- **THEN** 進行一次背景確認，連續導航不重複送出請求

#### Scenario: 暫時離線
- **WHEN** 已有快取帳號的背景確認因網路或 5xx 失敗
- **THEN** 保留登入及輸入，同日重開不反覆送出確認；其他資料請求維持既有錯誤處理

#### Scenario: 即時登出及失效
- **WHEN** 玩家登出、登入中繼資料已到期或目前登入的受保護 API 回傳 401
- **THEN** 立即清除登入與相關快取，不等到下一日，Cookie 清除依伺服器登出規則完成

#### Scenario: 舊帳號回應
- **WHEN** 玩家在背景確認或個人資料更新完成前登出或登入另一帳號
- **THEN** 取消舊請求，舊資料不覆寫新帳號也不恢復登入

### Requirement: Current access credential validation
系統 SHALL 在每次帶 Cookie 登入憑證的請求核對簽章、效期、Cookie 傳輸限定、登入識別、該帳號目前登入版本及啟用狀態，跨後端執行個體立即一致。已撤銷、版本非法、帳號停用或已刪除的憑證 MUST NOT 取得認證。切換前未限定 Cookie 傳輸或缺少必要登入識別／版本的登入憑證 MUST NOT 相容使用；一般個人資料更新 MUST NOT 撤銷登入。

#### Scenario: 相容部署前的登入
- **WHEN** 玩家使用切換前核發且仍未過期的登入憑證，不論放在 Bearer 或新 Cookie
- **THEN** 系統拒絕認證並要求以新版重新登入，不以版本 0 的舊相容規則放行

#### Scenario: 停用、刪除及非法版本
- **WHEN** 憑證的帳號已停用、刪除或登入版本非法
- **THEN** 後端不授予認證，具備其他必要前置條件的受保護 API 回傳 401

#### Scenario: 更新暱稱與第三方登入
- **WHEN** 玩家更新個人資料或再次以已綁定的第三方身分登入
- **THEN** 一般個人資料更新不撤銷登入，第三方登入取得符合目前版本的有效 Cookie 憑證

#### Scenario: 登入狀態暫時無法查核
- **WHEN** 資料庫暫時失敗而無法核對登入版本
- **THEN** 回傳 503 且不授予認證，不將暫時失敗當成憑證撤銷；恢復後原有效憑證仍可使用

### Requirement: Activity based login renewal
系統 SHALL 在玩家於前景點擊、輸入或捲動時自動延長仍有效的 Cookie 登入；同來源分頁 SHALL 共用最新核發時間，使同一登入至多每十分鐘成功續期一次，成功後 Cookie 與登入中繼資料有效期重新起算兩小時。續期失敗的操作重試 SHALL 至少間隔一分鐘。匿名、過期、已撤銷及停用帳號的憑證 MUST NOT 續期；缺少有效 CSRF 或原登入識別也 MUST NOT 延長登入。背景帳號確認 SHALL 維持 24 小時間隔，背景查詢、閒置、離線及待完成登出 MUST NOT 自動延長登入。

#### Scenario: 持續填表
- **WHEN** 玩家在前景持續輸入且距上次登入或續期已滿十分鐘
- **THEN** 系統以單一續期請求延長 Cookie 與中繼資料效期，連續操作不逐次送出請求，不清除草稿或快取

#### Scenario: 分頁閒置或離線
- **WHEN** 玩家沒有操作、分頁在背景或裝置離線
- **THEN** 不以計時器或背景 API 延長登入；過期後須重新登入

#### Scenario: 重設密碼後要求續期
- **WHEN** 玩家持密碼重設前的 Cookie 憑證及有效 CSRF 要求續期
- **THEN** 後端回傳 401，不取得新有效登入；同時發生的續期也不能覆蓋撤銷版本

#### Scenario: 網路或伺服器暫時失敗
- **WHEN** 續期因網路或 5xx 失敗
- **THEN** 保留原有效登入與表單，不立即重試；後續操作可於一分鐘後重試

### Requirement: Renewal preserves login ownership
同一登入的 Cookie 續期 SHALL 保留進行中讀寫、草稿及快取，不視為帳號切換。跨分頁與並行續期 MUST NOT 縮短目前登入期限。設定／刪除登入 Cookie 的認證請求 SHALL 依共同順序完成；登出、換帳號或重新登入後，舊續期、舊 Set-Cookie 及舊請求回應 MUST NOT 恢復登入、覆蓋新登入或使新登入登出，不能僅靠丟棄前端回應宣稱達成。

#### Scenario: 另一分頁續期
- **WHEN** 同一登入在另一分頁成功續期
- **THEN** 本分頁接受較新的登入時間並保留既有請求；較早到期的晚到結果不能縮短效期

#### Scenario: 登出及重新登入後晚到回應
- **WHEN** 舊登入的續期回應或 API 401 與玩家重新登入同時發生
- **THEN** Cookie 寫入順序及請求歸屬確保舊回應不覆蓋 Cookie、不恢復已登出的登入，也不登出新登入

#### Scenario: 續期後舊請求回報撤銷
- **WHEN** 同一登入續期後，先前送出的資料 API 回傳 401
- **THEN** 前端仍處理該登入失效，不因 Cookie 已更換而忽略撤銷

#### Scenario: 多分頁同時續期及登出
- **WHEN** 一個分頁正在續期，另一個分頁要求登出後重新登入
- **THEN** 進行中的 Cookie 請求先結束，再完成清除及新登入；舊排隊續期不在新登入後執行，所有分頁最後只保有新登入
