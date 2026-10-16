# Development Isolation Spec Delta

## Purpose

定義開發與測試環境的資料、登入及啟動界線，使維護者能完成實際操作與失敗情境驗證，並以可核對的方式確保這些操作不會修改正式玩家資料。

## ADDED Requirements

### Requirement: Isolated development database
開發工具 SHALL 建立及使用工具自行管理的獨立本機資料庫，僅載入版本庫 migration 與合成資料。CI SHALL 使用每次執行獨立的暫時資料庫。一般開發與 CI MUST NOT 使用正式資料庫、備份副本或正式資料庫憑證；正式備份的隔離還原演練依 `database-recovery` 執行，不屬於一般測試。

#### Scenario: 本機完整操作
- **WHEN** 維護者使用支援的本機流程登入、建立角色、儲存或刪除紀錄
- **THEN** 異動僅發生於該次開發工具管理的資料庫，不會送到正式後端或資料庫

#### Scenario: CI 執行整合測試
- **WHEN** PR 執行資料庫相關測試
- **THEN** 使用獨立暫時資料庫與合成帳號，測試結束清理資源，不需要正式環境 Secret

### Requirement: Startup safety before migrations
非正式環境 SHALL 在 migration、初始化及任何寫入前驗證有效資料庫目標與環境模式。連線目標來自正式設定、與開發工具建立的目標不符、存在未明確支援的覆寫或無法辨識時 MUST 中止啟動。正式模式 SHALL 明確指定，不由缺省的本機 profile 推定。

#### Scenario: 舊本機設定仍指向遠端
- **WHEN** 本機設定或環境變數帶入遠端資料庫連線，或嘗試覆寫工具已建立的連線
- **THEN** 在 Flyway 及任何資料庫寫入前停止，僅顯示不含密碼的設定錯誤

#### Scenario: 正式環境明確設定
- **WHEN** 正式部署使用已確認的正式模式與受控憑證
- **THEN** 維持既有 migration 與啟動行為，不因開發保護而套用本機資料重建流程

### Requirement: Scoped development data reset
測試資料的初始化或重建 SHALL 限於目前開發工具持有的隔離資料庫，且不接受任意資料庫 URL 作為重建目標。測試 fixture MUST NOT 寫入正式 migration，不得產生可用的正式帳號、固定正式密碼或通用認證繞過入口。工具 SHALL 明示暫時資料的生命週期與重建影響。

#### Scenario: 重建測試情境
- **WHEN** 維護者明確重建本機測試資料
- **THEN** 僅重建已辨識的隔離資料，正式資料與瀏覽器尚未儲存的草稿不被自動清除

#### Scenario: 非法重建目標
- **WHEN** 重建操作收到非工具管理的資料庫或正式模式
- **THEN** 拒絕操作，不執行刪表、清空或匯入

### Requirement: Separate development authentication
人工本機驗收 SHALL 使用開發專用 Google OAuth client 與獨立網站 JWT 簽章金鑰，允許維護者沿用自己的 Google 帳號，但其本機應用帳號與資料 SHALL 與正式環境分開。正式網頁與受保護 API MUST NOT 接受開發登入憑證；開發網站 MUST NOT 回退使用正式 API。自動化測試 SHALL 使用受控認證 fixture，不要求真實 Google 密碼或瀏覽器登入狀態。

#### Scenario: 同一 Google 帳號驗收
- **WHEN** 維護者以同一 Google 帳號分別登入本機與正式站
- **THEN** 兩邊各自存取所屬資料庫，本機角色、應用 Token 與測試資料不影響正式帳號

#### Scenario: 開發登入設定缺失
- **WHEN** 本機 OAuth client 未設定或前後端設定不一致
- **THEN** 提示需要完成開發設定，不改呼叫正式後端或放寬 Token 驗證

### Requirement: Regression contracts remain intact
隔離環境 SHALL 能驗證既有資料所有權、原始微秒時間戳、整包交易、共享角色資源一致性、草稿保留與快取失效。環境工具 MUST NOT 更改這些業務契約，也不得藉自動取得新版時間戳重送舊輸入，使衝突測試假性通過。

#### Scenario: 兩視窗儲存衝突
- **WHEN** 本機兩視窗以相同原始標記儲存同一紀錄
- **THEN** 僅第一筆成功，另一筆收到可辨識的衝突且保留輸入與草稿
