# Proposal

## Why

編輯角色的開卡值會重新計算角色目前狀態，目前只有已有冒險的角色會在儲存前提醒。所有角色都應在開卡值變更時確認影響，避免誤存。

## What Changes

- 編輯角色時，開卡職業／等級、金幣或休整期有實際變更，儲存前一律顯示確認視窗。
- 提醒角色目前值將重新計算，既有冒險與倉庫物品不會自動修改；已有冒險時保留重算預覽。
- 使用現有 Material 確認視窗，提供「繼續編輯」及「確認儲存」；取消保留輸入。
- 未變更開卡值及建立新角色維持直接儲存，確認期間避免重複提交。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `character-management`：擴充 Editable opening baseline，所有開卡基準變更都須確認。

## Impact

角色表單、共用確認視窗、表單測試與 SRS；沿用既有預覽及更新 API，無後端、資料庫或依賴變更。作為 1.2.1 驗收補充。
