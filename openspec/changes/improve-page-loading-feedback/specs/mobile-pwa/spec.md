## ADDED Requirements

### Requirement: Immediate navigation feedback
站內切頁開始時 SHALL 立即呈現不阻擋操作的載入回饋，完成、取消、失敗或跳過時 SHALL 清除。草稿離開確認 SHALL 維持既有選擇及資料保護。

#### Scenario: 等待頁面程式碼
- **WHEN** 玩家點選尚未載入的頁面
- **THEN** 程式碼下載期間顯示載入回饋，完成後回饋消失

#### Scenario: 取消草稿離開
- **WHEN** 玩家於草稿離開確認選擇繼續填寫
- **THEN** 保留輸入及目前頁面，導覽回饋消失

### Requirement: Idle common page preloading
角色內頁穩定後 SHALL 在閒置時預載冒險列表與倉庫的畫面程式碼。離線或省流量模式 SHALL 略過；預載 MUST NOT 實例化畫面、讀取業務資料或保存草稿，失敗 MUST NOT 阻擋正常導覽。

#### Scenario: 預先下載常用畫面
- **WHEN** 玩家在線上角色內頁且應用程式穩定並有閒置時間
- **THEN** 常用畫面程式碼預先下載，稍後切頁可共用已下載資源

#### Scenario: 離線或省流量
- **WHEN** 玩家離線或瀏覽器啟用省流量
- **THEN** 不進行背景預載，仍可正常導覽已可用畫面
