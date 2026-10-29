# Verification

- 後端針對性測試：在 backend 執行 `./mvnw.cmd '-Dtest=GlobalExceptionHandlerTest,AuthControllerTest,AuthFlowIntegrationTest' test`，40 項通過，0 failures、0 errors、0 skipped。使用測試自行啟動並關閉的暫存 PostgreSQL 與 GreenMail，未連接正式環境。
- 覆蓋：405 JSON 與多方法 Allow、合成敏感 query／本體不洩漏、預期拒絕無 ERROR 堆疊、未知錯誤仍回 500 並寫 ERROR；真實登入／續期路由的 GET 不執行業務、不設定登入 Cookie；完整安全鏈保留 no-store，以及既有登入、續期、CSRF、登入歸屬及撤銷測試。
- 文件驗證：`openspec validate fix-http-method-error-response --strict` 通過；`openspec validate --specs` 14 份主規格通過；`git diff --check` 通過。從最新 main 建立獨立修正分支後，已重新執行上述 40 項測試並全數通過。
- 範圍檢查：實作只改共用例外處理器、三個既有測試檔與需求／OpenSpec 文件；未修改前端、安全設定或資料庫 migration。
- 未涵蓋：未部署或正式瀏覽器驗收；未重跑其他無關測試。GET 發送來源仍未確認，不能宣稱此修正會停止錯誤方法請求或刪除歷史 Error Reporting 事件。
