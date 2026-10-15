# Spec Delta

## ADDED Requirements

### Requirement: Explicit third-party nickname registration
系統 SHALL 在驗證未綁定的 Google／Discord 身分後，要求新玩家自行輸入非空白、最多 100 字元的本站暱稱並確認，才建立帳號、綁定及簽發登入憑證。表單 SHALL 初始空白，第三方名稱 MUST NOT 作為預填或本站名稱保存。已綁定玩家 SHALL 直接登入並保留既有名稱；既有 Email 衝突及停用帳號規則 MUST 維持。

#### Scenario: 新玩家確認暱稱
- **WHEN** 新玩家完成第三方驗證並送出有效的自選暱稱
- **THEN** 系統原子建立單一帳號與綁定，以該暱稱登入；確認前不保存帳號或發放登入權限

#### Scenario: 取消或重新整理
- **WHEN** 玩家關閉暱稱表單或重新整理頁面而未確認
- **THEN** 不建立帳號，玩家可重新進行第三方登入

#### Scenario: 無效暱稱或暫時錯誤
- **WHEN** 暱稱只有空白、超長或完成註冊遇到暫時錯誤
- **THEN** 系統拒絕無效輸入、保留已填內容並提供可理解的修正或重試方式

#### Scenario: 既有第三方玩家登入
- **WHEN** 已綁定玩家再次以 Google 或 Discord 登入
- **THEN** 不要求重新註冊，也不以第三方名稱覆蓋本站暱稱

### Requirement: Restricted pending registration proof
系統 SHALL 使用最長 10 分鐘有效、可驗證且限定註冊用途的暫時憑證承接第三方驗證結果。此憑證 MUST NOT 充當登入憑證或出現在 URL、瀏覽器持久儲存及應用日誌。完成註冊 MUST 重新檢查身分與 Email 可用性，帳號與綁定須在同一交易內建立。重送或並行確認 MUST NOT 建立重複帳號、覆蓋暱稱或自動連結其他既有帳號。

#### Scenario: 過期或遭竄改
- **WHEN** 玩家持過期或遭竄改的暫時憑證確認暱稱
- **THEN** 系統不建立帳號，提示重新登入，保留暱稱供玩家查看

#### Scenario: 暫時憑證嘗試存取資料
- **WHEN** 暫時憑證被作為 Bearer 憑證要求受保護資料
- **THEN** 系統拒絕認證，不授予玩家資料存取權

#### Scenario: 重複或並行註冊
- **WHEN** 同一第三方身分或 Email 已完成註冊，另一份暫時憑證再送出確認
- **THEN** 系統回覆可恢復的衝突訊息，不留下孤立帳號或覆寫既有資料
