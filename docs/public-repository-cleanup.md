# 公開版本庫清理與部署前維護

## 處理範圍

舊 V3 初始化檔曾包含個人帳號與可用預設憑證。新版不再建立任何預設或占位帳號；使用者由註冊或 OAuth 登入建立，測試帳號只由測試 fixture 建立。保留 V3 歷史檔名，不代表仍會建立使用者。本文不重貼外洩值。

此變更只影響尚未套用 V3 的初始化；既有帳號、Google 綁定與角色資料不會因檔案更新而自動改密碼、停用或清除。不要因帳號曾出現在初始化檔就刪除它，它可能已是玩家實際使用的帳號。

## 先處理帳號

1. 在本專案的登入／忘記密碼流程更換曾曝光的密碼，若其他服務共用也一併更換。此專案使用自有 `users` 與 Spring Boot JWT，不能以 Supabase Auth 使用者操作取代。
   - 更換 Google 密碼不會同步更新本專案的 `password_hash`。目前 OAuth 綁定同 Email 的既有帳號時會保留本機密碼，`AuthService.login` 仍允許以有效的本機密碼登入。必須另行確認本網站曝光的密碼已失效；本次未查詢正式 DB，不宣稱已排除風險。
2. 評估既有 JWT：改密碼不保證已發出的 Token 立即失效。若需立即撤銷所有 Token，可在部署平台輪替 `JWT_SECRET`，但這會讓所有使用者重新登入，應安排維護時段。
3. 避免在聊天、issue、commit 或文件中貼上新密碼、Token 或完整私人資料。

## 已部署 V3 的資料庫：部署前必做

這次清理改變已部署 V3 的 checksum。**不能直接 push main 觸發部署，也不能重跑 V3**：V3 含歷史初始化的 TRUNCATE。禁止關閉 Flyway validate 或在啟動程式中自動 repair。

1. 備份資料庫與 migration history；記錄目前部署版本。安排維護時段，避免舊／新版本同時執行 Flyway。
2. 唯讀確認 `public.flyway_schema_history` 中 version `3` 的 script、success、checksum。
3. 已知清理前 checksum 為 `-1789094287`；本次移除預設帳號後為 `841749704`。若不是這兩個值，停止並核對當初部署檔案，勿任意替換 checksum。先前本機匿名占位方案的 `-397298809` 已被取代，不要再用上一版維護 SQL。
4. 執行 [單筆修復 SQL](../backend/src/main/resources/db/maintenance/repair_v3_public_sanitization.sql)。它只更新 V3 的 checksum，接受重複執行；不修改 users、角色、冒險資料，也不修復其他版本。
5. 經核對後由原有 CI/CD 發布新版，確認 Flyway 驗證、登入與角色查詢成功。
6. 若必須回退舊程式，需在同一維護流程中將 V3 history 恢復至已備份的對應 checksum；只回退程式會再次不匹配。不要將含外洩值的檔案重新公開提交。

全新空資料庫直接執行新版 migrations，不需要上述修復。維運 SQL 位於 `db/maintenance/`，不會由 `classpath:db/migration` 自動執行。日後不要再改 V3，否則本文與維運 SQL 的新 checksum 也會失效。

## Git 歷史清理：另行協調

目前內容清理完成不代表 GitHub 上的舊 commit、tag、PR diff、fork 或 clone 已清除。

- 先確認密碼已失效，再安排協作者暫停推送、備份及受控歷史重寫。
- 可在隔離 clone 用 `git-filter-repo` 清除這個檔案的敏感歷史後補回匿名版本；替換值檔案只能存在本機，不應提交。
- 重寫影響 commit ID、分支與 tag，需要明確授權後再 force push；協作者須重新 clone，避免將舊歷史推回。
- 視需要聯絡 GitHub Support 處理受影響的 PR 參照與快取；已被複製出去的內容不能保證收回。

本次未執行正式帳號改密碼、資料庫維運 SQL、歷史重寫、commit、push 或部署。完成前不可宣稱曝光事件已完全結案。
