# Tasks

## 1. 登入撤銷

- [x] 1.1 新增可重複執行的 V30、User 與共用密碼版本更新；以既有 V29 升級測試及實際 SQL 驗證預設 0 與原子遞增。
- [x] 1.2 JWT 簽發與逐請求版本驗證，修正所有呼叫端及 Google 清除密碼後的版本；以 token、OAuth 與認證測試驗證。

## 2. 驗證與規格

- [x] 2.1 隔離整合測試涵蓋所有舊 JWT／legacy JWT 撤銷、新登入、其他帳號、個人資料更新、非法版本、資料庫暫時失敗及回滾；執行相關後端測試。
- [x] 2.2 同步 identity-access、SRS 與資料庫文件，記錄實際驗證結果；OpenSpec strict validation 及 diff 檢查通過。
