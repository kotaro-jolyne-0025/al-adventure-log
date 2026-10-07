# Design

## Context

CharacterFormComponent 已比對 loadedCharacter 的基準，只有 hasAdventureEntries 且有變更才預覽並用 window.confirm；其他編輯直接更新。專案已有共用 Material ConfirmDialogComponent。動機見 proposal.md。

## Goals / Non-Goals

**Goals:** 使用現有元件與 API，以一致可鍵盤操作的視窗提醒並保留既有重算預覽。

**Non-Goals:** 不改後端計算、歷史資料、倉庫或版本號，不擴充新的視覺設計。

## Decisions

- 有實際基準變更即確認；有冒險才請求既有預覽 API。無冒險只顯示影響提醒，避免不必要請求。
- 職業使用既有解析器正規化並依職業加總、排序比較；資源以數值比較。避免中文別名、排列或 `10.00` 造成誤提醒，改回原值也不提醒。
- 使用共用 ConfirmDialogComponent 替代瀏覽器 confirm，訊息支援換行與長字換行；初始焦點落在「繼續編輯」，Escape／背景點擊視為取消。
- isSaving 覆蓋預覽、確認及更新階段；提交入口加 guard，取消或錯誤解除鎖定。確認後送出同一份請求。

## Risks / Trade-offs

- [共用樣式影響其他確認視窗] → 僅加入訊息換行及手機至少 44px 按鈕，保留其他既有樣式。
- [非同步預覽失敗或視窗關閉造成誤存] → 未明確回傳 true 一律不更新，以測試覆蓋取消、關閉、失敗及重試。

## Migration Plan

僅前端變更，沿用現行 CI/CD；無 migration。回復此表單及確認視窗變更即可撤回。
