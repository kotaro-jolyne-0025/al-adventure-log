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

README 修改保留本機並排除本輪提交。經 PR 合併與 CI/CD 部署；正式結果於部署確認後補充，不以本機驗證替代正式環境確認。

授權參考：https://polyformproject.org/licenses/noncommercial/1.0.0
