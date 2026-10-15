# Design

## Context

現有 updated_at 為 PostgreSQL timestamp 與 Java LocalDateTime。寫入入口包含角色、冒險、倉庫及個別子項目；主冒險與物品目前分開讀取。

## Goals / Non-Goals

以原始時間戳防止舊資料覆寫及共享角色資源的競態；不新增 DB 欄位、不自動合併衝突、不在填表期間持鎖。

## Decisions

- 共用 MutationGuard 由每個業務寫入控制器呼叫；Spring 交易包覆時間戳條件更新與原服務呼叫。先鎖當前使用者的角色，再重新確認資源所屬角色，所有角色資源異動遵守相同鎖順序。
- X-Expected-Updated-At 攜帶讀取回應原始字串。角色／冒險／倉庫更新與刪除、子項目異動及新冒險的角色預設基準都檢查；新建角色無舊資料，新建獨立倉庫物品只串行加總，不拒絕無關的舊角色基準。
- 子 API 使用父冒險 updated_at，任何子項目寫入推進父時間戳；相關倉庫異動也推進來源冒險，保護歷史相容讀取。全部資料時間使用 GREATEST(clock_timestamp()::timestamp, updated_at + 1 microsecond)，防止同交易 NOW 相同或時間倒退。
- 完整冒險 GET 在 REPEATABLE_READ 的唯讀交易回傳 gainedItems、storyAwards、activities、必要的 legacyItems 與主時間戳，前端 getDetails 使用同一回應。原獨立 GET 保留供相容讀取，不能作為新版整包編輯基準。涉及庫存或角色基準的寫入也使同角色空物品快照冒險的時間戳失效，以保護舊庫存相容來源，可能產生較保守的衝突提示。
- 草稿記錄 expectedUpdatedAt；復原舊草稿缺少此標記時保留內容並拒絕儲存，不自動換成新標記。

## Risks / Trade-offs

- 使用者繼續按儲存 → 同一舊標記仍回衝突，保留輸入並提供查看新版。
- 舊客戶端缺標記 → 428 要求重新載入／更新；不提供靜默略過。
- 現有安全來源驗證 → 原服務維持，守衛只新增鎖與前提檢查。
- 角色層串行 → 僅一個短寫入交易，讀取與填表不鎖；無關角色互不阻塞。

## Migration Plan

不新增欄位。V28 冪等替換既有 `update_updated_at_column()`，將交易固定的 NOW 改為 clock_timestamp 與 OLD.updated_at 加一微秒的較大值；既有觸發器否則會覆蓋應用指定的單調時間。部署時須先確認 V28 套用，再確認前後端配套更新；舊客戶端拒絕寫入。2026-10-14 使用者已授權隔離環境回歸驗證，正式部署仍待授權。
