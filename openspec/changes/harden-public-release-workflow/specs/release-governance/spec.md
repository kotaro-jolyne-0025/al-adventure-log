# Release Governance Spec Delta

## Purpose

定義公開服務的變更驗證、合併、部署、版本固定及事故處理要求，使單人維護也能留下具體證據，並維持既有玩家資料與每次發布之間可追溯的關係。

## ADDED Requirements

### Requirement: Required pull request checks
所有 PR SHALL 產生名稱固定且可辨識的前端測試與 production build、後端完整測試與 package、版本／變更規格檢查，以及既有 migration 保護結果。失敗、取消或缺漏的必要檢查 MUST 阻擋合併，不得以略過測試的打包當作測試成功。文件 PR 也 SHALL 有明確結果，不因工作流程路徑篩選而永遠等待。

#### Scenario: 測試失敗
- **WHEN** PR 的任一必要測試、建置或 migration 保護失敗
- **THEN** PR 不可合併至正式主幹，失敗紀錄可連回該次候選版本

#### Scenario: 純文件 PR
- **WHEN** PR 僅更新規劃或文件
- **THEN** 必要檢查完成且結果明確，不要求僅為文件發布而虛增產品版號

### Requirement: Protected and traceable public history
正常變更 SHALL 透過必要檢查通過的 PR 進入 `main`，合併須符合目前基準版本；單人維護 SHALL 可在不要求他人 Approve 的條件下完成此流程。分支保護 SHALL 適用管理者並禁止正常流程中的 force push 與刪除 `main`。公開版本歷史及既有發布 Tag MUST 保持固定，修正 SHALL 使用新提交與新版發布。額外的歷史／權限事故處置 SHALL 另取得具體授權，不從一般發布授權推定。

#### Scenario: 單人維護合併
- **WHEN** 唯一維護者提出 PR 且必要檢查與基準版本條件符合
- **THEN** 可依正常合併流程完成，不要求作者對自己的 PR 作不存在的核准

#### Scenario: 嘗試重寫已公開版本
- **WHEN** 正常開發流程嘗試 force push 主幹或更新／刪除既有版本 Tag
- **THEN** 保護規則拒絕操作，修正以後續提交或新版本處理

### Requirement: Privilege separation for validation
PR 驗證 SHALL 使用唯讀版本庫權限與合成測試設定，不取得正式部署、資料庫、備份或寄信憑證，亦不取得雲端部署身分。需要正式權限的部署與備份 SHALL 使用受正式分支限制的獨立受保護環境或等效雲端信任條件。未受信任的 PR 程式 MUST NOT 在特權事件下執行。

#### Scenario: 公開 fork 提出 PR
- **WHEN** 外部來源的 PR 執行測試
- **THEN** 測試可在無正式 Secret 的情況下完成，PR 程式不能存取正式資源

#### Scenario: 非正式分支要求部署憑證
- **WHEN** PR 或一般工作分支要求正式部署環境
- **THEN** 分支與身分限制阻止其取得憑證或進行部署

### Requirement: Risk based release evidence
每次變更 SHALL 記錄風險分級、影響範圍、相應驗證及復原方式。涉及寫入、登入／授權、私有快取、草稿、資源計算或 migration 時 SHALL 按高風險處理；不確定時採高風險。驗證 SHALL 涵蓋相關失敗情境及既有不變條件，而非僅確認成功操作。

#### Scenario: 高風險儲存修改
- **WHEN** PR 影響主紀錄、子項目、庫存或角色資源
- **THEN** 驗證原始標記衝突、部分失敗全部回滾、跨玩家拒絕及共享資源並行一致性，並提供可核對結果

#### Scenario: UI 文字調整
- **WHEN** 變更只涉及文案或樣式且不改變輸入、登入或儲存行為
- **THEN** 除共同 CI 外，補上相關畫面、行動版與可存取性確認，不增加無關的業務測試

### Requirement: Exact revision deployment and release
發布 SHALL 沿用 `VERSIONING.md` 的同步版號、部署確認及附註 Tag／Release 順序。主幹合併會自動觸發部署時，正式變更前的復原就緒檢查 MUST 在合併前完成；檢查須對應候選 head，head 或相容性範圍改變時 SHALL 重新確認，不等到建立 Release 才檢查。所需前後端部署、檢查與正式驗證 SHALL 對應確切發布 revision；未受影響服務 SHALL 明示不適用及原因。正式瀏覽器驗證 SHALL 優先使用 `https://aladvlog.com` 與 Google 登入，僅進行必要讀取，不以一般玩家資料驗證新增、更新或刪除。所有相關階段完成後才可稱發布完成。

#### Scenario: 部署部分失敗
- **WHEN** 應部署的前後端只有其中一邊成功
- **THEN** 發布維持未完成，先診斷及依既定復原策略處理，不提前建立正式發布結果

#### Scenario: 完成配套發布
- **WHEN** 同一發布 revision 的必要 CI、部署及正式讀取驗證完成
- **THEN** 建立指向該 revision 的固定 Tag 與 Release，保留驗證及部署連結

#### Scenario: 合併前缺少復原證據
- **WHEN** 候選 head 已更新，或應有的變更前備份／還原檢查尚未完成
- **THEN** 發布流程停在合併之前，不讓自動部署先執行正式 migration

### Requirement: Compatible recovery and private incident reporting
涉及資料庫的復原決策 SHALL 先確認舊程式能否讀寫變更後結構與資料；不相容時 SHALL 採向前修復或由維運者執行另行授權的復原程序，不自動回退資料庫。問題回報 SHALL 可記錄畫面版本、裝置、重現步驟、預期及實際結果，私人資料、登入憑證與備份 MUST NOT 要求貼到公開 Issue。

#### Scenario: 結構無法向後相容
- **WHEN** 發布後發現錯誤且舊版程式不相容於目前 schema
- **THEN** 不直接切回舊程式或覆蓋正式 DB，保留故障證據並採已評估的向前修復或授權復原

#### Scenario: 玩家回報私人資料問題
- **WHEN** 問題涉及 Email、Token、帳號識別或其他私人內容
- **THEN** 引導使用既有私人聯絡方式，公開回報只保留去識別的必要資訊
