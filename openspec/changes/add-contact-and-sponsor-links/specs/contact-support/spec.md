# Spec Delta

## Purpose

提供全站可找到的公開聯絡管道，讓未登入訪客及已登入玩家遇到使用問題時能閱讀並複製維護者信箱，或啟動自己的郵件工具寄信，同時保留目前頁面的工作內容。

## ADDED Requirements

### Requirement: Public contact entry
系統 SHALL 在已登入使用者選單、未登入更多選單及首頁頁尾提供「聯絡我」入口；點擊 SHALL 開啟聯絡彈窗，不要求登入。

#### Scenario: 訪客需要聯絡
- **WHEN** 未登入訪客從更多選單或首頁頁尾點擊「聯絡我」
- **THEN** 彈窗顯示公開聯絡別名 `adventurelog-contact.cupping865@simplelogin.com`、「寄信給我」及「複製信箱」

#### Scenario: 編輯途中聯絡
- **WHEN** 已登入玩家在編輯表單中開啟並關閉聯絡彈窗
- **THEN** 系統保留原路由與已輸入資料，並將焦點返回觸發入口或其所屬選單按鈕

### Requirement: User initiated email
「寄信給我」 SHALL 透過 `mailto:` 指向公開信箱，預填主旨「冒險紀錄表 Web版｜使用問題」。系統 SHALL 不自動寄出、不附帶帳號、角色資料或表單內容，並顯示信箱供手動取用。

#### Scenario: 開啟郵件工具
- **WHEN** 使用者點擊「寄信給我」
- **THEN** 系統啟動郵件連結，是否撰寫及寄出由使用者自行決定，不顯示「已寄出」提示

### Requirement: Copy contact address with recovery
「複製信箱」 SHALL 複製完整公開信箱；成功 SHALL 提示「已複製信箱」，失敗或瀏覽器不支援 SHALL 提示「無法自動複製，請選取信箱手動複製」，並保留可選取的信箱文字。

#### Scenario: 複製成功
- **WHEN** 剪貼簿寫入成功
- **THEN** 使用者收到成功提示，剪貼簿包含完整信箱

#### Scenario: 剪貼簿不可用
- **WHEN** 剪貼簿權限拒絕或 API 不可用
- **THEN** 使用者收到手動複製提示且仍可選取信箱，不顯示成功訊息

### Requirement: Accessible contact interaction
聯絡介面 SHALL 支援鍵盤操作、可見焦點及讀屏名稱，彈窗 SHALL 有可識別標題、關閉操作及 Escape 關閉行為；窄視窗、大字及深淺色主題 SHALL 保持內容與操作可讀且可用。

#### Scenario: 鍵盤操作彈窗
- **WHEN** 使用者以鍵盤開啟聯絡彈窗並操作後按 Escape
- **THEN** 焦點在開啟時進入彈窗、操作期間留在彈窗、關閉後回到合理觸發位置

#### Scenario: 窄視窗大字
- **WHEN** 使用者在窄視窗放大文字或切換深淺色主題
- **THEN** 信箱與操作可換行、不被裁切且仍可辨識與使用
