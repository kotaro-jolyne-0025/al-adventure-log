# D&D 冒險日誌系統

將 D&D 冒險聯盟（AL）紙本冒險記錄表數位化，提供可搜尋、結構化的網頁應用程式，支援 PWA（可安裝至桌面）。

## 技術選型

| 層級 | 技術 |
|---|---|
| 前端 | Angular 22 + PWA |
| 後端 | Spring Boot 4.1（Java 17）|
| 資料庫 | PostgreSQL |
| API 風格 | REST |

## 專案結構

```
dnd-adventure-log/
├── frontend/        # Angular 前端專案
├── backend/         # Spring Boot 後端專案
└── README.md
```

## 本機開發環境需求

- Node.js 22+
- Angular CLI 22+
- Java 17+
- Maven 3.9+

## 本機啟動方式

### 前端
```bash
cd frontend
npm install
ng serve
```
前端預設執行於：http://localhost:4200

### 後端
```bash
cd backend
./mvnw spring-boot:run
```
後端預設執行於：http://localhost:8080

## 環境變數設定（後端）

在 `backend/src/main/resources/` 建立 `application-local.properties`：

```properties
spring.datasource.url=jdbc:postgresql://<supabase-host>:5432/postgres
spring.datasource.username=<username>
spring.datasource.password=<password>
```

> ⚠️ 此檔案含機密資訊，已加入 `.gitignore`，請勿 commit。

## 功能範圍（MVP）

- **多角色管理**：建立、編輯、刪除角色，支援職業/等級動態列（多職業混職）
- **冒險日誌 CRUD**：新增、編輯、刪除、查看冒險記錄
- **資源自動帶入**：新增記錄時，金幣、休整期天數、魔法物品起始值自動從上一筆帶入
- **資源合計自動計算**：合計 ＝ 起始 ＋ 冒險中變化 ＋ 休整期變化，由後端計算
- **冒險升級系統**：記錄時可標記本次升級職業，自動更新角色職業等級
- **迎頭趕上升級**：支援消耗休整期天數進行額外升級（catchup），可指定職業與次數
- **職業快照**：每筆冒險記錄儲存起始/結束時的職業等級快照，供詳情頁準確顯示
- **休整期活動管理**：可在冒險表單內直接新增休整期活動，不需另開頁面
- **PWA 支援**：可安裝至 Windows / Mac / 手機桌面，支援離線瀏覽快取



## ⚖️ 授權與版權聲明 (License & Legal)

### 開源授權 (CC BY-NC-SA 4.0)
本專案原始碼採用 **[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)** 授權條款。
- **姓名標示 (Attribution)**：您必須標示原作者（Kiran / 可嵐）。
- **非商業性 (NonCommercial)**：您**不得**將本專案用於商業目的（包含但不限於：收費服務、販售程式碼、或設立付費牆）。
- **相同方式分享 (ShareAlike)**：若您修改或建立衍生作品，必須採用與本專案相同的 CC BY-NC-SA 4.0 授權公開您的原始碼。

### 威世智同好內容政策 (WotC Fan Content Policy)
本專案為非官方的同好內容（Fan Content），遵循 [威世智同好內容政策 (Fan Content Policy)](https://company.wizards.com/zh-Hant/legal/fancontentpolicy) 建立。
- 本專案未經威世智（Wizards of the Coast）核准或贊助。
- 本專案所使用的部分材料為威世智之財產。©Wizards of the Coast LLC.
