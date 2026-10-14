# Verification

2026-10-14，使用者授權切換 PolyForm Noncommercial 並部署除 README 外的本輪修改。目標 v2.0.0；搭配 reduce-read-round-trips 與 protect-updates-with-timestamps。

## 本機驗證

- LICENSE 直接採官方 1.0.0 純文字原文；前端 public/licenses 提供相同內容，兩者 SHA256 相同。原文沒有加入自訂限制；作者 Required Notice 與適用範圍另存 NOTICE。
- 原創程式碼與第三方套件、官方內容、商標及玩家內容分開；舊 CC 發布版本維持原授權，機構例外依完整條款說明。
- 公開法律頁與註冊彈窗顯示相同摘要與原文連結，維持五節排版及雙語同好宣告；修訂日期為 2026-10-14。
- 前端 203 項測試通過，production build 成功；只有既有 heic2any CommonJS 警告。
- 後端 Maven package 含 85 項測試全部通過，未跳過測試；前後端產品版本同步 2.0.0，套件授權 metadata 同步。
- 三份本輪 change 與 12 份主規格 strict validation、git diff --check 通過；兩份舊 change 的既存全專案規格問題仍見 protect-updates-with-timestamps/verification.md。

## 部署

- PR #29：https://github.com/kotaro-jolyne-0025/al-adventure-log/pull/29；部署 commit 為 `5a664c9ba70f76a6080d986ab5eeaa21f05580df`。
- GitHub Actions 前端部署成功：https://github.com/kotaro-jolyne-0025/al-adventure-log/actions/runs/38504601163。
- 後端 Cloud Build 成功；Cloud Run 新 revision Ready 並承接 100% 流量，服務 commit 標記與部署 SHA 一致。
- Supabase 唯讀確認 Flyway V28 success=true；時間觸發器已使用 clock_timestamp 與 OLD.updated_at 加一微秒的較大值，保留 public、pg_temp 搜尋路徑。未新增欄位，未手動寫入正式業務資料。
- 正式 `/legal` 回傳 200；PWA manifest 引用新版法律頁程式，包含 v2.0.0、PolyForm 授權及適用範圍。正式授權原文與本機原文相同；未登入 `/api/characters` 回傳 401。
- README 由原部署基準到新部署 commit 無變更，仍為本機未提交草稿。手機實機操作與主觀順暢度交由使用者驗收，沒有宣稱本輪已完成正式環境速度比較。
- 本輪依授權完成合併與部署；未建立 Tag 或 GitHub Release。

授權參考：https://polyformproject.org/licenses/noncommercial/1.0.0
