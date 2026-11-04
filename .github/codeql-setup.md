# CodeQL 掃描設定切換

`workflows/codeql.yml` 使用 Advanced setup，讓一般與 Dependabot PR 都透過
`pull_request` 執行掃描，避免 Default setup 未替 Dependabot PR 產生分析結果，
導致 `3 configurations not found`。保留 Actions、Java/Kotlin、JavaScript/TypeScript
三種語言、預設安全查詢、main push 與每週掃描，另提供手動執行入口。

掃描不使用部署憑證、`pull_request_target`、分支保護豁免或 Dependabot 排除條件。
Java 沿用免建置分析；日後若新增 Kotlin，需改用建置分析以涵蓋 Kotlin。

## 啟用與驗證

1. 先審查 workflow，確認切換及提交／推送／合併已獲授權。只新增此檔案不代表
   已啟用；GitHub Default setup 啟用期間會拒收 Advanced setup 的分析結果。
2. 在 Settings → Advanced Security → CodeQL analysis → Switch to advanced
   停用 Default setup，接著執行新 workflow。切換期間避免合併其他 PR。
3. 確認三個 Analyze job 成功，且 main 有新 workflow 的三種語言基準分析。
   workflow 合併後若未自動掃描，可從 Actions 手動執行 main。
4. 讓既有 Dependabot 分支包含此 workflow，再重新觸發 PR 掃描；逐一確認三個
   Analyze job 成功，且 CodeQL 結果不再顯示缺漏設定。切勿只依整體中立狀態判定成功。
5. 若舊 Default setup 基準仍導致缺漏警告，從 Code scanning 工具狀態確認
   新 workflow 的 main／PR 分析均存在，再處理舊設定；不刪除未確認的告警資料。

切換失敗時重新啟用 Default setup，保留既有掃描能力；依賴 PR 的缺漏警告在
新 workflow 驗證完成前仍視為未解決。應先完成掃描切換，再合併其他 PR。

參考：
- [GitHub Advanced setup 設定](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning)
- [Dependabot 掃描應使用 pull_request 事件](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/resource-not-accessible)
