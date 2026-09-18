# 角色管理規格草案

## Purpose

定義玩家建立、瀏覽、修改及刪除個人角色檔案的基本行為，將角色身份資料與冒險歷程連結，提供手機與桌機一致的角色入口，以及能驗收的刪除影響範圍。

## ADDED Requirements

### Requirement: Character profile
系統 SHALL 讓玩家以角色名稱及種族建立角色，並接受選填的子職、派系及頭像。角色名稱及種族 MUST NOT 為空白，文字上限各為 100 字。

#### Scenario: 必填資料缺漏
- **WHEN** 玩家提交空白角色名稱或種族
- **THEN** 系統拒絕建立並指出缺漏欄位

#### Scenario: 建立而無冒險
- **WHEN** 玩家成功建立角色但尚未新增冒險
- **THEN** 玩家可進入該角色的空冒險列表並看見新增引導

### Requirement: Character collection navigation
系統 SHALL 以卡片呈現目前玩家的角色，顯示名稱、種族與職業資訊，並提供前往該角色冒險與倉庫的入口；無角色時 SHALL 顯示建立引導。

#### Scenario: 空角色列表
- **WHEN** 已登入玩家沒有任何角色
- **THEN** 系統顯示空狀態與建立角色按鈕

### Requirement: Edit character identity
系統 SHALL 允許玩家修改自己角色的名稱、種族、子職、派系及頭像；儲存後 SHALL 顯示更新資料。

#### Scenario: 修改角色名稱
- **WHEN** 玩家儲存有效的新角色名稱
- **THEN** 角色列表及角色頁下一次顯示資料時使用新名稱

### Requirement: Confirmed character deletion
刪除角色前，系統 SHALL 告知冒險與倉庫資料會連帶刪除且無法復原，並提供取消；確認後 SHALL 刪除該角色及其冒險、附屬活動、戰利品快照、故事獎勵與倉庫物品。

#### Scenario: 取消刪除
- **WHEN** 玩家於確認視窗選擇取消
- **THEN** 角色與所有附屬資料維持不變

#### Scenario: 確認刪除
- **WHEN** 玩家確認刪除自己的角色且操作成功
- **THEN** 返回角色列表，被刪角色及其附屬資料不可再存取，其他角色不受影響

## Review status

來源：SRS §2.1、US-001–004、資料庫關聯圖。玩家名稱來源、職業／等級契約、無冒險時等級展示、靈魂幣欄位與歷史同步尚待 C04–06 及欄位矩陣補齊；不以此草案宣稱完整覆盖。欄位上限源自 SRS，是否所有入口均實作尚待驗證。
