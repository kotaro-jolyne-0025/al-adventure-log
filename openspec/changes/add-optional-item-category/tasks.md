# Tasks

## 1. 資料庫與 API

- [x] 1.1 新增 Flyway migration，為兩個物品表增加 nullable item_category 與九值限制；在隔離 PostgreSQL 驗證舊列為 null、重跑成功、合法值可保存且無效值遭拒。
- [ ] 1.2 加入共用 ItemCategory enum、Entity、Request/Response DTO 與 MyBatis 讀寫映射；以持久層測試確認兩表九種值及 null 可往返，並確認 API 無效字串／陣列回傳 400。
- [ ] 1.3 更新 InventoryItemService 與 AdventureEntryService 所有相關建檔、更新、補建快照與 response mapping；擴充既有服務測試驗證分類保存／清除、新物品入庫、正差額重建、不補貨與倉庫修改不回寫歷史。

## 2. 前端表單與顯示

- [ ] 2.1 在 inventory/adventure model 增加共用 ItemCategory 與中文對照，倉庫與冒險兩種物品明細加入選填單選 mat-select；驗證載入回填、切換選項、未指定轉 null 及請求保留分類。
- [ ] 2.2 在倉庫清單的永久物品與消耗品項目於稀有度附近加入唯讀中文分類膠囊，並在冒險詳情顯示中文分類；驗證無稀有度仍顯示分類、未指定或清除後不顯示膠囊、既有標籤共存，並手動驗證下拉選單鍵盤操作及手機標籤換行無橫向溢出。

## 3. 整合驗證與文件

- [ ] 3.1 執行後端相關服務／持久層測試與 Maven build、前端測試及 npm run build；確認重新載入後分類保留、清除可持久化、分類不影響既有數量與來源。
- [x] 3.2 更新 system-requirements-spec.md、database-schema.md，將本 change delta 同步至主規格；執行 openspec validate add-optional-item-category --strict 並確認文件與實作一致，記錄驗證結果後更新任務狀態。

## 提交前驗證（2026-09-25）

- 已完成資料欄位、API 映射、服務同步、單選選單與中文膠囊實作。
- 隔離 PostgreSQL 測試通過：migration 重跑、舊值為 null、九種類別讀寫、清除及無效值拒絕。
- 後端 `mvnw clean package`：58 項測試通過；前端正式建置通過，仍有兩項 SCSS 體積警告。
- 前端測試包含消耗品數量與類別請求；服務測試包含新物品分類入庫。
- 未勾選的整合項目仍包含尚未逐項執行的 HTTP 400、完整分類同步情境及瀏覽器鍵盤／手機人工驗證，不代表實作未完成。
