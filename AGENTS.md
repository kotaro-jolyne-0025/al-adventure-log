# 冒險紀錄表 Web 版：Agent 指引

## 工作原則

- 本工作區的 Codex 對話預設啟用 Ponytail（完整模式）。規則以已安裝的 DietrichGebert/ponytail 官方外掛版本為準，不引用專案內的靜態副本。使用者要求 `stop ponytail` 或 `normal mode` 時停用；指明 `lite`、`full` 或 `ultra` 時切換至指定模式。

- 先依任務讀相關文件，不必通讀索引內所有文件。需求與欄位看 [`system-requirements-spec.md`](system-requirements-spec.md)；資料庫看 [`database-schema.md`](database-schema.md)；進行中的規劃看 `openspec/changes/` 與 `openspec/specs/`。
- 依整段對話判斷任務範圍與既有授權。單純查核不自行擴成實作；已授權的修正可直接繼續。OpenSpec 待辦不會自行擴大本次範圍。只有歧義會影響工作方向時，才向使用者詢問。
- 未獲明確授權，不執行 `git commit`、`git push` 或歷史重寫。
- 不得把帳密、私鑰、Token、資料庫備份或私人操作紀錄放入公開文件或測試資料。

## 開發與資料

- 新增功能或調整跨層業務邏輯時，先用 OpenSpec 規劃，再實作並同步規格。局部修正時，依影響更新相關文件或既有 change。
- Migration 應可重複執行。不得改寫已套用的歷史 migration。
- 修改前，查明受影響的共用邏輯與呼叫端。完成後，按實際影響驗證本次行為及相關既有流程。驗證規模須與風險相稱；交付時說明驗證結果及未涵蓋部分。
- 調整角色、冒險、倉庫及子項目的讀寫、快取或草稿時，遵循 [`openspec/specs/state-consistency/spec.md`](openspec/specs/state-consistency/spec.md) 與 [`database-schema.md`](database-schema.md) 的一致性規則。
- 後端本機開發時，先切換到 `backend/`，再執行 `./mvnw.cmd -Plocal-dev test-compile exec:java` 啟動隔離的暫存資料庫。不要直接執行 `BackendApplication` 或使用 Spring Boot Dashboard。
- Material Design 3 UI/UX 工作先閱讀 `.agents/skills/material-design-3-ui/SKILL.md`，參考文件按需載入。

## 發布與部署

- Git 與發布指令的授權範圍、版號及完成條件依 [`VERSIONING.md`](VERSIONING.md)。同一次工作已有的授權持續有效，不逐步重複詢問。
- 部署由 CI/CD 執行，不手動下部署指令。正式環境變更及部署依使用者指示執行。
- GCP 操作前，先閱讀 `.agents/.gcp-agent-workflow.local.md`，並確認目標帳號、專案、區域與服務。
- 正式網站登入與瀏覽器驗證使用 [`https://aladvlog.com`](https://aladvlog.com)，除非使用者指定其他網域。
