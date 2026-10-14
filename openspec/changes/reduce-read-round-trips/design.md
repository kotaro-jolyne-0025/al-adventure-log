# Design

## Context

角色 DTO 使用倉庫即時統計，主冒險 DTO 已含 storyAwards；新增表單目前以完整倉庫計算起始永久物品。

## Goals / Non-Goals

減少相同資料的 API／SQL 往返；保留現有權限、歷史快照與讀取失敗保護。無新增資料快取或資料表。

## Decisions

- 在角色列表 SQL 以限定使用者的分組子查詢 JOIN 統計，沿用 Character.soulCoins 映射；列表 DTO 不逐角色查詢。單角色讀取仍即時統計。
- AdventureService.getDetails 使用主 API 一次回傳 entry、gainedItems、storyAwards 與必要的 legacyItems。後續時間戳保護變更將它們納入同一一致讀取快照，保留舊倉庫來源匹配規則。
- defaults 使用既有 sumQuantityByCharacterIdAndItemType；前端驗證 startingMagicItems 是非負整數，再套用。

## Risks / Trade-offs

- 欄位缺漏被當空清單 → 明確拋讀取錯誤，維持不可儲存。
- 聚合跨使用者 → 子查詢及外層均限定 userId。
- 平行 GET 移除不保證等比例加速 → 記錄減少次數，正式速度待後續量測。

## Migration Plan

無 migration。後續發布時先確認新 defaults 後端上線，再啟用新前端；本次不發布。
