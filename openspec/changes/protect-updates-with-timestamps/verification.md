# Verification

2026-10-14，分支 `perf/reduce-read-round-trips`。本機實作階段使用者授權採用既有 updated_at，不新增欄位；後續部署授權及結果見下方紀錄。

## 實作及靜態審查

- 角色、冒險、倉庫修改／刪除與冒險子項目異動的控制器均使用 MutationGuard。新增冒險以 defaults 的角色標記檢查；新增獨立物品以角色短鎖串行，若新增物品帶來源關聯則檢查父冒險標記。
- 共用 Spring 交易：確認使用者歸屬、取得角色列鎖、重新解析資源、以 updated_at 條件更新，再執行原服務；RuntimeException 使包含時間戳的全部異動回滾。舊標記 409、缺漏 428、格式錯誤 400，無權限／已移除 404。
- 所有相關 mapper 更新時間單調前進；倉庫修改使原及新的來源父冒險失效。涉及庫存或角色基準的寫入也使空物品快照冒險失效，保護舊倉庫相容讀取，可能產生較保守的衝突。
- 完整冒險 GET 在 REPEATABLE READ 交易回傳物品快照、故事獎勵、休整期、必要的舊庫存與時間戳。角色及 defaults 讀取也使用一致快照；前端不再分別讀物品或在保存前另做有時間空隙的草稿雲端比對。
- 前端以原始字串傳 header，傳輸前剝除 request 的本機 expectedUpdatedAt metadata。表單保留已讀標記，草稿保存及復原相同標記；未自動採用其他視窗的新標記。衝突保留輸入、提供新分頁查看新版；唯讀列表刪除失敗可刷新顯示。
- AGENTS、SRS、資料庫文件及主 state-consistency 規格已更新；前一讀取最佳化 change 的文字與此實作保持一致。

## 查核及建置

- Supabase 唯讀 metadata 查核：相關六表 updated_at 均為 timestamp without time zone、precision 6。角色／冒險／庫存目前缺漏 updated_at 的筆數皆為 0。未對正式資料執行 UPDATE、migration 或其他寫入。
- 初次實作階段僅完成 Maven package（-DskipTests）及 Angular 編譯；以下為使用者後續授權的實際測試結果。
- 兩個本次 change、12 份主規格 strict validation 及 git diff --check 通過。

## 2026-10-14 授權後回歸結果

- 先跑既有回歸：前端 178 項、後端 66 項通過。
- 新增真實 PostgreSQL 17.10 隔離整合測試，使用專案完整 Flyway migration、MyBatis mapper 與 Spring 交易代理。未載入正式資料庫連線設定。
- 確實重現一個問題：V1／V5 的既有時間觸發器將 UPDATE 指定的時間覆蓋為 NOW，同交易兩次更新取得相同時間。新增測試先失敗，再以 V28 冪等替換函式修正，測試通過。保留 search_path、原欄位及原觸發器；沒有新增版本欄位。
- 並行測試使用兩個執行緒、兩條連線及 latch，確認 pg_stat_activity 實際出現資料庫鎖等待。相同標記只允許第一筆成功，第二筆 409 且未執行回呼；相同角色不同冒險的資源加總串行、不遺失更新。
- 整包失敗後主紀錄、獲得物品、庫存、角色資源及時間戳全部回滾，原標記可再使用。子項目及庫存來源切換使父冒險標記失效；獨立新增物品使 defaults 與舊庫存相容讀取失效，保留無關的非空快照。
- 驗證六位微秒原樣接受、毫秒截斷 409、缺標記 428、格式錯誤 400、跨使用者拒絕、時鐘回退仍至少前進一微秒；V28 再執行不增加欄位或更動業務資料。
- MockMvc 配合實際控制器／守衛／服務驗證新鮮 PUT 成功回傳新標記，過時 DELETE 回 409 JSON、缺 header 回 428 JSON，沒有誤轉成 500 或刪除角色。
- 讀取測試在主紀錄讀取後，透過另一條連線提交子項目異動，確認同一次 getEntry 仍回傳一致的舊主紀錄、子清單與時間戳；下一次讀取回新版。defaults 同樣保持角色標記及永久物品加總屬於同一快照。
- 真實列表 SQL 驗證即時靈魂幣 quantity 加總、無物品為 0、忽略普通消耗品及舊角色計數，且遵守使用者歸屬；服務測試確認列表不逐角色查詢庫存。
- 前端 HttpTestingController 驗證 19 個異動 API 原樣送 header 並剝除 JSON metadata；完整詳情只發一筆 GET，整包儲存沒有前置 GET。缺漏子清單／標記及跨角色回應被拒絕。
- 三種表單的 409／428 保留輸入及原標記、不導覽或清除草稿；舊草稿復原不採用新標記，缺漏標記保持缺漏。新版連結在另一分頁開啟。新冒險使用 defaults 的數量與角色標記，不下載倉庫；缺漏、負數、非整數預設值禁止儲存。
- 最終 `npm test -- --watch=false`：33 個測試檔、203 項測試全部通過（新增 25 項）。
- 最終 `mvnw.cmd package`：85 項測試全部通過（新增 19 項），JAR 打包成功；沒有跳過測試。
- Angular production build 成功；初始傳輸估計 160.34 kB，保留既有 heic2any CommonJS 警告，未出現新建置警告。
- 本次兩份 change、12 份主規格及 diff 空白檢查通過。`openspec validate --all --strict` 另有兩份未在本次修改的舊 change 失敗：filter-cloud-run-deploy-by-backend-changes 缺 delta、require-magic-item-details 的 MODIFIED 缺既有 scenario；未將全專案檢查誤報成全部通過。

## 發布及驗證界線

以上為隔離資料庫、HTTP 及前端自動化驗證；沒有操作正式業務資料儲存，也尚未完成手機實機、瀏覽器多視窗人工驗收或正式站速度量測，不能以本機測試數據宣稱正式延遲改善。API 要求前後端配套更新；舊客戶端缺少標記會被拒絕，須更新網頁。

## 2026-10-14 授權後部署

使用者授權將本輪修改與 PolyForm 授權一起部署，排除 README。PR #29 合併至 `5a664c9ba70f76a6080d986ab5eeaa21f05580df`，前後端 CI/CD 成功，新 Cloud Run revision Ready 並承接 100% 流量。Supabase 唯讀確認 V28 已成功套用，時間觸發器已改為單調時間並保留 public、pg_temp 搜尋路徑。正式版本 v2.0.0，完整部署紀錄見 adopt-polyform-noncommercial/verification.md；手機實機驗收待使用者完成，未建立 Tag／Release。
