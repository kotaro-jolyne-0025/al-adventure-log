# v1.3.0 第二批驗證

日期：2026-10-09。此紀錄為本機實作驗證，產品版號仍為 1.2.2。

## 完成範圍

- 不超過 600px 的倉庫保留搜尋與篩選入口，篩選預設收合，入口顯示稀有度／同調已選數，不計搜尋文字。收合不清除條件，搜尋清除、篩選與展開操作至少 44px。
- 冒險表單的永久物品、消耗品、故事獎勵與休整活動，空白時只顯示標題及新增入口，不提供展開／收合；有明細後預設展開並可切換。基本資料、資源變化及結算保持可用。新增後自動展開，移除最後一筆後切換入口消失。
- 手機有明細時以無外框的標題按鈕整合小箭頭、中文名稱與明細筆數。箭頭隨展開狀態切換，筆數隨新增／移除更新，無另外的展開／收合按鈕；新增維持獨立操作。筆數計清單筆數，不等於消耗品庫存總量；輔助名稱也包含筆數。
- 提交時物品變動數與明細不符，展開兩個物品區塊、停用收合並保留既有錯誤提示；修正數量後解除。名稱／描述驗證失敗亦展開相關區塊。既有快照、提交內容與欄位節點保留。
- 手機樣式集中在 styles.scss 並限定元件作用域；601px 以上不顯示新控制項，維持既有內容與版面。

## 建置與規格

| 檢查 | 結果 |
| --- | --- |
| `frontend: npm run build` | 通過，最終建置無樣式容量警告 |
| `frontend: npm test -- --watch=false` | 驗收修正後 10 個測試檔、64 項測試通過 |
| 既有物品數量不符測試 | 補上空白區塊、錯誤展開及修正解除檢查，原儲存數量／類別仍通過 |
| `openspec validate compact-mobile-filters-and-form-sections --strict` | 通過 |
| `openspec validate --specs` | 8 份主規格通過，mobile-pwa 新增兩項需求 |
| `git diff --check` | 通過 |

## 手機與互動

使用 Chrome、虛構帳號與 API 資料，不連接正式資料。倉庫、新冒險與編輯冒險各測 320／360／390／600px、明暗主題、100%／200% 根字級，共 48 組通過。

- 檢查頁面水平溢出、新控制項文字及邊界、至少 44×44px 操作、輸入字級至少 16px。
- Enter／Space 展開篩選，鍵盤焦點可見；搜尋、稀有度與同調條件在收合後仍保留，已選數正確，清除恢復原狀。
- 四個空白區塊沒有切換入口；新增後才有按鈕，Enter／Space 可切換且保留輸入。收合後新增重新展開，移除最後一筆隱藏切換入口。
- 標題切換入口無常駐外框，受測尺寸的標題與筆數不溢出；原標題在手機替換後不重複顯示。新增時筆數由 1 更新至 2，展開／收合的小箭頭及 aria-expanded 一致，鍵盤焦點可見。
- 數量驗證不符時展開兩個物品區塊，修正後恢復；四個區塊的名稱／描述錯誤也自動展開。編輯頁原有物品、獎勵與快照標籤可見。
- 390→601→390px 切換保留所有輸入與收合狀態，寬視窗顯示完整內容。
- 無前端執行錯誤，無非 GET API 請求。

390×844px 倉庫的第一件永久物品由 746px 提前至 676px，首屏可閱讀更多清單內容。長表單總高度會受原有備註自動增高影響，因此不把單次整頁截圖的高度差當成固定縮短數值。

## 桌機對照與證據

倉庫、新增冒險與編輯冒險在 601／768／1280px，共 9 張首屏截圖 SHA-256 一致。另以相同資料比較兩種冒險表單的完整卡片、所有 textarea 與動作列幾何，6 組位置及尺寸完全一致。

2026-10-09 使用者驗收修正後，重新確認 601／768／1280px 的 6 組完整冒險表單量測仍與原始基準一致；手機切換按鈕在寬視窗隱藏，輸入與收合狀態在往返切換後保留。

同日完成標題入口簡化後再次通過上述 6 組桌機量測、48 組手機條件、64 項測試及無警告 production build。

完整頁面截圖中，備註欄的既有自動增高在擷取時機不同時可能造成畫面差異；不宣稱全部整頁 PNG 像素一致。首屏比對與完整元素量測分開記錄。

本機證據位於忽略的 `output/playwright/`：

- [手機倉庫](../../../../output/playwright/mobile-sections-after/inventory-390.png)、[新增冒險](../../../../output/playwright/mobile-sections-after/adventure-new-390.png)、[編輯冒險](../../../../output/playwright/mobile-sections-after/adventure-edit-390.png)。
- 標題切換預覽：[空白](../../../../output/playwright/mobile-section-heading-empty.png)、[展開](../../../../output/playwright/mobile-section-heading-expanded.png)、[收合](../../../../output/playwright/mobile-section-heading-collapsed.png)。
- `mobile-sections-viewport-before/`、`mobile-sections-viewport-after/`：9 組桌機首屏對照。
- `mobile-sections-desktop-results.json`：6 組完整表單量測。
- `mobile-sections-revision-desktop-results.json`：驗收修正後 6 組完整表單量測。
- `mobile-sections-results.json`：48 組手機結果及互動紀錄。
- `mobile-sections-check.cjs`：虛構 API、互動與尺寸切換檢查；`mobile-sections-desktop.cjs`：桌機對照；`mobile-sections-preview.cjs`：手機畫面。

功能量測使用系統後備字體避免外部字體載入干擾；畫面對照保留原有字體。200% 是根字級模擬，不代表裝置系統文字縮放。上述自動驗證未涵蓋實機 iOS／Android、軟鍵盤、安全區及螢幕閱讀器。

## 使用者驗收

2026-10-09 使用者回覆「驗收OK」，本次手機排版改善驗收完成，包含空白區塊不提供切換、有明細後以小箭頭＋標題＋筆數切換的修正。本 change 與第一批 `improve-mobile-layout-density` 一併封存；驗收確認不額外推定裝置或測試範圍。v1.3.0 發布依 VERSIONING.md 及後續發布指示執行。

## 發布前驗證

2026-10-09 前後端產品版號與鎖定檔同步為 1.3.0 後，重新通過前端 production build、10 個測試檔共 64 項測試、8 份 OpenSpec 主規格及版本一致性檢查。後端 `mvnw.cmd clean package -DskipTests` 打包成功；此命令略過後端測試，不記為後端測試通過。畫面版號沿用 package.json 綁定。
