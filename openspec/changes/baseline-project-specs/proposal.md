# Proposal

## Why

既有 SRS、User Stories、資料庫手冊與早期計畫混有不同時期的規則，部分敘述互相矛盾，亦與目前程式不一致。建立有來源、可驗收的 OpenSpec 規格基線，先與使用者解決業務衝突，作為後續總翻新的依據。

## What Changes

- 盤點現有文件，將有效需求按能力整理為 requirement / scenario；記錄原始章節及對應實作。
- 在本 change 保存第一輪草案與待決策清單。未決問題不採用隱含預設，也不宣稱完整規格已完成。
- 逐項討論衝突，把使用者明確決策及其驗收案例寫入對應規格。
- 定稿時建立文件導覽與責任分工，將已被取代的敘述標示為歷史，避免新舊規格同時充當權威。
- 將「現況」、「期望規則」、「未驗證」分開；現有 bug 不自動成為正式規格。

## Capabilities

### New Capabilities

以下是首次建立規格的既有產品能力，不代表本次新增這些產品功能。

- `identity-access`: 註冊、登入、密碼重設、個人資料及資料所有權。
- `character-management`: 角色基本資料、職業配置、列表與刪除。
- `adventure-log`: 冒險紀錄、資源結算、故事獎勵與休整期活動。
- `inventory-provenance`: 倉庫、歷史獲得快照與來源關聯。
- `state-consistency`: 完整儲存、讀取失敗防護、快取失效及 HUD 更新。
- `mobile-pwa`: 安裝、手機排版、安全區與離線範圍。
- `legal-presentation`: 公開聲明頁、雙語頁腳與註冊提示的呈現行為。

### Modified Capabilities

無。盤點時 `openspec/specs/` 尚無規格。

## Impact

本階段產出為規格與決策紀錄；不代表產品程式已完成重構或修正。原文件保留至衝突解決及來源對照完成。後續修正需依已確認規格建立具體任務與驗證，不執行資料庫變更、部署、commit 或 push。

涉及的既有來源：根目錄七份 Markdown、`frontend/README.md`、`backend/HELP.md`、Git 指引與程式中相對應的 DTO、Service、Mapper、前端表單、路由及 PWA 設定。詳細覆蓋範圍與缺檔見 `review.md`。
