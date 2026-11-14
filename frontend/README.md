# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
# 視覺回歸測試

在 Windows、Node 22 執行，使用 lockfile 固定的 Chromium 及字型。測試自動啟動 4300 port 的 Angular，API 與登入使用虛構資料。

```powershell
npm ci
npx playwright install chromium
npm run test:visual
npm run test:visual:report
```

134 組案例涵蓋角色、冒險、倉庫兩類分頁及共用導覽，包含明暗主題、320／390／600／601／768／769／1440px、長名稱與空資料。消耗品另涵蓋消耗視窗、庫存紀錄展開、操作選單、編輯與撤銷確認、物品編輯，使用 390／1440px 及雙主題。另量測水平溢出、手機排序滿寬與桌機倉庫排序靠右。基準存於 `visual-tests/snapshots`。

確認畫面調整符合需求後，可用 `npm run test:visual:update -- --grep <案例名稱>` 更新指定基準。逐張檢查差異後再納入版本控制，避免直接接受意外回歸。一般測試遇到差異或缺少基準會失敗，報告在 `playwright-report`，失敗 trace 在 `test-results`。

目前採本地手動執行，熟悉工具後再評估 CI 整合。其他作業系統的字型光柵化可能不同，請以 Windows 比較基準。瀏覽器及字型升級也需要審查基準。這些測試使用模擬 API，後端整合、其他瀏覽器及實機驗收另行執行。
