# Proposal

## Why

使用者遇到操作問題時需要容易找到的聯絡管道；願意支持維護工作的使用者也需要明確的外部贊助入口。提供公開聯絡信箱與可設定的贊助連結，讓訪客與已登入玩家都能使用。

## What Changes

- 在已登入與未登入的右上角選單，以及首頁頁尾，提供「聯絡我」入口。
- 聯絡彈窗顯示已確認的公開聯絡別名 `adventurelog-contact.cupping865@simplelogin.com`，提供「寄信給我」與「複製信箱」。寄信使用 `mailto:`，由使用者自行寄出。
- 在相同位置提供可設定的「贊助支持」外部連結，以新分頁開啟；網址尚未確認或非有效 HTTPS 時隱藏入口。
- 贊助平台確認為 Portaly，入口指向使用者提供的 `https://portaly.cc/kiranfreedom`。
- 以共用前端設定維護信箱與贊助網址，保持首頁與兩種選單一致。

## Capabilities

### New Capabilities

- `contact-support`: 公開聯絡入口、寄信及複製信箱的互動。
- `external-sponsorship`: 選用外部贊助入口、有效網址條件及開啟行為。

### Modified Capabilities

無。沿用既有法律聲明入口；贊助入口不提供付費功能或權益。

## Impact

- 前端：`app.html`／`app.ts` 全站選單、首頁元件與頁尾、新增聯絡彈窗及共用設定，相關樣式與測試。
- 文件：實作驗證後更新 SRS 與對應 OpenSpec 主規格。
- 無新增後端 API、資料庫欄位、migration 或付款 SDK。
- 功能實作及驗證完成後，依使用者指示同步產品版本 1.4.1，透過 PR 合併 main；不涉及 Tag 或 GitHub Release。
