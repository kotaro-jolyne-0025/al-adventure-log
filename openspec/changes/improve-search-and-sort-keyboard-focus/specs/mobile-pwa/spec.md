# Spec Delta

## ADDED Requirements

### Requirement: Visible keyboard focus for list controls
冒險與倉庫列表的搜尋、排序依據、排序方向、清除搜尋、篩選與清除篩選操作 SHALL 在鍵盤聚焦時顯示可見且與選取狀態不同的焦點框。明暗主題及手機視窗 SHALL 保持焦點可辨識，且控制項 SHALL 保留原有原生鍵盤行為。

#### Scenario: 鍵盤搜尋與排序
- **WHEN** 玩家用 Tab 聚焦搜尋或排序依據，輸入搜尋文字或用方向鍵變更排序依據
- **THEN** 實際可見的控制項顯示焦點，搜尋與排序依既有規則更新；移開焦點後搜尋中的狀態仍保留

#### Scenario: 鍵盤操作自訂按鈕
- **WHEN** 玩家在明暗主題、320／390／1280 CSS 像素寬視窗，用 Tab 聚焦排序方向、搜尋清除、篩選或清除篩選操作
- **THEN** 焦點框清楚可見且不被裁切，Enter 或 Space 可執行按鈕原有操作，篩選選取狀態不被焦點框取代
