# Tasks

## 1. 清理與驗證

- [x] 1.1 移除 V3 預設帳號，測試確認 migrations 不建立使用者，並由測試 fixture 自行建立帳號。
- [x] 1.2 修正文檔連結與忽略規則，掃描確認目前內容不再含已知外洩值。
- [x] 1.3 確認 V3 checksum 維護改由內部程序處理，公開版本庫不保存維運 SQL 或 checksum 細節，並保留既有帳號／資料測試。
- [x] 1.4 執行後端測試與 OpenSpec strict validation，說明 OAuth 與本機密碼獨立，交付正式帳號與歷史清理的待辦事項。

驗證：無預設帳號版本通過 LedgerPersistenceIntegrationTest 10 項測試及 OpenSpec strict validation；目前工作樹未找到原 V3 的三項已知外洩值。正式帳號輪替、資料庫維護及 Git 歷史清理須依內部維運程序另行處理。
