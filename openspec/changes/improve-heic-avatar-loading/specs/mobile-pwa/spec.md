## MODIFIED Requirements

### Requirement: Keyboard operable avatar positioning
頭像上傳 SHALL 接受 JPG、PNG、WebP、HEIC／HEIF，檔案大小 SHALL 不超過 5MB，並拒絕 GIF。HEIC／HEIF SHALL 優先使用瀏覽器原生解碼，成功直接裁切；僅原生解碼失敗時 SHALL 載入 heic-to 並在裝置端轉成暫存 JPEG 供裁切使用。解碼及轉換期間 SHALL 顯示處理狀態並停用重複選取，暫存 URL SHALL 釋放；離開表單後 MUST NOT 開啟裁切視窗或顯示轉檔錯誤。失敗 SHALL 沿用讀取失敗提示並允許重新選取。頭像裁切 SHALL 可拖曳或聚焦預覽後以方向鍵微調（Shift+方向鍵使用較大步進）；縮放控制 SHALL 有清楚名稱與可讀值，移動／縮放／重設／取消／確認 SHALL 可完全由鍵盤完成，匯出尺寸 SHALL 為 300×300，最終儲存格式 SHALL 為 WebP 並保留透明背景；若瀏覽器無法輸出 WebP，SHALL 提示讀取失敗且不覆蓋既有頭像。

#### Scenario: 全鍵盤完成裁切
- **WHEN** 玩家只用鍵盤調整頭像
- **THEN** 可到達具可見焦點的位移及縮放操作，確認匯出與可見裁切結果一致，取消不改頭像

#### Scenario: 原生可讀取
- **WHEN** 瀏覽器能解碼選取的 HEIC
- **THEN** 原檔直接交給裁切視窗，不載入轉檔工具

#### Scenario: 原生不支援
- **WHEN** 瀏覽器無法解碼選取的 HEIC
- **THEN** 延遲載入工具並轉成 JPEG，轉檔失敗不覆蓋既有頭像

#### Scenario: 離開頁面
- **WHEN** 解碼或轉檔完成前表單已銷毀
- **THEN** 不開啟視窗、不顯示錯誤，並釋放暫存 URL

#### Scenario: 儲存裁切結果
- **WHEN** 玩家確認裁切
- **THEN** 以 300×300 WebP 儲存並保留透明背景；不支援 WebP 編碼時顯示既有讀取失敗提示，不改存其他格式或覆蓋原頭像
