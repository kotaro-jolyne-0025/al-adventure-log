import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './visual-tests',
  snapshotPathTemplate: '{testDir}/snapshots/{testName}/{arg}{ext}',
  fullyParallel: true,
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  updateSnapshots: 'none',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    browserName: 'chromium',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  webServer: {
    command: 'npm run start -- --host 127.0.0.1 --port 4300',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
