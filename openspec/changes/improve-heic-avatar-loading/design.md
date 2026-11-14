# Design

## Context
角色表單已使用 dynamic import 載入 heic2any；裁切視窗接受 File，輸出 300×300 WebP（JPEG 備援）。

## Goals / Non-Goals
減少可原生讀取 HEIC 裝置的下載及轉檔。不建立伺服器轉檔、不更動裁切介面、不修改提示文案。

## Decisions
用 Image.decode 實際探測檔案，不依瀏覽器名稱判斷。暫存 object URL 在 finally 釋放。原生失敗後沿用延遲轉檔，再傳入同一裁切流程。處理期間阻擋重複選取，離開元件後不再顯示結果或錯誤。

使用者最終選擇以 heic-to 1.6.7 作延遲解碼工具，並統一以 WebP 儲存裁切結果。保留原生優先路徑；HEIC fallback 的 JPEG 僅為裁切前暫存，不作最終儲存。移除 heic2any 及其 CommonJS allowlist。

裁切輸出為 300×300 WebP、品質參數 0.88，保留透明區域。若瀏覽器無法輸出 WebP，沿用既有讀取失敗提示並取消本次結果，不悄悄改存 JPG。既有頭像不批次轉檔。候選解碼器下載量較大，此取捨見 verification.md。

## Risks / Trade-offs
- 原生不支援的裝置多一次快速解碼失敗 → 後續仍使用既有轉檔。
- 5MB 檔案大小不等同解碼記憶體上限 → 不宣稱解決所有大圖記憶體問題。
- Windows 測試無法證明 iPhone Safari 真機的色彩及方向 → 明列實機驗證限制。

## Migration Plan
無資料遷移，維持既有 chunk 載入與快取設定；回復表單改動即可回復原流程。
