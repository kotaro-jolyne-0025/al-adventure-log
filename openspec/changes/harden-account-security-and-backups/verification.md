# Verification

## 備份啟用（2026-10-14，Asia/Taipei）

- 備份工作流程已經由 [PR #31](https://github.com/kotaro-jolyne-0025/al-adventure-log/pull/31) 合併；隔離還原 schema 衝突修正由 [PR #32](https://github.com/kotaro-jolyne-0025/al-adventure-log/pull/32) 合併。
- [首次成功備份](https://github.com/kotaro-jolyne-0025/al-adventure-log/actions/runs/38582731261)：設定、OIDC 驗證、私有目的地檢查、資料庫匯出與上傳均成功，已確認備份物件非空。
- [同一份備份的隔離還原](https://github.com/kotaro-jolyne-0025/al-adventure-log/actions/runs/38583561882)：在無網路且未公開連接埠的臨時 PostgreSQL 容器中完整還原、驗證必要資料表與讀取檢查，工作流程成功。
- 備份工作流程已啟用，每日 UTC 03:17（台灣時間 11:17）排程。首次驗證以手動執行完成；下一次排程結果需依實際工作流程紀錄確認。
- 已確認 bucket 私有存取、有限保留、服務帳號所需的 bucket 權限，以及 GitHub 專案固定 ID／main 分支／備份環境限制。私人資源識別、物件路徑及操作細節只保存在本機維運文件。
- YAML、Bash 語法、dump 檔案與容器掛載路徑檢查、PR migration 保護檢查均通過。

## 首次備份發布範圍

首次備份啟用只發布備份與隔離還原流程及其規格；當時帳號安全與限流程式保留在本機，README 另行整理。

## 帳號安全發布驗證（v2.0.1）

- 使用者已授權將帳號安全修正與文字版 README 一併發布；前後端產品版本均為 2.0.1，畫面版本沿用 package.json 綁定。
- 後端 Maven package 通過，98 個測試全部成功；包含第三方 Email 衝突、停用帳號、未驗證 Email、重設密碼日誌保密、Controller 429／Retry-After，以及真實隔離 PostgreSQL 的 migration、跨執行個體限流與冷卻重置。
- 前端 33 個測試檔案、204 個測試全部成功，production build 通過；429 保留原登入狀態且沒有自動重送。既有 heic2any CommonJS 最佳化警告未阻擋建置。
- OpenSpec strict validation、git diff 空白檢查、產品版號一致性、README 的 14 個本機連結及本次修改敏感值掃描均通過。沒有修改已存在的 migration；僅新增 V29 操作資料表。
- 本次本機驗證不登入真實第三方帳號、不寄出測試郵件，也不對正式站進行大量請求。合併後須確認前後端自動部署成功、Cloud Run Ready、V29 套用與限流資料表權限，才建立 Release；正式發布結果以 [v2.0.1 Release](https://github.com/kotaro-jolyne-0025/al-adventure-log/releases/tag/v2.0.1) 為準。
