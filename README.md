# D&D 冒險日誌系統

將 D&D 冒險聯盟（AL）紙本冒險記錄表數位化，提供可搜尋、結構化的網頁應用程式，支援 PWA（可安裝至桌面）。

## 技術選型

| 層級 | 技術 | 部署位置 |
|---|---|---|
| 前端 | Angular 22 + PWA | Google Cloud (Firebase Hosting 全球 CDN) |
| 後端 | Spring Boot 4.1（Java 17）| Google Cloud Run (asia-east1 台灣) |
| 資料庫 | PostgreSQL | Supabase（永久免費）|
| API 風格 | REST | — |

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

---

## 🚀 Zeabur 部署說明 (方案 A：後端原生 + 前端 Nginx 反代)

### 1. 後端 (Spring Boot - 原生建置)
1. 於 Zeabur 建立新服務，連結 GitHub repo，子目錄填寫 `backend`（Zeabur 自動以 Maven 原生打包啟動）。
2. 於後端服務的 **Variables** 設定：
   - `DB_URL` = `jdbc:postgresql://<supabase-host>:5432/postgres`
   - `DB_USERNAME` = `postgres.<id>`
   - `DB_PASSWORD` = `<supabase-password>`
3. 在後端服務的 **Networking（網路）** 設定內網存取（例如 `dnd-adventure-log-sideproject.zeabur.internal:8080`），後端**無需對外開放公網**。

### 2. 前端 (Angular + Nginx 反向代理)
1. 於 Zeabur 建立新服務，連結 GitHub repo，子目錄填寫 `frontend`（Zeabur 自動偵測 `frontend/Dockerfile` 進行兩階段建置）。
2. 於前端服務的 **Variables** 設定：
   - `BACKEND_URL` = 後端內網網址（例如 `http://dnd-adventure-log-sideproject.zeabur.internal:8080`）
3. 於前端服務的 **Networking（網路）** 綁定公開網域（例如 `https://adv-log.zeabur.app`）。


