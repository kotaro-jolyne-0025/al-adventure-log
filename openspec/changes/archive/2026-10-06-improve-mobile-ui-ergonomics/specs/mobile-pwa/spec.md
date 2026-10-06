# Spec Delta

## ADDED Requirements

### Requirement: Mobile search and action targets
寬度不超過 768 CSS 像素時，冒險與倉庫搜尋輸入文字 SHALL 至少 16 CSS 像素。搜尋清除、角色編輯／刪除、倉庫編輯／刪除、頂部返回及帳號選單操作 SHALL 提供至少 44×44 CSS 像素的按鈕範圍，且相鄰操作 MUST NOT 重疊。

#### Scenario: 搜尋與清除
- **WHEN** 玩家在 320、360 或 390 CSS 像素寬的手機搜尋冒險或倉庫
- **THEN** 輸入文字至少 16px，清除按鈕範圍至少 44×44px，清除後列表依現有規則更新

#### Scenario: 操作角色與物品
- **WHEN** 玩家在手機開啟角色列表、角色頁或倉庫
- **THEN** 本需求指定的操作按鈕至少 44×44px，完整保留在可用寬度內且不重疊

### Requirement: Responsive avatar crop preview
頭像裁切預覽 SHALL 在 320、360、390 CSS 像素寬的視窗內完整呈現，滑桿與確認／取消操作 SHALL 可使用。預覽縮放後，滑鼠與單指拖曳 SHALL 按顯示比例移動圖片；確認後 SHALL 保持 300×300 像素圖片輸出。

#### Scenario: 小視窗拖曳與匯出
- **WHEN** 玩家在縮小預覽中拖曳圖片並確認裁切
- **THEN** 圖片移動與指標移動一致，匯出內容符合預覽裁切區域，輸出尺寸保持 300×300

### Requirement: Theme-aware authentication text
登入、註冊、忘記密碼與重設密碼頁的自訂標題、說明、錯誤、成功及連結失效提示 SHALL 依目前深淺色主題顯示可讀的文字與背景，並保留既有登入流程及供應商登入品牌外觀。

#### Scenario: 深色狀態提示
- **WHEN** 玩家在深色主題查看驗證頁的表單、錯誤、成功或連結失效狀態
- **THEN** 自訂文字與狀態區使用對應主題語意色，重要文字與實際底色對比至少 4.5:1
