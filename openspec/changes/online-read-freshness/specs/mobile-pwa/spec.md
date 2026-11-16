## MODIFIED Requirements

### Requirement: Efficient offline application delivery
初次載入 SHALL 延後低頻介面及第三方登入資源，Service Worker 預先快取啟動殼層所需資源，其餘功能資源於使用時快取。部署設定 SHALL 讓入口、manifest 與 worker 中繼檔重新驗證，並讓雜湊命名的靜態資源長期快取。業務讀取 SHALL 遵循 local-read-cache 的線上記憶體新鮮期，MUST NOT 透過 Service Worker 快取業務 API；有限的唯讀副本回退與斷線時保留已載入內容依 local-read-cache。未曾快取的離線功能頁 SHALL 提供可恢復的錯誤提示，且保留目前殼層。草稿的既有保存與唯讀查看 SHALL 保留。

#### Scenario: 初次安裝
- **WHEN** 使用者以有限頻寬首次開啟應用程式
- **THEN** 僅預先下載啟動所需資源，低頻功能資源延後載入

#### Scenario: 背景刷新本機副本
- **WHEN** 玩家裝置存有舊版副本，並在線上返回清單或離線開啟已快取的應用殼層
- **THEN** 線上命中新鮮記憶體直接顯示，未命中先載入；已知離線或暫時讀取失敗才使用有效唯讀副本，無副本時顯示錯誤及重試，既有草稿入口可依原規則運作

### Requirement: Recoverable page read states
角色、冒險及倉庫列表 SHALL 區分載入中、成功空資料、搜尋無結果及讀取失敗。讀取失敗 SHALL 在頁面持續提供錯誤說明與重試入口；重試 SHALL 保留搜尋及篩選。暫時性詳情讀取失敗 MUST NOT 被當成資料不存在；暫時錯誤、有效唯讀副本回退及斷線時已載入內容的保留 SHALL 遵循 local-read-cache。

#### Scenario: 初次讀取失敗後重試
- **WHEN** 玩家初次開啟列表遇到網路或伺服器錯誤，然後選擇重試
- **THEN** 顯示讀取失敗而非「尚無資料」，成功後顯示最新結果，保留條件

#### Scenario: 詳情錯誤與背景刷新
- **WHEN** 詳情重新讀取時遇到暫時錯誤
- **THEN** 暫時錯誤有重試，依 local-read-cache 決定可否呈現唯讀內容；不存在、權限問題與暫時錯誤使用不同且符合既有安全流程的說明與出口
