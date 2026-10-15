# 1.4.0 Material Design 3 UI 盤點

盤點日期：2026-10-09（Asia/Taipei）。基準：目前工作目錄（main，HEAD `5a7b6ea`），frontend/package.json 為 1.3.0；不是正式站的實測結論。

## 方法與結論

使用專案 `material-design-3-ui` v1.1.1，按需讀取 accessibility、anti-patterns、adaptive-design、navigation、color-system、typography、component-selection、shape-and-elevation、forms-and-input、feedback-and-overlays。檢查前端模板、事件／錯誤分支、全域樣式、DESIGN.md、SRS、mobile-pwa 規格及既有驗證紀錄。

結論：**已有良好 M3 基礎，但尚不能宣稱全面符合**。主要缺口在狀態復原與自訂互動的無障礙；不是需要把整個產品換成預設 Material 外觀。本輪沒有開瀏覽器量測、重新跑建置、操作正式資料或使用螢幕閱讀器；實際對比、焦點與輔助技術結果列入 1.4.0 驗收。

以下路徑以 repository root 為基準，行號為本輪盤點位置，後續實作可能變動。

## 已有基礎：保留並回歸

- `frontend/src/styles.scss:146` 起以 `mat.theme` 建立雙 M3 主題；主操作與焦點已有共同的 Material primary 來源，稀有度／同調／資源有文字與共用語意變數。原始色值集中於 token 定義本身不算違規。
- 角色、冒險、倉庫卡主入口已用原生連結，獨立編輯／刪除可聚焦；搜尋保留原生輸入與排序 select，篩選有選取語意。自訂控制不等於必須改成 Material 元件。
- 手機 safe-area、dvh、44px 操作範圍、全文換行與全域 reduced-motion 已有規格及實作。Android 48dp 不直接用來判定 Web 的既有 44 CSS px 失敗。
- 冒險編輯已有 loadFailed／重試、成功載入前禁止儲存；已有明細在驗證失敗時展開。這些行為可作為其他頁面的基準。
- 1.2.1 的 68 組 P2 檢查及 1.3.0 的手機密度／篩選／明細收合有既有紀錄（見 DESIGN.md 第 15、17、18 節）。這些是歷史驗證，並不代表本輪重新驗證所有畫面。
- 角色卡是具身份與操作的資訊單位，冒險卡是一次活動摘要；不能僅因使用卡片就判定違反 M3。Inter、深色紫色、D&D 多色與既有首頁風格均保留。

## 缺口與 1.4.0 目標

P1 為核心修正；P2 為一致性與驗收；P3 為先提案比較的選配。

| ID／優先 | 觀察與證據 | 影響／改善目標 | 驗收條件 |
|---|---|---|---|
| M3-01 P1 | character-list.component.ts:56–58、adventure-list.component.ts:183–185、inventory-list.component.ts:310–314，讀取錯誤只發 3 秒 Snackbar 並結束 loading；模板依空陣列顯示「尚無」 | 初次失敗可能被誤認為沒有資料。持續顯示錯誤與重試，成功空資料與搜尋無結果獨立；靜默更新失敗保留既有內容並標示未更新 | 模擬初次 500／離線、成功空陣列、無搜尋結果、重新載入失敗，畫面與復原動作各自正確；重試保留條件 |
| M3-02 P1 | character-shell.component.ts:74–76、adventure-detail.component.ts:126–128，所有讀取錯誤皆當作找不到並導離；inventory-form.component.ts:93–117 未建立讀取中／成功載入門檻 | 暫時錯誤不應當作不存在；慢速載入物品期間不能提交未載入的編輯表單。依狀態提供重試／返回，載入前禁止儲存 | 404、401／403、500／離線、慢速回應分開處理；只有載入成功可提交；恢復登入仍沿用既有安全流程 |
| M3-03 P1 | character-shell.component.html 約 132 起的 mat-tab-group，實際 router-outlet 放在 group 外；inventory-list.component.html:56 起亦為空 mat-tab，資料在外部條件區 | 分頁元件產生的 panel 與可見內容不一致。角色使用路由分頁及關聯內容 panel，倉庫讓各 tab 的 panel 包含對應資料。兩組都是同角色／同倉庫下的同層內容，不是「無關頂層目的地誤用 tabs」 | 檢查 accessibility tree、Tab／方向鍵／Enter、直接網址及上一頁；selected／controls／labelledby 指向真正內容，沒有空 panel |
| M3-04 P1 | avatar-cropper-dialog.component.ts:48–61 只有 mouse／touch／wheel 位移；:66–67 的滑桿 thumb 沒有明確名稱 | 鍵盤可縮放仍不能完整調整裁切位置。增加具名稱的縮放及鍵盤位移／重設操作與可理解說明 | 完全不使用滑鼠可移動、縮放、重設、取消與確認；焦點可見、數值可讀；300×300 輸出與既有觸控拖曳保持一致 |
| M3-05 P1 | inventory-form.component.ts:122–124 invalid 僅 markAllAsTouched；adventure-form.component.ts:916 起多個驗證分支以 Snackbar 提示；login.component.html:73 起 loading 移除按鈕文字，login／register 的 auth-error-alert 未宣告 live 語意 | 長表單錯誤欠缺定位，提交狀態與錯誤播報不一致。提供持續錯誤摘要或定位入口，展開相關區域；busy 時保留動作文字且避免重複提交。評估既有 Snackbar 播報，避免重複朗讀 | 鍵盤能到達錯誤欄位並修正，輸入保留；螢幕閱讀器得知提交／錯誤狀態，搜尋結果摘要適度播報且不逐鍵打斷 |
| M3-06 P1 | shared/components/confirm-dialog/confirm-dialog.component.ts:26 用 color="warn"；本機 @angular/material/types/button.d.ts:46–47 說明 color 只支援 M2；styles.scss 未見對應 warn 覆寫 | M3 下該屬性不能保證破壞性強調。以支援的 M3 override／error 配對表達刪除，確認資料區分 destructive 與一般確認；明確取消焦點 | 雙主題檢查實際 computed style、文字對比、取消初始焦點、Esc／返回焦點；更新重整及開卡值確認不套用刪除色 |
| M3-07 P2 | styles.scss:12–25、:81–94 的自訂 surface／文字系統與 Material 角色並存，:560 起覆寫內部 .mdc-notched-outline；各頁大量局部 font-size，裁切 canvas 的固定深底亦未說明用途 | 這是設計債，未證實所有顏色對比失敗。建立品牌／Material／業務色對應表與字體角色，保留已驗收配色；以 public theme overrides 逐步取代內部 selector。裁切底色、OAuth 品牌等允許具理由的例外 | 自訂元件使用既定角色；surface/on-surface、error/on-error 配對一致；雙主題量測文字與狀態對比；200% 大字與 1.3.0 密度回歸通過 |
| M3-08 P2 | 既有驗證以幾組手機／桌機寬度及根字級放大為主；app.routes.ts 沒有 route title，app.html 沒有跳到內容入口 | 跨頁可發現性與實機／輔助技術證據不足。補 route title、跳到主要內容與合理導覽焦點；針對 600／768 等斷點兩側、zoom 與虛擬鍵盤補驗收 | 鍵盤可跳過重複頂列、辨識新頁；不干擾分頁切換／表單輸入；原生瀏覽器 200% zoom、根字級 200% 分別驗證，實機與模擬分別記錄 |
| M3-09 P3 | character-shell.component.scss:12 限寬 1080px，冒險以列表／詳情路由切換；倉庫每列 clean-card | 現況限寬本身符合可讀性，不是缺陷。以常見跑團任務比較寬視窗 supporting pane／list-detail 與現況，以及倉庫 divider list／outlined card；有明確效率收益再納入 | 提供具體同資料對照與閱讀／操作成本，使用者確認後另建 delta；未採用亦可有紀錄，不強迫新增 rail、FAB、雙欄或 Expressive |

M3-01～08 為本次 1.4.0 執行範圍。M3-09 的交付是方案比較與採用決策，不把未確認的桌機改版當作必做實作。

## Skill self-audit

0＝缺少／不正確，1＝部分具備，2＝原始碼與既有紀錄支持具備；本表是工程盤點，不是正式 M3 或 WCAG 認證。

| 面向 | 分數 | 判斷 |
|---|---:|---|
| Task clarity | 2 | 各列表新增入口、表單儲存及資源結算目的明確 |
| Information hierarchy | 1 | 手機改善已完成；字體角色及跨頁層級仍需一致化 |
| Component semantics | 1 | 原生連結與選取已有基礎，tabs/panel 關聯待修 |
| Token discipline | 1 | 有共用變數，但表面／字體及 M3 破壞性按鈕未完整統一 |
| Adaptive behavior | 1 | 有手機分支、安全區及限寬；斷點邊界／實機鍵盤待補驗收 |
| States & feedback | 1 | 冒險編輯可復原，但其他讀取及提交狀態未一致 |
| Accessibility | 1 | 焦點及操作範圍有基礎，裁切鍵盤、驗證定位與播報有缺口 |
| Expressive restraint | 2 | 工具頁維持克制，已有減少動態，不需強加 Expressive |

總計 10/16，僅供定位改善，不能用總分抵銷特定頁面無法操作的問題。M3-04 是裁切位置鍵盤操作的明確缺口，修正前不將該流程視為就緒。

## 參考與驗證界線

- [Material 3 color roles](https://m3.material.io/styles/color/roles)：角色與配對基準；本輪頁面為 JS 渲染，未擷取完整規格文字，詳細尺寸不據此臆測。
- [Angular Material tabs](https://material.angular.dev/components/tabs/overview)：實作時核對路由導覽／同頁內容差異；DOM 行為需本機驗證。
- [W3C 狀態訊息說明](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)：可見狀態訊息應可由輔助技術感知，避免過多播報；未以單純缺少 aria-live 就推斷 Material Snackbar 完全不播報。
- 本機 Angular Material button.d.ts 為本次 M3 color API 判斷的直接依據。破壞性按鈕的實際顏色與對比尚未量測。
- 既有 44 CSS px 與 16px 手機輸入規格保持；雙主題一般文字至少 4.5:1，其他圖形／焦點的判斷在實作驗收時依適用 WCAG 項目量測。

## 本輪規劃檢查

- `openspec validate align-v1-4-0-material-design-3 --strict` 通過。
- `openspec status --change align-v1-4-0-material-design-3`：proposal／specs／design／tasks 四份規劃 artifacts 完整；18 項實作及驗收任務均未勾選。
- `git diff --check` 通過。本輪只新增此 change 並在 DESIGN.md 加入 1.4.0 目標索引，未修改產品程式碼或版號。


## 實作後追蹤（2026-10-09）

以上為修改前盤點，保持原始評分及證據。M3-01／02／03／04／06的核心修正已實作；M3-05／07／08已有程式與瀏覽器證據，輔助技術／實機／真正zoom仍待驗收；M3-09比較已提供，採用決策待回覆。詳見 [驗證紀錄](verification.md) 及 [任務狀態](tasks.md)，本輪實作評估14/16，不代表全面M3／WCAG驗收。
