# Design

## Context

動機與範圍見[proposal.md](proposal.md)，行為契約見[規格 delta](specs/mobile-pwa/spec.md)。基準是已推送v1.4.0的單頁Angular／Material UI；使用者指示繼續後已實作第一階段，證據及實機限制見verification.md。以下原始碼盤點為修改前狀態。

原始碼盤點：

- `index.html`已有`viewport-fit=cover`；`styles.scss`已有四邊`--safe-area-*`，app toolbar已使用左右安全區。
- character shell與多個表單容器僅在`<=600px`使用左右安全區，較寬版仍為固定16px外距：展開與橫向應補一致安全區規則。這是實作缺口，不代表已觀察到實機遮擋。
- 冒險表單已有短layout viewport回到文件流的操作列；鍵盤可能只改變visual viewport，不能把既有CSS高度判斷當成鍵盤實測通過。
- 裁切已有隨容器縮放的正方形預覽與顯示／canvas座標換算；目前要驗證的是開啟中變更尺寸及短高度，不另重寫裁切模型。
- 列表條件在Signals、表單在既有元件中；不應因新增寬度分支重建router-outlet或表單元件。

### 官方依據與適用界線（2026-10-09）

| 來源 | 官方指引摘要 | 網頁採用方式 |
|---|---|---|
| [Apple：Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) | 適應可用空間、跨顯示器維持狀態、避免劇烈重排 | 採用連續操作與可調整版面原則；SwiftUI／UIKit size class、reserved region及系統元件自動避讓不是Angular能力 |
| [Chrome：Viewport Segments](https://developer.chrome.com/blog/viewport-segments-api-shipped) | Chrome138起提供邏輯區域尺寸；正式JS入口是window.viewport.segments | 留作能力增強方案；不使用舊origin trial的visualViewport.segments，不推定Safari支援狀態 |
| [WebKit：安全區域](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) | viewport-fit=cover後要處理四邊safe-area-inset，安全區不能取代一般間距 | 沿用既有env與max邊距；它不是折痕位置API，不能據此知道中間鉸鏈 |
| [Chrome：Device Mode](https://developer.chrome.com/docs/devtools/device-mode) | 可模擬尺寸與摺疊姿態，仍有裝置模擬限制 | 作工程證據，不能標為iPhone Duo實機或Safari通過 |

## Goals / Non-Goals

**Goals:** 用最小調整讓玩家在查物品、填紀錄、確認操作與裁切頭像途中改變可用空間，仍能接續原任務。

**Non-Goals:** 此階段不採用之前被保留的雙欄候選、不改導覽成側邊rail、不增加Duo專屬選單或依user-agent辨識；不新增草稿持久化、SDK、套件或資料格式。瀏覽器自行重載／系統終止後的草稿保留另屬新功能。

## Decisions

### 1. 同一個頁面，依空間漸進展開

採CSS重排及同一組控制項，不為外／內螢幕建立兩套頁面。Apple原生介面側邊工具列不直接搬到網站；玩家繼續使用熟悉的頂列與角色分頁。

| 可用空間／情境 | 倉庫與冒險列表 | 表單與操作 |
|---|---|---|
| 寬度<=600 CSS px | 沿用標題＋新增、獨立排序、分類、搜尋＋篩選入口、單欄卡片 | 沿用手機資源摘要及選填收合，輸入至少16px |
| 601–768 CSS px | 沿用既有寬版控制項；文字依內容換行 | 沿用原有欄位／摘要，保留既有觸控操作要求 |
| >768 CSS px | 保留目前單頁與最大閱讀寬度，未改為雙欄 | 沿用目前表單欄位分組與最大寬度 |
| 任意寬度＋左右安全區 | 內容與操作內縮，背景可延伸 | 容器、浮層與操作列都避開安全區 |
| 可視高度<=600 CSS px | 正常文件捲動，不額外增加固定工具列 | 操作列回文件流；浮層內容捲動、取消／確認可達 |

600／768是本專案既有CSS斷點，不是Duo螢幕尺寸，也不是把Android dp視為CSS px。設計尺寸按實際viewport量測，不從5.4／7.6吋推算。

結構示意（窄／寬皆維持相同閱讀順序）：

```text
頂部：返回｜品牌｜主題／帳號
角色：身分＋資源摘要（依既有手機規則收合）
導覽：冒險紀錄表｜倉庫
操作：標題＋新增 → 排序 → 分類 → 搜尋／篩選
內容：原有卡片清單／表單分組
表單末端：錯誤定位 → 取消｜儲存
```

選擇此方案是因使用者已接受目前密度；寬度增加本身不足以證明需要第二個工作區。

### 2. 四邊安全區套在正確容器

第一階段調整各外層容器的左右padding為`max(原有邊距, var(--safe-area-left/right))`，保留最大內容寬度。不要在每張卡片重複加安全區，避免雙重內縮。頂列保留已有規則，底部操作沿用bottom inset。浮層在CDK overlay自身計算可用寬／高，不假定繼承頁面padding。

先用`dvh`與內容overflow限制浮層；如果自動化或實際Safari證據顯示鍵盤只縮小visual viewport，補最小visualViewport resize／scroll處理可視高度與位移，銷毀時移除listener。不得藉此重新載入資料、改路由或重新掛載表單。

### 3. 動態尺寸不改工作狀態

- 列表：保留activeTab、query、rarity／attunement、sort key／direction、filter expanded與既有資料／讀取錯誤。
- 表單：保留欄位、明細ID、選填展開狀態、校驗錯誤及busy；resize不呼叫初始化或save。
- 焦點：CSS重排可見控制項時不主動focus main；若原焦點入口隱藏，移到同區域可見等效入口或展開控制，避免落到body。
- 捲動：不在resize呼叫scrollTo(0,0)；高度重排後以原內容上下文可接續為準，不要求絕對scrollY相同。
- 浮層：保持同一MatDialogRef、取消初始焦點與focus trap；裁切display尺寸變化不重設scale／offset，匯出仍300×300。
- 原有loading／error／empty／success／disabled／selected語意維持，不增加「已摺疊」通知。

### 4. 元件、主題與無障礙

沿用Material tab nav／tab group、filled新增／儲存、outlined篩選、標準dialog與slider；排序原生select保留。使用現有surface／on-surface／primary／error角色與字體token，不引入新配色。維持既有44px指定觸控範圍、對比目標、鍵盤焦點與分頁關聯；不因短高度縮小按鈕。無新增布局動效，尊重reduced motion。

### 5. 分段螢幕列為第二階段

第一階段處理viewport與安全區，尚不承諾避開中間折疊區域。若後續瀏覽器提供可靠segments，能力偵測後可把連續表單／裁切／確認放在足夠大的單一區域，另行比較清單＋詳情方案。資訊不可用時回退第一階段布局。不能硬寫「中央20px」、僅憑名稱猜測鉸鏈，或把Chrome API自動視為Safari支援。

第二階段另立規格與任務，不在第一階段暗中加入機種分支。連續摺疊螢幕和有實體遮擋的雙螢幕也不假定同一幾何。

## Risks / Trade-offs

- [CSS安全區不能描述中央折疊區] → 明確區分第一階段適應尺寸與第二階段segment避讓，不宣稱全面摺疊相容。
- [鍵盤與地址列的可視高度因瀏覽器不同] → 測layout／visual viewport差異；有證據才補事件處理，保留正常捲動。
- [自動化尺寸不是Duo實機] → 自動化、Safari模擬器、Safari／PWA實機分列結果；使用者目前不做人工驗收，實機欄標為待驗，不作第一階段設計完成門檻。
- [改全域overlay影響一般桌機] → 對確認、裁切、長內容與200%字級做回歸；安全區為0時保持既有間距。

## Migration Plan

後續實作先做四邊安全區，再做短視窗浮層與必要焦點修正，最後同步SRS／DESIGN及主規格。沒有資料migration；如需回復，僅回復該次前端CSS／事件處理。發布版本與提交／推送依後續指示，不把本設計混進剛推送的v1.4.0三個commit。

## Engineering verification plan

由agent完成：同一頁依序390×844→768×700→1024×500→390×500→390×844，加599／600／601與767／768／769邊界、雙主題與200%字級；尺寸僅為工程樣本，不標為Duo真實viewport。驗證搜尋／分類、未儲存冒險明細、裁切、確認浮層、長字串、焦點與寫入請求數。非零安全區以測試覆寫token模擬，visualViewport模擬只證明事件處理，不代表iOS鍵盤實測。前端build／相關測試及OpenSpec strict完成後記錄證據。

實機Safari／PWA、內外螢幕移轉、鍵盤與系統終止行為保留待驗項；此設計不要求使用者現在進行測試。

## Implementation notes

- 頁面安全區alias由外層shell消耗，內頁保留一般邊距，避免同一安全區重複內縮。
- 模擬visualViewport高度350、layout高度844時，原操作列仍為sticky；補ViewportService後變為static。服務只更新可視高度／位移CSS變數與短高度class，尺寸事件不讀寫業務資料；pinch zoom時不收縮dialog，銷毀會清理listener及requestAnimationFrame。
- 焦點復原限於標記的data-resize-focus區域，只處理原控制項因尺寸變化隱藏且沒有新可見焦點的情況；可見搜尋／表單輸入不動。資源摘要由display:contents改為block，提供tabindex=-1的同區域復原目標。
- 移除舊手機dialog container的額外16px padding，避免內層100%高度再加padding，使長內容與200%字級的確認操作超出外層。保留內容／動作各自內距，內容捲動，操作不縮小。
