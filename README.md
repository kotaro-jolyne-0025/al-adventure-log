# 冒險紀錄表 Web版

將 D&D 冒險聯盟（AL）紙本冒險記錄表數位化，提供可搜尋、結構化的網頁應用程式，支援 PWA（可安裝至桌面）。

🌐 **線上使用：[aladvlog.com](https://aladvlog.com/)**

## 技術選型

| 層級 | 技術 | 部署位置 |
| --- | --- | --- |
| 前端 | Angular 22 + PWA | Firebase Hosting |
| 後端 | Spring Boot 4.1（Java 17） | GCP Cloud Run (`asia-east1`) |
| 資料庫 | PostgreSQL | Supabase |
| API 風格 | REST | — |

## 專案結構

```
dnd-adventure-log/
├── frontend/        # Angular 前端專案
├── backend/         # Spring Boot 後端專案
├── openspec/        # 功能規格與任務管理（OpenSpec）
├── .github/         # GitHub Actions CI/CD（前端自動部署）
├── system-requirements-spec.md
├── database-schema.md
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
npm start
```

前端預設執行於：<http://localhost:4200>

### 後端

```bash
cd backend
./mvnw spring-boot:run
```

後端預設執行於：<http://localhost:8080>

## 環境變數設定（後端）

在 `backend/src/main/resources/` 建立 `application-local.properties`：

```properties
spring.datasource.url=jdbc:postgresql://<supabase-host>:5432/postgres
spring.datasource.username=<username>
spring.datasource.password=<password>
```

> ⚠️ 此檔案含機密資訊，已加入 `.gitignore`，請勿 commit。

## 部署

| 層級 | 觸發方式 |
| --- | --- |
| **前端** | push `main` 且 `frontend/**` 有變更 → GitHub Actions 自動部署至 Firebase Hosting |
| **後端** | push `main` → GCP Cloud Build Trigger 自動 Build → Push → Deploy 至 Cloud Run |

後端部署憑證與基礎設施設定由 GCP Console 管理，不存入 repo。

## 功能範圍

- **會員系統**：Email 註冊／登入、密碼重設
- **多角色管理**：建立、編輯、刪除角色，支援職業/等級動態列（多職業混職）
- **冒險紀錄表 CRUD**：新增、編輯、刪除、查看冒險記錄
- **變化式帳本**：玩家只輸入本次變化；起始值依遊玩日期的前置快照由後端計算，補登不改寫後續快照
- **資源合計自動計算**：合計 ＝ 起始 ＋ 冒險中變化 ＋ 休整期變化，由後端計算
- **冒險升級系統**：記錄時可標記本次升級職業，自動更新角色職業等級
- **迎頭趕上升級**：支援消耗休整期天數進行額外升級（catchup），可指定職業與次數
- **職業快照**：每筆冒險記錄儲存起始/結束時的職業等級快照，供詳情頁準確顯示
- **職業識別**：資料庫與 API 使用英文職業識別值，前端依對照表顯示中文譯名
- **角色目前值**：角色頁直接讀取 character 的累計職業、金幣、休整期與倉庫永久物品數
- **物品來源**：已確認的來源標示為「冒險獲得」或「休整期獲得」；手動與舊資料可保持未標示
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
