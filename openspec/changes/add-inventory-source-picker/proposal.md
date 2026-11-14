# Proposal

## Why

玩家在倉庫新增或編輯物品時，可以從既有冒險帶入來源文字，省去重打名稱。

## What Changes

- 新增與編輯物品的「取得來源」整合直接輸入與下拉選擇，只列目前角色的冒險。
- 選項只顯示冒險名稱；選取後只帶入名稱作為可編輯的來源文字。

## Capabilities

### Modified Capabilities

- `inventory-provenance`: 新增與編輯物品可從冒險帶入來源文字。

## Impact

限前端物品表單，沿用冒險清單與物品新增、更新 API。既有戰利品快照與來源關聯規則不變。
