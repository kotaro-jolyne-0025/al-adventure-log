# legal-presentation Specification

## Purpose

定義既有版權與免責聲明在產品中的呈現位置及讀取方式，讓訪客與玩家可以在註冊或填寫資料時查閱聲明，並在手機與不同主題下保持可讀性及操作連續性。

## Requirements

### Requirement: Bilingual global footer
各主要頁面 SHALL 顯示既有中英文非官方同好內容宣告，並在淺色、深色主題及行動版中保持可讀。

#### Scenario: 切換深色主題
- **WHEN** 訪客在顯示頁腳的頁面切換至深色主題
- **THEN** 中文及英文宣告仍完整可讀

### Requirement: Public legal page
系統 SHALL 讓未登入訪客透過 `/legal` 閱讀完整既有聲明，包含同好內容、商標、使用者內容與免費非商業使用的說明。

#### Scenario: 訪客直接開啟聲明
- **WHEN** 未登入訪客開啟 `/legal`
- **THEN** 系統顯示聲明內容而非要求登入

### Requirement: Registration notice dialog
註冊按鈕下方 SHALL 顯示提交代表已閱讀並同意聲明的提示，並提供可開啟條款彈窗的連結；關閉彈窗 SHALL 保留已輸入的註冊資料。

#### Scenario: 註冊途中閱讀聲明
- **WHEN** 玩家填寫註冊資料後開啟並關閉條款彈窗
- **THEN** 返回原註冊表單且先前輸入仍保留

### Requirement: Readable legal document navigation
公開法律頁 SHALL 以單欄完整展開正文，頁首提供主標題、英文副標題、修訂日期及五節目錄。每節 SHALL 使用中文標題與分行英文副標題，以留白與分隔線區分。中英文同好聲明 SHALL 共用引用區並標示語言；既有聲明文字及政策網址 SHALL 保留。

#### Scenario: 查找章節
- **WHEN** 訪客點擊或以鍵盤啟動目錄項目
- **THEN** 本頁定位到對應章節，標題不被頂部工具列遮擋，且鍵盤可從章節繼續閱讀與操作

#### Scenario: 手機與大字閱讀
- **WHEN** 訪客在 320 CSS px 寬視窗、200% 根字級或深淺色主題閱讀
- **THEN** 正文、目錄、引用及返回操作完整可讀、可換行且無水平溢出，自訂連結高度至少 44px 並有可見鍵盤焦點

#### Scenario: 保留原有聲明與操作
- **WHEN** 未登入訪客開啟法律頁
- **THEN** 五節既有聲明及雙語同好宣告完整展開，官方政策維持安全的新分頁連結，頁首與頁底提供返回操作
