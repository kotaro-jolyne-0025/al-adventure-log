# 聲明呈現規格草案

## Purpose

定義既有版權與免責聲明在產品中的呈現位置及讀取方式，讓訪客與玩家可以在註冊或填寫資料時查閱聲明，並在手機與不同主題下保持可讀性及操作連續性。

## ADDED Requirements

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

## Review status

來源：SRS §2.6、US-LEG-001–003。本規格僅描述既有文字的展示，不新增法律結論或認定條款效力。全域頁腳是否提供彈窗入口待 C16。
