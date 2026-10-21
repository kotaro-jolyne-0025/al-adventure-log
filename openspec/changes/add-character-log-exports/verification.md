# 匯出功能驗證（2026-10-18）

## Blob登入錯誤相容性修正（2026-10-21）

- 新增`auth.interceptor.spec.ts`，先以修改前的共用攔截器驗證：Blob的409 `AUTH_SESSION_CHANGED`與403 `CSRF_INVALID`兩例失敗，證實未觸發既有登入同步／CSRF更新。
- 攔截器僅對API的403／409 Blob非同步讀取JSON代碼，再沿用既有處理；回傳原始`HttpErrorResponse`及Blob，格式錯誤／讀取拒絕／同步讀取例外也不取代原錯誤。成功檔案及401不讀取Blob內容，不自動重送原下載或寫入。
- 解析後檢查原登入，排入佇列的CSRF更新執行前亦再確認；未登入的公開登入流程在仍未登入時保留CSRF恢復。新檔14項測試涵蓋上述情境、未知錯誤代碼、延遲讀取期間換帳號、佇列執行前換帳號、成功下載與公開登入JSON／Blob錯誤。
- `npm test -- --watch=false`：40個測試檔、252項全數通過；`npm run build` production通過，只有原有`heic2any` CommonJS提示。修正前亦已跑過匯出及帳本後端39項測試，全部通過；本次未修改後端，未重複執行後端測試。
- OpenSpec change與adventure-export主規格strict驗證及`git diff --check`通過。未實測瀏覽器跨分頁登入／下載，未commit、push或部署。

本輪只在本機及隔離的 Embedded PostgreSQL 使用合成資料；未連正式資料庫，未 commit、push 或部署。無 migration。功能入口為角色冒險列表的「匯出」選單。

驗證時的下載工具與中間產物使用已排除Git的 `tmp/export/`、`tmp/pdfs/`。這些暫存工具不屬於交付資源，清理不影響後端資源中的原版範本與靜態字型。

## 執行結果

| 驗證 | 結果 |
| --- | --- |
| 前端完整 `npm test -- --watch=false` | 38 個測試檔、238 項通過；最後新增 generation 競態案例後，另跑匯出服務測試8項全數通過 |
| 前端 `npm run build` | production build 通過；只有原有 `heic2any` CommonJS 提示 |
| 後端 `./mvnw.cmd -q clean test package` | 28 個測試類別、188 項通過，產出可執行 JAR |
| 最後修正後端回歸 | `-Dtest=AdventureExportIntegrationTest,AdventureExportControllerTest test package`，9項通過；新增缺日期相鄰紀錄案例；JAR 已重新產出 |
| OpenSpec | change strict 驗證及14個主規格驗證通過 |
| Git | `git diff --check` 通過；未操作版本歷史 |

本機 IDE 曾在 Maven 輸出目錄留下不相容的 Lombok 產物，clean build 後恢復；新增的匯出服務與 controller 使用明確建構子，最後增量測試／package 也通過，未變更 Java 17 版本。

## 資料、權限與並行

- 以 Spring proxy 實際執行唯讀 REPEATABLE READ，連同目前 `users.display_name`、角色摘要、活動、獎勵、歷史物品及相容倉庫一次組成快照。生成 PDF／XLSX 的類別沒有 mapper，controller 在交易返回後才產檔。
- 查詢最多5次：角色摘要、帳號顯示名稱、含完整活動與獎勵的冒險列表、同角色 owner-filtered 歷史物品批次、必要時的舊庫存。104筆排序案例仍只呼叫一次冒險列表及一次物品批次，沒有逐筆詳情／下一筆查詢。
- 實際 PostgreSQL 並行交易於讀取主表後提交角色、玩家名稱、物品數量、活動及庫存修改，正在進行的匯出仍全部看到舊版本；下一次匯出看到新版本。
- 驗證同日期／建立時間以ID穩定排序、缺日期置後；缺日期不當成已知日期的歷史繼承者。已存120.25金與下一筆80金均保留並提示不連續，不修補餘額。
- 明細為2項活動、3項獎勵，沒有互乘或漏項。歷史取得藥水4瓶、現庫存1瓶仍輸出4瓶；舊紀錄只顯示明確綁定的2瓶庫存參考，不把同名來源的未綁庫存認領進來。
- 比對讀前／讀後 `updated_at` 及快照筆數均不變；不存在及非本人角色拒絕、零筆400、未登入401、非法格式／角色識別碼400均通過。失敗回JSON而無附件標頭，沒有成功或部分檔案。
- 輸出只寫指定白名單，不包含 Email、JWT、OAuth資料、頭像、使用者ID、草稿或無關庫存；JSON錯誤不會被前端下載為文件。

## PDF 與列印

- PDFBox 3.0.8／Java17，直接使用原版資源。範本及原始提供檔 SHA-256 均為 `7f92c6298fa23f78ca2334a642b1f9552e0f039977e22c452c8d1c7fd3f5e3b9`；無修改原始檔。
- 1／3／4／7筆分別為1／1／2／3頁，最後未用區塊留白；各頁66欄、唯一欄名、Widget與正規欄位同一實體。重新開檔逐欄比對 `/V` 與 `/AP` 擷取文字一致，外觀非空，列印旗標開啟，`NeedAppearances=false`，保留AcroForm。
- Noto Sans TC與Noto Emoji靜態weight400、授權及來源隨資源提供；輸出兩種填寫字型均有嵌入的FontFile2，不依賴外部字型。常用繁中、拉丁、組合字與emoji渲染可讀；未支援字元明確回報，不默默以問號取代。
- Poppler150dpi逐頁渲染7筆／3頁樣本；扣除66個原欄位矩形後，三頁的畫素差異均為0。頁面原內容串流與範本一致，logo、水印、標籤與版權未重繪。
- 同一7筆樣本與XLSX逐筆比對代碼順序及已存合計；第一筆金幣總計120.25、淨變化+19.75，Excel拆為冒險+40與休整-20.25；後續樣本已改為承接前筆合計，不再重複第一筆起始值。
- 備註119／120／121及超長案例、中文／中英／組合字／emoji、必要警告、冒險與休整獲得、活動、故事獎勵均驗證。120字截尾樣本固定11pt三行，其他欄位不被侵占；捨棄內容沒有留在完整欄位值。生成樣本第一頁逐筆備註字素數為39、120、45。
- A4左右各10mm、寬度等比例85.49%的列印預覽已檢視；文字約9.4pt，三行baseline、末行省略號與靈魂幣專用小欄可見，沒有續頁。**未以實體印表機實測。**
- 樣張可由 `AdventureExportWritersTest` 加 `-Dexport.artifacts=true` 重新產生；`output/export/character-log.pdf` 與同名XLSX僅含合成資料。

## Excel

- Apache POI 5.5.1產生真正XLSX並重開，固定五張表，以本次冒險編號連結，明細附遊玩日期與冒險名稱；不輸出內部UUID、待補、技術性來源、模型版本、建立／更新時間、列類型、資料編號或續文輔助欄。冒險每筆一列，所有子明細完整。
- 驗證數值-20.25、零與空白不同、遊玩及匯出日期無時差、1800年日期保留ISO文字、凍結首列、篩選、換行、無合併資料列。取得方式、類型、稀有度、分類及是／否以中文顯示，缺值留空。使用者文字以STRING寫入，`= + - @`字串不會成為公式／超連結；原始輸出無外部關聯或巨集。
- 超過32,767 UTF-16單位的中文字、emoji與長文字，僅新增同列「原欄名（接續 2）」等內容欄，依序串接可完整重組。一般檔案無接續欄、不新增資料列或關聯輔助欄，不切開surrogate pair；全文隨同列排序，所有表共用相同處理。
- 移除ID之前的版本使用官方LibreOffice26.8.1.1的暫存解壓副本，以Calc headless實際開啟及重存驗證副本；五表所有資料值（含布林及日期）、篩選範圍與A2凍結均相符。重存副本不取代原始交付檔。
- Calc原生渲染各表範圍，檢視角色、冒險、物品、長活動及獎勵的中文、標題與換行。紙本排版以專用PDF驗證；未使用Microsoft Excel實機，未宣稱所有Excel版本已驗證。

### 修正版交付檔確認（本次）

- 使用者預覽仍顯示重複金額；本輪直接解開磁碟上的`character-log.xlsx`確認，七筆確實仍為100.50起始／120.25合計，不能只歸因於預覽快取，原因未確認。原檔保留，避免覆蓋可能已開啟編輯的內容。
- clean後重跑匯出產生器及controller測試19項全數通過，再以新檔名`output/export/character-log-corrected.xlsx`生成。實際重讀存檔的worksheet XML確認七筆依序為100.50→120.25、120.25→140.00、140.00→159.75、159.75→179.50、179.50→199.25、199.25→219.00、219.00→238.75；逐列驗證前筆合計等於後筆起始。
- 已在VS Code另開修正版檔案；這次交付以新檔名為準，未目視確認編輯器畫面，不以啟動命令成功當作畫面驗證。

### 樣張資源連續性修正（前一輪）

- 原先`AdventureExportWritersTest.sample`每筆重用100.50起始／120.25合計，屬於合成資料問題。現改為每筆起始承接前筆合計，金幣前3筆分別為100.50→120.25、120.25→140.00、140.00→159.75，第7筆結餘238.75；角色目前金幣同步為238.75，開卡金幣為100.50。樣本的休整期、永久物品及等級／職業起訖也承接前筆。
- `./mvnw.cmd -q -Dtest=AdventureExportWritersTest,AdventureExportControllerTest,AdventureExportIntegrationTest -Dexport.artifacts=true test`：24項全數通過。新增案例重新開啟Excel與PDF逐筆比對金幣起始／合計，確認資源連續及角色摘要與最後一筆一致；既有隔離資料庫案例仍驗證120.25與下一筆80原值保留並提示，不會在匯出時重算歷史。
- 已重新產生`output/export/character-log.xlsx`（9,254 bytes）及`character-log.pdf`（353,835 bytes）。只修改測試／樣張與驗證文件，正式讀寫及匯出產生器均未變更。
- 未目視重驗新版預覽或重跑前端／完整後端測試；未連正式資料庫、未commit、push或部署。

### 玩家閱讀版增量驗證（前一輪）

- `./mvnw.cmd -q -Dtest=AdventureExportWritersTest,AdventureExportControllerTest clean test`：18項全數通過。測試包括一般檔案沒有系統／接續欄、空工作表保留標題、中文分類及是／否、未知值留空、紀錄提醒及舊物品數量說明、日期／數值／公式安全，以及PDF與API回歸。
- 五張表的長文字、同日同名冒險、同筆冒險內同名物品／獎勵、多欄同時超長，均可從同列對應內容欄重組全文，不覆寫其他項目；篩選範圍涵蓋新增欄。正式冒險及子項目始終各一筆一列。
- 已重新產生並以POI重開 `output/export/character-log.xlsx`（9,215 bytes），五表資料列依序為1／7／7／7／7，欄數為15／26／13／4／5；確認無內部UUID、系統欄及接續欄。PDF樣張未改寫。
- 已用VS Code開啟新Excel樣張；未目視檢查本次預覽、未重跑Calc／前端／完整後端測試，未修改API、資料庫、PDF或正式環境。OpenSpec change／主規格strict檢查及`git diff --check`通過。

### 前一輪移除內部ID驗證（歷史紀錄，續文方案已由本次取代）

- `./mvnw.cmd -q -Dtest=AdventureExportWritersTest,AdventureExportControllerTest test`：17項全數通過，包含PDF既有產生器與API回歸。
- 新案例以同日同名冒險、同筆冒險內的同名物品／故事獎勵驗證編號對應；角色、冒險、物品、休整活動、故事獎勵五表的長文字均可從正確資料編號重組，所有標題與資料無系統UUID。既有日期／數值／空值／字串安全案例通過。
- 初版長文字測試資料過度重複，觸發POI的ZIP膨脹比例保護；改用固定seed產生的合成文字，保留換行與emoji並通過，未降低讀檔安全限制。
- 重新產生並以POI重開 `output/export/character-log.xlsx`（10,177 bytes），五表資料列依序為1／7／7／7／7，確認無ID標題及UUID。原PDF樣張未改寫。
- 已用VS Code開啟新Excel樣張；本次未目視檢查預覽，亦未重跑Calc、前端或完整後端測試。這次只修改Excel產生器、其測試與文件，未改API／資料讀取／PDF邏輯。
- change與adventure-export主規格的OpenSpec strict驗證通過，`git diff --check`通過。未commit、push或部署。

## 瀏覽器與生命週期

- Playwright CLI／Windows Chrome，僅登入隔離暫存帳號。桌面實際下載PDF及XLSX，UTF-8檔名保留；鍵盤Enter開啟、Escape返回、方向鍵選取及Enter下載均通過，焦點可回到匯出按鈕。
- 桌面1440×1000、窄視窗390×844、320px及根字級200%、深淺主題均檢視；匯出按鈕在窄畫面跨整列，觸控高度至少44px，沒有橫向頁面溢出。
- 模擬503後顯示可感知錯誤與重試，解除錯誤後下載成功；離線時停用並說明需要連線。`role=status`／`role=alert`及標準MatMenu語意已檢查，未做真實螢幕閱讀器朗讀測試。
- 服務／元件測試驗證搜尋不影響範圍、每次重新讀取、不重複送出、完成／失敗／取消恢復、帳號／角色／generation變更與銷毀丟棄晚到結果、非同步JSON錯誤解析後再次查核、URL使用後／失效／銷毀釋放。
- 繼續使用現有authInterceptor與401處理；ngsw仍無API dataGroups，未加入匯出快取或儲存副本。
- **未涵蓋：Android／iOS真機、已安裝PWA的原生檔案交付、Safari、真實輔助科技。窄視窗測試不等於手機真機。** 本機Google OAuth origin警告屬既有設定，沒有使用第三方登入或擴改此設定。

## 容量與可重現量測

```powershell
# backend/，使用測試fixture，不讀正式資料
./mvnw.cmd -q '-Dtest=AdventureExportWritersTest' '-Dexport.benchmark=true' '-DargLine=-Xmx384m' test
```

1,000筆冒險，每筆900字備註、600字活動；每格式使用同一完整快照，生成器關閉文件、字型與串流後再返回bytes。10ms取樣Java heap峰值（含測試JVM基準，非OS RSS）：

| 格式 | 完整筆數／頁數 | 時間 | 檔案大小 | 取樣heap峰值 |
| --- | --- | --- | --- | --- |
| PDF | 1,000筆／334頁 | 4,013ms | 8,636,715 bytes | 364.0MiB |
| XLSX | 1,000筆及完整明細 | 1,280ms | 319,235 bytes | 142.4MiB |

PDF最初逐欄重建表單清單約39秒，已改成一次設定；沒有以限制匯出筆數降低負載。查詢數固定，產檔期間不持有資料庫交易。

**已知限制：** 相同千筆PDF在256MiB heap測試失敗，384MiB通過；峰值接近此heap上限。此為本機單次產檔，沒有正式服務基準／原生記憶體或多個同時大量下載的容量保證。發布前須依應用程式基準及並發預留記憶體，不能假設512MiB總記憶體足夠。此次不調整正式部署，也未做正式環境壓測；不加入靜默截減、佇列或額外匯出選項。
