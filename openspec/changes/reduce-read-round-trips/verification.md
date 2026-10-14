# Verification

2026-10-14：使用者授權三項讀取最佳化的本機實作；分支 `perf/reduce-read-round-trips`。

## 已完成

- 角色列表 findByUserId 使用限定 userId 的倉庫分組加總及 LEFT JOIN；DTO 使用查詢的即時 soulCoins，不逐角色呼叫統計 mapper。使用 COALESCE 為無物品角色回傳 0，排序維持原有建立時間。
- 詳情、編輯載入、草稿雲端比對均使用 AdventureService.getDetails，共用主紀錄 storyAwards；缺漏或非陣列拋錯，保留物品 API 與既有倉庫相容查詢。
- defaults 使用現有永久物品 quantity 統計 mapper；新增表單僅請求 defaults，缺漏、負數或非整數維持 loadFailed 與儲存保護。
- 既有表單測試模擬介面及故事獎勵失敗案例同步至新的完整讀取介面；沒有新增或執行測試。
- 主規格 character-management、adventure-log 與 SRS 已同步。

## 建置與文件检查

- Angular production build 成功，初始傳輸估計 160.05 kB，保留既有 HEIC CommonJS 警告。
- `npx tsc -p tsconfig.spec.json --noEmit` 成功，僅編譯既有測試來源，未執行測試。
- Maven package 成功（`-DskipTests`），僅確認打包，未執行後端測試。
- 本次 OpenSpec change 與 12 份主規格 strict validation 通過，git diff --check 通過。

## 限制與後續

後續 `protect-updates-with-timestamps` 將物品與必要的舊庫存一併由完整冒險 GET 回傳，提供同一讀取快照並取代儲存前草稿雲端比對；最終行為及建置紀錄以該 change verification 為準。本檔先前建置數據保留作為實作階段紀錄。

## 2026-10-14 後續授權驗證

後续使用者授權驗證後，已實際執行隔離 PostgreSQL 的列表 SQL、defaults 及完整讀取交易測試；確認即時靈魂幣 quantity、零物品角色、使用者歸屬及一致讀取。服務測試確認列表沒有逐角色庫存查詢；HttpTestingController 確認詳情只發一筆 GET，新冒險表單不下載倉庫。前端 203 項、後端 85 項回歸及前後端正式建置通過；詳細結果與觸發器修正見 protect-updates-with-timestamps/verification.md。

尚未做瀏覽器人工驗收或正式站速度比較；不得用先前 SQL 毫秒數或本機測試宣稱正式延遲改善。本次無 commit、push、升版或部署，正式站仍為既有 v1.6.2。後續發布須先確認 V28 與新版後端，再提供新前端行為。
