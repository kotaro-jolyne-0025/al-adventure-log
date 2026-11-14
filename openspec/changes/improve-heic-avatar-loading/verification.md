# 驗證與套件評估

## 實作結果
- HEIC／HEIF 原生解碼成功直接使用原檔裁切；失敗才 dynamic import heic-to 1.6.7。
- 原生探測暫存 URL 會釋放；處理期間重複選取被阻擋；元件銷毀後不再開啟視窗或顯示錯誤。
- 移除 heic2any 0.0.4 及 CommonJS allowlist，改用 heic-to 1.6.7。裁切統一輸出 300×300 WebP、品質參數 0.88；無法輸出 WebP 時取消結果，沿用讀取失敗提示。既有頭像不批次轉換。

## 自動驗證
- 最終角色表單、頭像選取及裁切：3 個測試檔，31 項通過。
- 最終 production build 通過，無警告。heic-to 為 lazy chunk，原始 3.23 MB、預估傳輸 525.64 kB；沒有 CommonJS allowlist。
- 新測試涵蓋原生成功、原生失敗轉 JPEG、空 MIME 的 HEIF、轉檔失敗不覆蓋頭像、重複選取、解碼／轉檔中離開表單、一般 JPEG、5MB 限制、URL 釋放與輸入重設。

## 隔離比較
替換前以 npm 發布檔作隔離比較。兩者用同一份本機 esbuild、ES2022 minify 及 Node 壓縮設定比較單一發布入口（非完整候選 Angular build）：

| 工具 | Minified bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| heic2any 0.0.4 | 1,352,577 | 340,994 | 262,902 |
| heic-to 1.6.7 | 3,225,755 | 790,608 | 525,459 |

使用 Windows 上的 Playwright Chrome，在本機隔離頁面轉換 [libheif 的 example.heic](https://github.com/strukturag/libheif/blob/master/examples/example.heic)。僅作本機評估，範例照片與第三方程式未加入產品或測試 fixture。
- 此瀏覽器無法原生解碼範例。
- 兩套工具皆成功轉成 1280×854 JPEG，再以 canvas 輸出 300×300 WebP。
- 一次重跑的轉檔時間：heic2any 501 ms、heic-to 185 ms（不含下載）。此非效能基準，未控制冷啟動、執行順序或記憶體。

## 決策與限制
依使用者最終選擇採用 heic-to，最終格式為 WebP。候選在範例上較快，但約兩倍的壓縮下載量，尚無足夠新款 iPhone 照片與裝置驗證證明所有相容性改善。原生可讀取時直接略過解碼器。

未驗證 iPhone Safari／Android 真機、新款手機照片、HDR 色彩、EXIF 方向、峰值記憶體及離線首次轉檔。單元測試模擬原生解碼成功，Chrome 實測只驗證 fallback 工具及 canvas 可用性，沒有宣稱完成登入後完整頭像 UI 驗收。

隨靜態網站提供 heic-to 上游授權及來源連結；新增的依賴不適用專案自有程式的授權。
