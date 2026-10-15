# 冒險紀錄表 Web版

**把每次冒險的經歷與收穫，整理成隨時能查看的角色紀錄。**

這是一個為 Dungeons & Dragons（龍與地下城）冒險者聯盟（Adventurers League，簡稱 AL）玩家製作的繁體中文網頁工具。你可以管理自己的角色、記錄冒險經歷與戰利品，並查看目前的金幣、休整期、等級與物品。

用手機或電腦的瀏覽器就能使用，也可以安裝到主畫面，像 App 一樣開啟。

**線上使用：[aladvlog.com](https://aladvlog.com/)**

## 能幫你做什麼？

| 你想做的事         | 在這裡可以怎麼做                                                         |
| ------------------ | ------------------------------------------------------------------------ |
| 管理不同角色       | 記錄角色的種族、職業、等級與起始資源，支援多職業角色與自訂頭像           |
| 留下每次冒險的紀錄 | 填寫名稱、代碼、日期、DM（遊戲主持人）、備註與故事獎勵，之後可搜尋及排序 |
| 掌握角色的資源     | 記錄本次金幣、休整期及升級的變化，由系統計算合計，也能記錄休整期活動     |
| 整理戰利品         | 管理永久性魔法物品與消耗品的數量、稀有度、同調需求及來源，也能標記靈魂幣 |
| 填到一半稍後繼續   | 冒險表單提供本機草稿，回來時可選擇繼續編輯或捨棄                         |
| 在不同裝置查看     | 登入同一帳號，就能在手機與電腦查看已儲存的角色與紀錄                     |

例如，一次冒險得到 75 金幣、2 天休整期與一把魔法長弓，把這次的收穫填進紀錄，角色資源與倉庫也會跟著更新。

## 如何開始使用

1. 開啟 [aladvlog.com](https://aladvlog.com/)，註冊帳號或使用 Google／Discord 登入。
2. 在「我的角色」建立冒險者，填寫角色資訊，以及起始職業、等級、金幣與休整期。
3. 進入角色的「冒險紀錄表」，新增一筆冒險，記錄這次的變化與收穫。
4. 儲存後，可以回顧冒險紀錄，並在「倉庫」查看與管理物品。

### 手機安裝、離線查看與草稿

- **安裝到主畫面**：使用網站的安裝入口，或瀏覽器的「安裝應用程式／加入主畫面」。可用方式依瀏覽器而異。
- **離線查看**：沒有網路時，可以查看這台裝置已保留的資料副本。尚未載入過的資料不一定能開啟；新增、修改與刪除雲端資料需要連線。
- **草稿只留在目前的瀏覽器**：草稿不會同步到其他裝置，也不等於已儲存的冒險紀錄。清除瀏覽器資料可能移除草稿；若出現草稿保存失敗提示，請保留頁面上的輸入。

### 為什麼需要登入？資料放在哪裡？

登入讓系統辨識你的帳號，讓你管理自己的角色，也能在換手機或使用電腦時取得已儲存的紀錄。使用 Google／Discord 登入時，不需要把這些服務的密碼交給本站。

已儲存的角色與冒險紀錄放在雲端資料庫，存取時會檢查身分與資料歸屬。雲端資料已設定每日備份，並完成首次隔離還原驗證；只存在瀏覽器裡的草稿不在這份備份範圍內。個人資料的使用方式見網站的[隱私保護原則](https://aladvlog.com/legal#privacy)。

## 問題與回饋

使用上遇到問題或想提出建議，可以使用網站的「聯絡我」，或在 [GitHub Issues](https://github.com/kotaro-jolyne-0025/al-adventure-log/issues) 提出。附上操作步驟、裝置、瀏覽器與截圖，有助於釐清問題；公開截圖前請遮住個人資訊。

已發布版本的更新摘要見 [GitHub Releases](https://github.com/kotaro-jolyne-0025/al-adventure-log/releases)。

## 授權與非官方聲明

自 v2.0.0 起，本專案原創程式碼採用 **PolyForm Noncommercial License 1.0.0**，供非商業目的使用、修改與分享。商業利用須另取得權利人許可；允許用途、例外與散布要求以 [LICENSE](LICENSE) 完整條款為準，作者與適用範圍見 [NOTICE](NOTICE)。先前以 CC BY-NC-SA 4.0 發布的版本維持原授權。

第三方套件、官方內容與商標，以及玩家自行提供的內容，仍依各自的權利與授權處理。

本專案為非官方同好內容，未經威世智（Wizards of the Coast）核准或贊助。所使用的部分材料為威世智之財產。© Wizards of the Coast LLC。相關聲明見 [NOTICE](NOTICE) 與[威世智同好內容政策](https://company.wizards.com/zh-Hant/legal/fancontentpolicy)。

## 給開發者

### 架構與環境

| 層級   | 技術                                                | 正式環境                  |
| ------ | --------------------------------------------------- | ------------------------- |
| 前端   | Angular 22、Standalone Components、Signals、PWA     | Firebase Hosting          |
| 後端   | Spring Boot 4.1、Java 17、MyBatis、Flyway、REST API | GCP Cloud Run             |
| 資料庫 | PostgreSQL                                          | Supabase                  |
| 備份   | GitHub Actions、OIDC、`pg_dump`／`pg_restore`       | 私有 Google Cloud Storage |

本機需要 Node.js 22.22.3+（22.x）或 24.15.0+（24.x）、JDK 17，以及獨立的 PostgreSQL 開發資料庫。

### 本機設定與指令

在 `backend/src/main/resources/application-local.properties` 設定資料庫及 JWT 金鑰；此檔案已加入 `.gitignore`，`local` 是預設 profile：

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/dnd_adventure_log
spring.datasource.username=<開發資料庫帳號>
spring.datasource.password=<開發資料庫密碼>
app.jwt.secret=<自行產生的隨機簽章金鑰，至少 32 bytes>
```

後端啟動時會執行 Flyway migration。OAuth 與 SMTP 選填設定見 [application.properties](backend/src/main/resources/application.properties)；使用第三方登入或重設密碼郵件前，需配置對應服務。

| 工作目錄    | 啟動                                  | 建置                         | 測試                        |
| ----------- | ------------------------------------- | ---------------------------- | --------------------------- |
| `frontend/` | 首次執行 `npm ci`，再執行 `npm start` | `npm run build`              | `npm test -- --watch=false` |
| `backend/`  | `./mvnw spring-boot:run`              | `./mvnw package -DskipTests` | `./mvnw test`               |

Windows 使用 `./mvnw.cmd`。前端預設為 `http://localhost:4200`，後端為 `http://localhost:8080`；Angular CLI 與 Maven Wrapper 已隨專案提供。

前端的 API 網址與 OAuth Client ID 位於 [environment.ts](frontend/src/environments/environment.ts) 和 [environment.prod.ts](frontend/src/environments/environment.prod.ts)。本機預設呼叫 `http://localhost:8080/api`，正式站以 Firebase Hosting 將 `/api/**` 轉送至 Cloud Run。自行架設時需調整這些設定及後端允許的來源網址。

### 開發與維運文件

| 文件                                                       | 用途                             |
| ---------------------------------------------------------- | -------------------------------- |
| [系統需求規格書](system-requirements-spec.md)              | 欄位、業務規則與介面行為         |
| [資料庫綱要](database-schema.md)                           | 表結構與 migration 說明          |
| [OpenSpec](openspec/)                                      | 主規格、變更設計與任務追蹤       |
| [備份與復原規格](openspec/specs/database-recovery/spec.md) | 備份範圍、隔離還原與啟用驗證要求 |
| [VERSIONING.md](VERSIONING.md)                             | 版本同步、PR、部署確認與發布流程 |

### 部署與備份

| 流程       | 入口與觸發方式                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 前端部署   | [`deploy-frontend.yml`](.github/workflows/deploy-frontend.yml)：`main` 的 `frontend/**` 變更觸發 Firebase Hosting 部署                     |
| 後端部署   | GCP Cloud Build Trigger：`main` 的 `backend/**` 變更觸發 Cloud Run 部署                                                                    |
| 資料庫備份 | [`database-backup.yml`](.github/workflows/database-backup.yml)：每日 UTC 03:17（台灣 11:17），也支援手動執行                               |
| 隔離還原   | [`database-restore-drill.yml`](.github/workflows/database-restore-drill.yml)：手動指定備份物件，在無網路的臨時 PostgreSQL 容器中還原與檢查 |

備份匯出本應用程式的 `public` schema。自行啟用時，在只允許 `main` 分支的 `database-backups` GitHub environment 設定 `GCP_BACKUP_BUCKET`、`GCP_WORKLOAD_IDENTITY_PROVIDER`、`GCP_BACKUP_SERVICE_ACCOUNT` 三個 Variables，以及 `DB_BACKUP_URL` Secret；另需配置私有 bucket、到期刪除規則及 OIDC 信任關係。

連線憑證與正式環境私人設定由各平台管理。建立新部署後，須成功執行一次備份與隔離還原，才能確認復原流程可用。
