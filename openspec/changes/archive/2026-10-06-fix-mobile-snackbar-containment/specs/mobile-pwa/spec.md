# Spec Delta

## ADDED Requirements

### Requirement: Contained operation notifications
系統操作提示 SHALL 使文字與關閉按鈕保留在可用視窗內，避開底部安全區。包含長連續字串的訊息 SHALL 可換行，文字不得使關閉操作被水平裁切；必要時允許在提示文字區垂直捲動閱讀全文。

#### Scenario: 刪除長名稱角色
- **WHEN** 玩家在 320、360、390 CSS 像素寬的手機刪除具有長中文或連續英文名稱的角色
- **THEN** 成功訊息依可用寬度換行，提示與關閉按鈕不超出視窗，關閉按鈕可正常關閉提示

#### Scenario: 主題與較大文字
- **WHEN** 玩家在明暗主題及 200% 基準文字大小下查看操作提示
- **THEN** 文字可讀取且關閉操作仍可使用，維持原有文案、主題色及提示時間
