# Design

## Context

動機與範圍見 [proposal.md](proposal.md)。目前可以沿用的實作如下：

| 現況 | 本次處理方式 |
| --- | --- |
| `frontend/package.json` 已提供 Angular/Vitest 測試與 production build | 接入 PR CI，保留現有工具 |
| `backend/pom.xml` 已有測試限定的 embedded PostgreSQL，BOM 為 17.10.0 | 沿用於 CI 與本機開發啟動，避免新增資料庫框架 |
| `MutationGuardIntegrationTest`、`LedgerPersistenceIntegrationTest`、`AuthRateLimitIntegrationTest` 已使用真實隔離 DB | 沿用原始標記、回滾、並行與權限測試；只補具體缺口 |
| `application.properties` 缺省使用 `local`；本機設定可指定遠端 DB | 將有效目標驗證放在 migration 前，不能只靠文件提醒 |
| `FlywayConfig` 自訂 `initMethod = migrate`，未採用 enabled 開關 | 先明確化啟動／停用語意，再驗證防護先後順序 |
| 開發與正式前端設定使用同一 Google client ID | 本機改用開發專用 client；網站 JWT 金鑰也分開 |
| PR 目前只有 `immutable-migrations` 工作流程 | 補上固定 CI 工作及規格／版本檢查 |
| 私有備份每日排程、還原 workflow 需人工指定物件 | 沿用 GCS／OIDC／隔離容器，補時效門檻與定期選取物件 |
| `VERSIONING.md` 已定義 PR、部署、Tag 與 Release 順序 | 增補具體驗收與復原要求，避免另建一套發布規範 |

舊 change 中仍有驗證未完成或格式不完整的文件。本輪不將它們宣告完成，也不為了讓 CI 一次全綠而改寫歷史紀錄。

## Goals / Non-Goals

**Goals:** 開發預設安全隔離；PR 驗證不需要正式權限；合併與發布證據可核對；高風險變更有可執行的復原決策。

**Non-Goals:** 本輪不建立常駐雲端預備站、不搬移正式 Supabase、不更換產品登入機制、不增加業務 version 欄位或 migration、不新增監控／通知服務。取消新增本站帳密註冊信箱驗證的規劃，維持註冊成功後直接登入；忘記密碼的重設信件與第三方登入的 provider Email 驗證維持既有行為。`updated_at`、整包交易、所有權、草稿與快取契約沿用既有主規格。

## Decisions

### 1. 先完成本機隔離與 CI

第一階段採本機前端、本機後端及工具自行啟動的 PostgreSQL 17。CI 沿用現有 embedded PostgreSQL；本機啟動工具放在測試／開發 classpath，依賴不打入正式 JAR。預設資料庫為該次啟動的暫時資料，停止後需以合成 fixture 重建；工具須明示生命週期，避免將它當作長期玩家資料庫。

本機目前的 PATH 未發現 Docker 或 PostgreSQL CLI，故第一階段不以安裝 Docker／完整 Supabase CLI 為必要條件。若日後需要保留長期開發資料或驗證 Supabase 平台功能，另規劃持久化開發 DB 或完整預備站；不把正式 DB 的另一個 schema 當成環境隔離。

新啟動工具可產生本機資料庫目標及獨立 JWT 金鑰，再交給明確的開發 profile。啟動檢查須核對有效連線與工具持有的資料庫、執行個體及模式；不能只以 `localhost` 判定安全，也不能只設定低優先序預設值而讓 `DB_URL` 覆寫後直接寫入。所有重建操作只接受目前工具持有的 DB，不接受任意 URL。

調整 `FlywayConfig` 前須核對正式服務有效 profile；如果正式服務仍依賴缺省 `local`，先在另行授權的發布步驟中明確設定正式模式，再啟用本機防護。停用 migration 的設定必須實際控制自訂 bean，且防護要早於其 `migrate()`。測試要證明錯誤目標連 migration／初始化都不會執行。

### 2. Google 人工驗收與 CI 分工

- 開發 OAuth client 只註冊所需 localhost origins，前端開發設定與後端 audience 一致；正式 client 與正式自訂網域維持各自用途。
- 維護者可沿用自己的 Google 帳號，但會在隔離 DB 建立另一份應用帳號。產生新本機 JWT 金鑰，無須讀取正式簽章金鑰。
- CI 沿用既有 claims／授權測試與合成使用者，不啟動真實 Google 瀏覽器登入，也不新增通用免登入端點。
- 人工驗收在本機建立測試角色、完整紀錄與物品，驗證讀寫、刪除、草稿及多視窗衝突。正式站只驗證 Google 登入、角色／紀錄讀取及必要錯誤狀態；正式入口為 `https://aladvlog.com`。
- 測試 reset 不清除瀏覽器草稿；本機 DB 重建後的舊標記／舊角色仍按既有錯誤與衝突行為處理，不自動重送。

### 3. 固定且不帶正式權限的 PR CI

新增 `.github/workflows/ci.yml`，使用 `pull_request`、`push main` 與人工執行入口。第一版所有 PR 都執行共同檢查，不加入路徑矩陣或複雜動態風險推論。穩定的必要工作名稱為：

| 必要檢查 | 執行內容 |
| --- | --- |
| `pr-frontend` | Node 22 相容版本、`npm ci`、`npm test -- --watch=false`、`npm run build` |
| `pr-backend` | JDK 17、Maven Wrapper `verify`，包含現有真實 PostgreSQL 測試，不使用 `-DskipTests` |
| `pr-policy` | 前後端／lockfile 版號一致、變更規格驗證、PR 風險與驗證欄位、敏感設定及不應提交的產物檢查 |
| `immutable-migrations` | 沿用既有 workflow，拒絕舊 migration 異動，並驗證新增版本不重複且高於基準 |

需要新增的 helper 放在版本庫中供本機與 CI 共用。規格檢查限定本次新增／修改的 change 與主規格，不以現有不完整舊 change 阻擋所有新 PR，也不把未檢查範圍誤報為全專案通過；敏感設定與產物檢查也明確區分本次差異及既有受控 fixture。OpenSpec CLI 在 CI 鎖定經驗證版本。純文件變更仍檢查版號同步，但不要求變更產品版號；產品程式變更則依發布規範處理。

CI 權限為 `contents: read`，不提供 `id-token: write`，不指定部署／備份 environment，不引用正式 Secret，不使用 `pull_request_target` checkout PR。測試輸出只上傳不含玩家資料、憑證或瀏覽器 storage 的結果。

正式前端部署 Secret 移入只允許 `main` 的 production environment；先驗證該環境部署成功，再移除重複的 repository-level Secret。備份沿用 `database-backups` 的分支限制與 OIDC，後端沿用既有 Cloud Build 信任範圍。上述平台設定在實作驗證後由另行授權的啟用步驟處理。

### 4. 單人也能使用的主幹與 Tag 保護

先讓 CI 實際回報上述四個名稱，再設定 `main` 必須經 PR、基準須更新、四個檢查必須通過、禁止 force push／刪除，保護也適用管理者。核准人數設為 0，避免唯一維護者被「需要另一人 Approve」鎖住；PR 說明與測試結果仍須存在。

每個 PR 採 squash merge，保留可讀的繁體中文目的說明。設定發布 Tag 的更新／刪除保護，允許新增版本 Tag；`v2.0.1` 從此固定。這些保護是防止操作失誤，不宣稱能取代獨立安全審查。遇到必要檢查卡住，修正檢查來源，不以臨時關閉保護或假設成功作為發布捷徑。

### 5. 共同 CI 以外，按風險補證據

| 分級 | 典型變更 | 額外驗證 |
| --- | --- | --- |
| 低 | 文件、文字、純樣式 | 受影響畫面、行動版、鍵盤／對比等相關確認 |
| 中 | 不涉及權限或資料異動的讀取、顯示與一般載入調整 | 空資料、錯誤／重試、既有資料呈現；效能變更記錄相同條件的冷／暖讀取樣本 |
| 高 | 登入／授權、私有快取、草稿、寫入、資源計算、migration | 既有並行／回滾／跨玩家／微秒標記測試，加上隔離環境的完整使用流程與復原說明 |

PR template 要求填寫分級與理由；不明確時採高風險。不要為純樣式增加重複業務測試，也不能因顯示為正常就略過失敗情境。效能測量記錄環境、資料量、樣本數及快取狀態，不能把少數 UI 計時當成正式服務保證。

新增 migration 時，保留既有從 V19 升級的回歸案例，另以最近已發布 Tag 的 migration 邊界建立合成舊資料後升級至候選版本；同時跑全新建庫、資料保留及必要約束驗證。相容性也涵蓋滾動部署期間舊程式與新 schema 同時存在的讀寫，優先採先擴充、後移除的分次發布。歷史 SQL 不改寫，不透過 repair／clean 消除不一致。

### 6. 復原就緒與既有備份流程延伸

正常 Release 前檢查備份不超過 24 小時、30 天內至少一次成功還原。延伸既有還原 workflow 為每週排程加人工入口；排程從私有儲存中以 metadata 選取最新有效備份，人工入口仍可指定物件。週期早於 30 天，是為提早發現故障並容許修復，不新增監控服務。

沿用現有無網路 PostgreSQL 容器還原，檢查必要表、成功的 Flyway 狀態及可讀性，不輸出欄位內容；失敗時保留非敏感診斷並清理暫時環境。持續對照備份物件與還原工作結果，不能只看某次舊 workflow 是綠色。

由於合併 `main` 會立刻自動部署，復原就緒檢查必須在授權合併及實際合併前完成。資料庫或高風險資源變更另外產生變更前備份，並對同一物件完成隔離還原。這類演練使用正式備份，必須留在受保護的維運流程；一般 PR CI 仍只用合成資料。

維運檢查只執行受信任的主幹／固定發布版本程式，把候選 PR、head 與 base 當成資料核對，不在持有正式權限時 checkout 或執行 PR 程式。結果與候選 head 對應，合併前再核對 head、base 與風險範圍，改變則重新確認。第一版由發布操作流程強制檢查這份證據，不把帶有正式權限的工作硬塞入公開 PR CI。每日備份目標不等於已承諾可用性 SLA，實際復原時間由演練記錄，不先編造 RTO。

### 7. 發布、事故與問題回報

在 `VERSIONING.md` 補上風險、備份、版本／migration 相容性與部署後 smoke checklist。發布紀錄連結 PR、CI、確切 SHA、受影響服務、部署結果及 Release；OpenSpec verification 分開標記實作、人工驗收、部署及待辦。發布前保留上一個可用 Cloud Run image／revision 與 Firebase Hosting 版本識別，不能只寫「git revert 即可」。

若出錯，先依錯誤日誌與版本辨識影響；只有 schema 相容時，才可在具體授權後回退應用版本。不相容則向前修復；正式 DB 還原或停止寫入屬另外的事故處置，必須先說明復原點與可能失去的後續變更。緊急恢復服務與正常完整 Release 分開記錄，未滿足備份門檻時不宣稱完成正常發布。

新增 PR 與一般 bug report 範本，沿用既有聯絡入口與 GitHub Issues；涉及安全／私人資料者導向私人聯絡方式。先使用既有 Cloud Logging、Actions 失敗結果與維護者通知設定，實作驗收時核對通知可見性，不自行傳送外部訊息或串接新服務。

## Risks / Trade-offs

- [純本機無法模擬正式跨區延遲或完整平台行為] → 明示測試界線；正式站做必要讀取 smoke，雲端預備站另提 change。
- [本機暫時資料重啟後消失] → 啟動清楚提示並提供合成 fixture；不載入真正玩家資料，不自動清草稿。
- [profile 或 Secret 搬移順序錯誤造成服務無法啟動] → 啟用前核對有效設定，先驗證新路徑成功再移除舊路徑，保存設定復原步驟。
- [必要檢查名稱／觸發方式造成無法合併] → 所有 PR 固定回報；CI 成功出現後才啟用保護，測試純文件與失敗 PR。
- [完整 PR 測試增加等待] → 第一版接受小型專案的固定成本；有實測瓶頸再做範圍化，不先建動態檢查平台。
- [備份／還原失效或排程沒有執行] → 發布時核對實際時效與物件，不以 YAML 或首次成功代替持續驗證。
- [新 CI 全量驗證被舊規格問題阻擋] → 精準驗證本次修改；既有問題保留追蹤，不暗中修規格以通過。

## Migration Plan

| 階段 | 交付與驗收 | 正式服務影響 |
| --- | --- | --- |
| A：本機隔離與文件 | 開發啟動、Google 本機登入、合成資料、拒絕遠端／錯誤目標及 migration 前保護 | profile 防護切換前先完成正式設定核對；不改業務資料 |
| B：CI 與存取界線 | 四個固定必要檢查；無正式 Secret 的 PR 可跑完；正式 Secret 限制到 main | 部署環境設定需獨立授權與驗證 |
| C：保護與發布驗收 | 單人 PR 可合併、失敗 PR 不能合併、主幹與舊 Tag 不可改寫；風險與回報範本可用 | 保護規則於 CI 工作後啟用，不更動已發布 Tag |
| D：復原持續驗證 | 每週還原、24 小時／30 天證據、migration 升級與變更前備份演練 | 只有受保護備份流程讀正式 DB，還原在隔離容器 |

每階段可獨立 review，完成整體規格驗收後才結束本 change。新 CI／profile 或保護設定如需復原，依原授權範圍保存的設定及相容性處理；不自動移動公開版本、覆蓋正式 DB 或關掉安全檢查。

## Open Questions

- 開發 Google client 的實際 ID 與必要私有設定，在啟用本機人工驗收時由維護者提供；不影響隔離方案，缺少時可先完成 CI 但不能將人工 OAuth 驗收打勾。
- 雲端預備站的網域、固定預算與資源規格不屬本 change；需要時另開規劃，不預先建立或收費。

## References

- [GitHub 分支保護](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)：必要檢查、管理者適用範圍與線性歷史。
- [GitHub Actions 安全使用](https://docs.github.com/en/actions/reference/security/secure-use)：PR 程式與特權工作流程的界線。
- [Google Identity Services 設定](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)：localhost origins 與前後端 client ID 配對。
- [embedded-postgres](https://github.com/zonkyio/embedded-postgres)：專案既有的本機 PostgreSQL 測試依賴。
- [Supabase 環境管理](https://supabase.com/docs/guides/deployment/managing-environments)：後續獨立預備環境的參考；本專案仍以 Flyway 管理 SQL。
