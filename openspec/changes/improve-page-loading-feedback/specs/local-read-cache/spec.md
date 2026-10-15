## ADDED Requirements

### Requirement: Preserve content during background refresh
已顯示的角色列表、角色摘要、冒險列表、冒險詳情及倉庫背景刷新時 SHALL 保留内容並提供行內更新回饋。已顯示內容 MUST NOT 被較早的裝置副本替換，雲端成功後 SHALL 更新內容。正式異動 SHALL 等候本輪所需雲端資料完成，錯誤與權限失效 SHALL 沿用既有處理。

#### Scenario: 等候最新雲端資料
- **WHEN** 已載入頁面重新確認雲端資料且尚未完成
- **THEN** 保留既有內容與閱讀操作並顯示更新中提示，新增、編輯、刪除及使用物品仍停用

#### Scenario: 原資料與讀取錯誤
- **WHEN** 背景刷新成功或回傳拒絕存取／目標不存在
- **THEN** 成功時呈現雲端最新內容，拒絕／不存在時依既有規則清除內容，不能以保留畫面遮蔽錯誤
