# Spec Delta

## Purpose

讓希望支持網站維護的訪客與玩家使用清楚標示的外部贊助連結，並在贊助網址尚未核定時保持介面完整可用；贊助為自願行為，不影響免費工具的既有使用方式。

## ADDED Requirements

### Requirement: Optional sponsorship entry
系統 SHALL 僅在設定包含有效、具有主機且無帳密的 HTTPS 贊助網址時，在已登入選單、未登入更多選單及首頁頁尾顯示「贊助支持」；缺少或無效網址 SHALL 隱藏入口，不使用占位連結。

#### Scenario: 網址尚未審核完成
- **WHEN** 贊助網址未設定
- **THEN** 所有入口均不顯示贊助連結，「聯絡我」仍正常可用

#### Scenario: 設定有效網址
- **WHEN** 維護者設定已確認的 `https://portaly.cc/kiranfreedom`
- **THEN** 三處入口顯示相同目的地的「贊助支持」連結

#### Scenario: 設定無效網址
- **WHEN** 設定為格式不合法、相對網址、非 HTTPS 或包含帳密的網址
- **THEN** 所有贊助入口均隱藏，不允許點擊無效目的地

### Requirement: Explicit external navigation
贊助連結 SHALL 以新分頁開啟設定的目的地，清楚告知「外部網站，新分頁開啟」，並避免新頁面取得原頁面控制權；系統 SHALL 不附加帳號、角色資料或未儲存內容。

#### Scenario: 編輯途中開啟贊助
- **WHEN** 玩家在尚未儲存的編輯頁從選單點擊贊助連結
- **THEN** 外部頁面以新分頁開啟，本站保留原路由與輸入，不傳送玩家資料到連結參數

### Requirement: Voluntary support presentation
贊助入口 SHALL 呈現為次要、非強迫操作，不要求登入或贊助才能使用既有功能。

#### Scenario: 使用者不贊助
- **WHEN** 訪客或玩家忽略贊助入口
- **THEN** 所有既有免費功能、註冊與聯絡管道維持原有可用性
