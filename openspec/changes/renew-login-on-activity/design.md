# Design

## Context

JWT 預設有效期為兩小時，後端逐請求核對 token_version。前端有 24 小時背景確認、401 登出與帳號切換取消請求；localStorage 的 Token 更新目前會被當成登入切換。

## Goals / Non-Goals

**Goals:** 持續使用時免於固定到期；保留撤銷、跨分頁與舊回應隔離，避免續期破壞填表。

**Non-Goals:** 不改背景確認的 24 小時、不加 refresh token／Cookie／資料庫 session，不讓背景輪詢或過期 JWT 延長登入。

## Decisions

- POST /api/auth/renew 要求經現有 filter 驗證的登入；以原 JWT claims 更新 issuedAt／expiration，不讀取最新版本覆蓋舊版本，避免認證後同時重設密碼使舊登入復活。
- 新登入 JWT 增加 sessionId，續期保留原 sessionId 與 tokenVersion；legacy Token 續期保留缺漏狀態，繼續受版本 0 相容規則限制。此 ID 只用於前端區分登入，不替代後端驗證。
- 前景 pointerdown、keydown、input、scroll 事件呼叫 AuthService；Token 核發滿十分鐘且尚有效時才續期，不設背景計時器。單一進行中請求合併操作；失敗後至少一分鐘才能重試。
- 續期只更新 Token，不呼叫登入成功流程、不改每日確認時間或清除快取。以 sub／sessionId／tokenVersion 比對登入；晚到或較早到期的回應不能覆蓋目前狀態。跨分頁同登入續期保留原請求；較舊 Token 不縮短期限。重新登入同一帳號仍算新 session。
- 前端只向本站 API 傳送 Token。401 依登入身分判斷是否登出，避免續期造成的 Token 字串變化漏掉真正撤銷，亦不讓舊登入的錯誤登出新登入。

## Risks / Trade-offs

- 每個活躍分頁每十分鐘最多一次續期，失敗最多每分鐘一次；不把每次按鍵變成 API 呼叫。
- 閒置到期以最近成功續期的兩小時為準，因此節流使最後一次操作到到期時間最多相差十分鐘。離線不能取得新憑證。
- 持有有效 Token 者也能要求續期；本次不改儲存架構，密碼重設及帳號停用仍阻止後續續期。
- 保留 24 小時背景確認，因每個後端請求已檢查帳號啟用狀態與登入版本；背景確認主要更新個人資料。
