# Design

## Context

動機與量測見 proposal.md。既有冒險列表／詳情／defaults 以多個 SELECT 加 REPEATABLE READ 保持一致性；資料庫跨區往返使這些查詢及隔離層級切換的成本累積。所有寫入仍由 MutationGuard 與既有交易管理。

## Goals / Non-Goals

**Goals:** 三個讀取各只發一個 SELECT，所有權、主子項目、相鄰快照及時間戳從同一 PostgreSQL statement snapshot 取得。

**Non-Goals:** 不變更寫入隔離層級、快取新鮮度、草稿、JWT、API、schema 或正式部署設定；不以快取先顯示取代最新資料完成時間。

## Decisions

1. 沿用 MyBatis 與型別映射，列表以 owner-filtered character LEFT JOIN entry 保留「有角色但零筆」與「角色不可存取」的差別；內部空列表哨兵不回傳 API。
2. 子資料以 LATERAL UNION ALL 合成獨立列，透過既有 result maps 按主鍵收集。使用 PostgreSQL JSONB 作 SQL 內的異質列載體，輸出欄位還原為 UUID／timestamp／boolean／integer；不在 Java 加 JSON 反序列化或新依賴，不形成子清單乘積。
3. 詳情同一 SQL 讀取下一筆穩定排序的快照、歷史物品，且僅在無戰利品時讀舊倉庫。既有 service 的警告與 DTO 映射沿用。defaults 同一 SQL 讀角色時間戳、資源及永久物品 quantity 合計。
4. 只有已合併成單一 SELECT 的讀取可移除額外唯讀交易。多項寫入、MutationGuard、整包回滾及角色鎖維持原有路徑；全域 isolation 不調整。
5. 以真實隔離 PostgreSQL 驗證空值／空列表、跨玩家拒絕、多個子項目、舊庫存、相鄰警告、微秒精度及並行快照；以查詢數回歸阻止再引入 N+1。

## Risks / Trade-offs

- [複合映射漏掉或混合子項目] → 非對稱數量的活動／獎勵／物品及多筆冒險測試；依子類型的非空主鍵區分。
- [單語句內仍使用不一致資料] → 所有子查詢限定相同角色／冒險，無後續延遲 SELECT；以並行提交驗證結果是一整組舊或新快照。
- [環境差距無法直接保證消失] → 分列瀏覽器橋接計時、API 日誌與本機合成資料，記錄中位數及範圍；未部署前不宣稱正式環境已改善。

## Migration Plan

無 migration。完成本機測試／建置後留待使用者授權 PR／發布；部署後以自訂網域重測相同讀取。舊版 schema 相容，必要時可依授權回退應用版本。

參考：[PostgreSQL 17 statement snapshot](https://www.postgresql.org/docs/17/transaction-iso.html)、[MyBatis nested result maps](https://mybatis.org/mybatis-3/sqlmap-xml.html)。
