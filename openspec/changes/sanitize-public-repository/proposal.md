# Proposal

## Why

公開的歷史初始化 migration 含個人帳密，文件使用本機路徑。須清除目前內容並保護既有資料庫升級。

## What Changes

- 移除 V3 預設帳號與憑證；測試自行建立帳號，新資料庫由註冊或 OAuth 登入建立使用者。
- **BREAKING**：既有資料庫部署前須核對並修復單筆 V3 checksum，不能重跑 V3。
- 文件改相對連結，提供事件處理與公開資訊界線。

## Capabilities

### New Capabilities
- `repository-hygiene`: 公開文件與初始化資料的隱私及安全維護要求。

### Modified Capabilities
無。

## Impact

V3、文件、忽略規則與 PostgreSQL 測試；正式帳號改密碼、Git 歷史重寫及發布另行協調。
