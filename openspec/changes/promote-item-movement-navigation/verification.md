# 驗收

- [手機 390px](../../../frontend/visual-tests/snapshots/movement-history-light-390-populated/page.png)
- [桌機 1280px](../../../frontend/visual-tests/snapshots/movement-history-light-1280-populated/page.png)
- [手機 320px 深色與跨日分頁](../../../frontend/visual-tests/snapshots/movement-history-dark-320-populated/page.png)

截圖使用本機 Chromium 與模擬 API，包含永久物品的取得、調整、移除及可編輯的消耗品紀錄。320px 案例用鍵盤開啟歷史，測試 200% 文字時「載入更多」不被底欄遮住，再回到原字級擷取畫面。320px 與 601px 案例也驗證上一頁、下一頁及重新整理後的選取狀態。冒險與倉庫排序沿用原獨立截圖基準與位置判斷。

前端單元測試覆蓋清單條件與唯讀、重新讀取規則；後端 29 項既有異動測試使用隔離資料庫，覆蓋分頁、關聯編輯、撤銷、快照與權限。未操作正式環境或使用實體手機。

後續統一省略三個目的地的可見內容標題。以相同資料檢查桌機／手機的新增按鈕及排序，並確認歷史沒有空工具列；進入歷史的焦點移至有無障礙名稱的紀錄區，返回移至倉庫導覽項目。
