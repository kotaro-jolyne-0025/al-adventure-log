# Design

## Context

見 proposal.md。根元件使用 SwUpdate.VERSION_READY 開啟單一 Snackbar；其他操作也使用 Snackbar。Firebase Hosting 對入口與更新檔未指定快取標頭。產品版號目前同時出現在套件檔與首頁 HTML。

## Goals / Non-Goals

Goals：集中更新狀態，保持表單輸入與手動更新控制；維持小尺寸與明暗主題可用性。

Non-Goals：不強制刷新、不清除 Cache Storage 或登入資料、不新增更新伺服器、排程套件或後端 API。

## Decisions

- 使用 root 更新服務與 Signals 保存就緒狀態。版號、手動檢查與就緒後的重新整理入口放在右上角選單；未登入頁面也提供選單，不常駐上方版本資訊列。自動發現新版／快取無法復原時，以既有上方 Snackbar 提醒並提供重新整理按鈕；一般操作可取代提醒，但選單更新入口持續保留。手動檢查結果也使用 Snackbar，自動檢查無新版時不打擾使用者。
- ApplicationRef.isStable 首次為 true 後自動檢查，並監聽可見狀態與 online 事件。以單一進行中旗標合併重複檢查，不新增定時器，避免阻礙穩定及 Service Worker 註冊；銷毀服務時解除監聽。
- checkForUpdate 的事件與 Promise 結果皆可標記新版就緒，之後不由沒有新版或檢查錯誤清除。unrecoverable 另保留重新載入需求。
- 共用 ConfirmDialog 提醒未儲存資料；取消預設聚焦，確認後 location.reload，不使用 activateUpdate。所有重新整理都詢問，避免新增跨所有表單的 dirty-state 機制。
- 畫面版號讀取 package.json，開啟 TypeScript JSON 模組解析；更新版本規範改成確認綁定來源，減少人工重複同步。
- Firebase Hosting 入口與更新檔使用 no-cache，保留 Service Worker 本身的離線快取；不把有雜湊的資源全部設成禁止快取。

## Risks / Trade-offs

- 舊客戶端尚未取得本次修正 → 本次不保證立即修復已開啟的舊版；舊版仍須等下載後重新整理，之後才有新入口。
- 長時間停在前景不會自動定時檢查 → 提供手動檢查，返回前景／重新連線也觸發；定時檢查暫不需要。
- 瀏覽器或網路不可用 → 顯示失敗／離線結果，保留既有就緒狀態並允許重試。

## Migration Plan

產品版號為 1.2.2，透過版本分支提出 PR，合併及發布依 VERSIONING.md；發布摘要由本次 commit／PR 整理至 GitHub Release。部署時只需現有前端流程與同步版號，不需資料庫 migration。
