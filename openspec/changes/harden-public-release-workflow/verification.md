# 公開版本工作流程強化驗證

## 2026-10-23 依賴安全修補整包驗證

- 前端定向覆寫 Vite 至 8.3.5；Angular build 22.2.3 固定的 8.3.0 尚受開發伺服器漏洞影響，穩定版 22.2.4 仍未解除此限制。後續 Angular build 原生使用已修補版本時可移除此覆寫。
- 整合 Spring Boot 4.1.1、JJWT 0.13.0、MyBatis starter 4.1.0 與開發工具更新；產品版號同步 3.0.1，無業務 API 或 migration 變更。
- Windows 隔離環境整包 Maven verify：188 項測試通過、0 失敗、0 略過；使用已發布 v3.0.0 的 mapper 驗證 migration 相容性，正式 JAR 隔離檢查通過。前端 227 項測試與 production build 通過，npm audit 為 0 項漏洞。
- 經 local-dev launcher 啟動完整應用與全新暫存 PostgreSQL；真實 HTTP 驗證登入／續期、角色／冒險／倉庫 CRUD、跨玩家拒絕、缺漏／舊時間戳、完整儲存回滾與並行寫入衝突。瀏覽器確認前端登入、角色讀取、草稿重載／復原與儲存；Vite CSS 熱更新及還原正常。
- 本機未提供 SMTP 認證，總健康檢查的郵件指標為 DOWN；未使用正式寄信憑證。平台 CI 與正式部署結果以本次 PR 為準；本節不代表已完成部署或其他既有待辦。

## 先前工作流程驗證紀錄

最新整理：2026-10-16。以下 2026-10-15 的測試數字為初始工程基準；最新驗收與審查結果見下方「本輪收尾」與「PR 平台驗證及部署」。本輪已透過 PR #36 合併及部署；尚未完成的平台工作仍保留待辦。

2026-10-15，本機成果與正式 profile 前置切換紀錄。沒有執行 Git commit、push、PR、Release 或正式程式部署；Cloud Run 僅依先前明確授權設定 `SPRING_PROFILES_ACTIVE=prod`，並確認新 revision Ready、路由完成及自訂網域 API 回傳預期的未登入 `401`。正式玩家資料未讀寫。

## 已實作與工程驗證

- 本機使用 Maven `local-dev` profile 啟動測試限定的 embedded PostgreSQL；Windows 實際完成 28 個 migration，建立合成登入帳號、角色與冒險紀錄。以 HTTP 登入並讀到一個角色後停止服務，資料庫程序隨之關閉；沒有清除瀏覽器草稿。
- `DatabaseTargetGuard` 在自訂 Flyway 建立前檢查單一明確 profile、有效 JDBC URL、資料庫環境變數覆寫及啟動器持有的精確連線目標。受控測試涵蓋遠端 URL、非授權 loopback URL、環境覆寫、未知／多重 profile、正式模式 loopback，以及目標錯誤時不接觸 DataSource。
- Flyway enabled=false 不呼叫 `migrate()`；enabled=true 呼叫 migration，且目標防護仍先執行。正式 JAR 不含本機啟動器或 embedded PostgreSQL 依賴。
- 前端開發 API 固定使用 localhost，Google／Discord client ID 預設留空；沒有設定時略過第三方登入，不回退正式 client。後端 audience 可由本機環境設定提供；啟動器每次產生新的 JWT 金鑰。JWT 測試驗證本機簽章不能由另一組金鑰驗證。
- README 與 SRS 已記載暫存資料生命週期、本機 OAuth 配對方式及啟動指令。Google 人工登入需先另設開發 OAuth client；實際 Google browser login 尚未驗收。
- PR CI 與 immutable migration workflow 已完成；PR workflow 只讀 repo，未提供正式 Secret 或部署權限。遷移相容性測試從最近發布基準以合成資料升級。

| 驗證 | 結果 |
|---|---|
| 後端 `mvnw clean verify` | 通過；120 項測試全數成功，包含既有 PostgreSQL 整合測試與新增啟動防護、JWT 邊界測試。 |
| 前端測試 | 36 個測試檔、226 項通過。 |
| 前端 production build | 通過；保留既有 `heic2any` CommonJS 警告。 |
| PR policy helper | 正反案例測試通過；OpenSpec strict 驗證通過。 |
| Windows 本機端到端 | embedded DB migration、合成登入及角色讀取通過。 |
| 正式 custom-domain smoke | 未登入 API 回傳預期 401；沒有登入或寫入正式玩家資料。 |

`npm ci` 回報目前鎖定依賴有 31 項 audit advisories（1 low、15 moderate、12 high、3 critical）；本次未自動升級相依套件。此報告不代表所有漏洞均可由本專案利用，後續應另行檢視並安排相依套件風險處理。

## 尚未完成

- 開發 Google client 已設定，Google 登入、暱稱、建立角色及冒險紀錄已在先前人工驗收通過；不是整條 Google 流程尚未驗收。本輪完整倉庫 CRUD 使用合成帳號，task 5.1 尚保留同一 Google 帳號下完整 CRUD 的最後驗收，不重做 client 設定。
- 定期隔離還原、復原就緒保護及 GitHub 分支／Tag 保護尚未啟用或驗收（tasks 4.1–4.3、5.3–5.6）。
- 本 change 尚未同步主規格或封存；已依授權完成 PR #36 的提交、推送、合併與正式程式部署。尚未完成的平台工作不因部署而標示完成。

## 2026-10-16 本輪收尾

### 已整理及補齊

- README 保留玩家介紹、技術概況與基本啟動入口，移除冗長 OAuth／部署設定及本機測試帳密，符合個人維護用途。
- 明確取消新增註冊信箱驗證，維持註冊後直接登入；忘記密碼寄信及 Google／Discord provider Email 驗證保持。
- VS Code 使用 Maven 工作啟動測試限定的 LocalDevLauncher，先 clean 再編譯，避免 JDT 舊產物；Explorer Tasks 提供可點擊入口。移除舊 Java launch 設定及「編譯失敗仍啟動」設定。
- VERSIONING 補上固定四項 CI、風險分級、原則回歸、合併前備份／還原時效及精確版本復原。PR 範本預設高風險；新增一般 Issue 範本，私人內容導向網站聯絡入口。
- 規範走讀：低風險 UI 需畫面與既有備份時效；高風險儲存需衝突／回滾／同物件還原；不相容 schema 停在合併前拆分或安排維護，不能假設可回退程式。

### 規格審查發現與修正

| 問題 | 修正與驗證 |
| --- | --- |
| 本機私有 application-local.properties 會被 Maven 打進本機正式 JAR | Maven JAR 與 Docker context 排除；新增 CI 產物檢查，真實重新打包後確認沒有本機設定、開發啟動器或 embedded PostgreSQL。此為本機產物檢查結果，不據此宣稱正式設定已外洩。 |
| migration 基準可能選到任意 Tag | 僅選擇穩定的 vX.Y.Z Tag，補上 snapshot／預發版排除測試。 |
| 安全 placeholder 會讓同一行其他憑證漏檢 | 改成逐個 assignment 判定，Token／私鑰標記不受 placeholder 豁免；正反案例通過。 |
| 機密檢查的負例 fixture 會誤擋它自己的 PR | 負例改為執行時組字串，保留拒絕能力，全部新增檔與差異重新掃描。 |
| 開發前端「不預載第三方 ID」文字與已配對開發 client 不符 | SRS 改為開發專用 client、缺少時不啟用，維持沒有正式 API 回退。 |
| 冒險讀取多次跨區往返 | 使用獨立的讀取效能 change 合併三個完整讀取，詳見其 verification；不放寬一致快照或寫入保護。 |

### 最新驗證

- 後端 clean verify：123 項測試通過，0 失敗／錯誤／略過；後續只變更 JAR 排除設定並重新打包，產物檢查通過。
- 前端：36 個測試檔、226 項通過，production build 成功；既有 HEIC CommonJS 警告保留。
- CI helper：14 項正反案例通過；Issue YAML／VS Code JSON 及 git diff --check 通過。
- 13 份主規格與兩個本輪 change strict validation 通過。歷史 migration 未變動。
- 本機倉庫新增、修改、刪除通過；舊時間戳更新回傳 409；來源冒險獲得明細保持。
- 雙視窗實際操作：A 儲存後，B 收到衝突且保留輸入。重新載入 B 仍可查看完整草稿；不自動採用新標記重送。API 再讀確認 A 未被覆寫、角色金幣保持；既有同角色資源並行、跨玩家拒絕與整包回滾測試全數通過（task 5.2）。
- 正式站 Google 登入與資料讀取正常。速度比較使用相近筆數及約 150 KB 角色列表，沒有正式資料寫入；實測及界線見 [讀取效能驗證](../consolidate-adventure-read-snapshots/verification.md)。

### 保留的待辦

- task 5.1 的同一 Google 帳號完整 CRUD 最後驗收；先前已完成的 Google／暱稱及角色／冒險基本驗收沿用。
- 真實 PR CI 與失敗阻擋驗證、main／Tag 保護、正式 environment／Secret 路徑啟用。
- 既有每日備份與首次隔離還原曾通過；尚待完成週期還原、自動選取備份與發布前復原就緒檢查，不能把首次結果當成持續流程已啟用。
- 剩餘平台行為未完成，故本 change 主規格同步與封存仍保留，沒有將規劃完整視為已部署。

## 2026-10-16 PR 平台驗證及部署

- [PR #36](https://github.com/kotaro-jolyne-0025/al-adventure-log/pull/36) 的 `pr-frontend`、`pr-backend`、`pr-policy`、`immutable-migrations` 四項固定檢查全數成功；Maven Wrapper 的 Linux 執行權限已修正。
- PR #36 以 squash 合併至 `c1d594c0cae2d1d1e7125b91533701c7030f4493`；main CI、Firebase Hosting 與 Cloud Build 部署成功，Cloud Run Ready 並承接全部流量。確切平台復原參照保存在私有維運紀錄。
- 自訂網域登入頁回傳 200，未登入 API 回傳預期 401；部署後的 Google 使用者讀取與效能工具重測依使用者指示延後。
- 正常 PR 的四項 CI 已實際驗證；純文件 PR 與故意失敗案例的完整驗收尚未完成，因此 task 5.3 保留未完成。
- 使用者選擇暫不啟用 main 保護；發布 Tag 保護、production environment／Secret 路徑及週期還原亦未在本次啟用。tasks 4.1–4.3、5.4–5.6 保留未完成。
