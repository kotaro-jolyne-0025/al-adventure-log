# Design

## Context

V3 已部署且測試依賴固定占位 UUID，新增 migration 無法清除舊檔內的憑證。

## Goals / Non-Goals

清理目前內容並提供既有資料庫的受控升級程序；不自動修改正式帳號、推送或重寫 Git 歷史。

## Decisions

V3 移除建立預設帳號的 SQL，保留歷史 migration 檔名與其餘內容。新資料庫由註冊或 OAuth 登入建立帳號；固定 UUID 僅由測試 fixture 建立。既有資料庫只修正已核對的單筆 checksum，不重跑 V3，不刪除、停用或更新使用者、OAuth 綁定與角色資料。測試驗證 migrations 不建立帳號，以及修復 SQL 不改寫既有帳號與角色。

Google 綁定既有 Email 不會清除本機 password_hash；本機密碼登入也不會因 OAuth 綁定而停用。更換 Google 密碼不能取代本網站的密碼處理；本次只檢查程式碼，不推測正式資料庫的密碼狀態、不變更登入政策。

## Risks / Trade-offs

- V3 checksum 改變：部署前備份並安排維護時段，執行明確限定版本與舊 checksum 的 SQL；不可關閉驗證或自動 repair 全部歷史。
- 歷史仍可讀到憑證：先改密碼，再協調重寫及 GitHub 快取清理。

## Migration Plan

更換正式帳號密碼、評估舊 JWT、備份資料庫、暫停舊版本 migration 執行、核對並修復 V3 checksum、由 CI/CD 部署、驗證啟動。回退應用時須一併對齊 V3 checksum。禁止重新執行含 TRUNCATE 的 V3。
