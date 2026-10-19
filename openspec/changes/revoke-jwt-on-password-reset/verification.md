# Verification

日期：2026-10-19（Asia/Taipei）。本次只驗證本機原始碼與隔離 PostgreSQL／SMTP，沒有變更正式環境。

## 結果

- 後端全套 `./mvnw.cmd test -q` 通過；新增資料庫暫時失敗處理後，另執行 `./mvnw.cmd -Dtest=AuthFlowIntegrationTest,JwtTokenProviderTest test -q` 通過。目前 28 組測試報告共 195 項，零失敗、零錯誤、零跳過。
- 實際 JWT、BCrypt、Spring Security filter、MyBatis、交易及隔離 PostgreSQL／SMTP 測試確認：重設成功後註冊／登入所得及缺少版本的 legacy JWT 均回傳 401，新密碼登入及其他玩家維持有效。
- 重設被拒絕時保留原登入；在密碼更新後、重設憑證消耗前注入失敗，確認密碼、登入版本及憑證使用狀態一起回滾。
- 版本負數、字串、小數或不符，及帳號停用／刪除均拒絕認證。一般暱稱更新不撤銷登入。
- Google 登入清除舊密碼後，登入版本原子遞增，發出的新 JWT 可用而先前 JWT 失效。
- 登入版本查核遇到資料庫失敗時回傳 503，不放行認證；資料庫恢復後原有效 JWT 仍可使用。
- V29 合成既有資料升級至 V30 後 token_version 預設 0，重複執行新 migration 保留資料；既有應用讀寫相容測試通過。
- OpenSpec change 與 identity-access strict validation、主規格驗證及 git diff whitespace 檢查通過。

## 限制

每個帶 JWT 的請求新增一次使用者主鍵查詢，沒有以快取延遲撤銷。已完成認證的進行中請求不追溯取消；離線裝置在下次線上 API 請求得知失效。

未執行正式 migration、部署、瀏覽器登入或效能壓測；正式生效需經既有 CI/CD 部署並套用 V30。回退至未檢查登入版本的舊程式會失去撤銷保護。
