# Proposal

## Why

`v2.0.1` 即將公開給社群使用，後續更新需要在保護既有玩家資料的前提下，留下可核對的測試、發布與復原依據。現有測試、備份及版本規範已具基礎，但開發資料庫隔離、PR 必要檢查及持續復原驗證尚未形成完整流程。

## What Changes

- 優先建立本機隔離開發與 PR CI，沿用既有 PostgreSQL 17 測試依賴、Angular/Vitest、Maven/Flyway 及備份流程，第一階段不增加常駐雲端資源。
- **BREAKING（僅本機開發流程）**：本機啟動與資料重建必須確認使用受工具管理的隔離資料庫；不再接受將正式資料庫憑證填入本機設定後直接啟動。啟動檢查在任何 Flyway migration 前執行，正式環境 profile 先核對再安排切換。
- 保留 Google 人工登入驗證，採開發專用 OAuth client 與獨立 JWT 金鑰；PR CI 使用既有合成資料與認證測試，不取得正式憑證或自動操作真實 Google 帳號。
- 將前端測試／production build、後端完整測試／package、版本與規格檢查、既有 migration 保護接成固定 PR 檢查；檢查成功後才啟用 `main` 保護。
- 延續 `VERSIONING.md`，補上風險分級、發布前證據、部署後驗證及失敗復原流程。正常維護不再重寫已公布歷史或移動既有 Tag；採每個 PR 一筆 squash commit 維持可讀歷史。
- 補上資料庫變更前的備份時效與還原證據門檻，及每 30 天至少一次的隔離還原驗證。
- 沿用網站聯絡入口及 GitHub Issues，建立版本／步驟／裝置等回報欄位，區分一般問題與涉及私人資料的回報。
- 獨立雲端預備站列為後續決策：需另確認費用、網域、資源與憑證隔離，才建立後續 change；不以共用正式 DB 的測試角色代替環境隔離。

## Capabilities

### New Capabilities

- `development-isolation`：本機、CI 與正式環境的資料／憑證界線，啟動及重建保護，Google 開發登入的驗收要求。
- `release-governance`：PR 必要檢查、單人維護適用的分支保護、風險分級、固定發布基準與部署／復原證據。

### Modified Capabilities

- `database-recovery`：新增備份時效、定期隔離還原及高風險變更的復原證據；沿用既有私有備份與還原要求。

## Impact

- 預計涉及後端開發 profile、`FlywayConfig` 前置保護、測試限定的本機啟動工具、前端開發環境設定、`.github/workflows/`、PR／Issue 範本、README 與 `VERSIONING.md`。
- 需在實作驗證後另行啟用 GitHub `main` 保護及開發 OAuth client；本提案不變更外部服務設定。
- 不新增業務資料欄位、資料庫 migration 或 API 契約，不調整既有 `updated_at`、整包交易、資料所有權、草稿與快取原則。
- 本輪交付為規劃文件；尚未啟動實作、提交、推送或部署。
