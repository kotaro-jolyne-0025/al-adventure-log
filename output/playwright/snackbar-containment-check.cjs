// Local frontend only; all API requests are intercepted with fictional data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH || 'playwright');
const verify = process.argv.includes('--verify');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(7000);
  const user = { id: 'preview-user', email: 'preview@example.invalid', displayName: '測試玩家' };
  let characters = [];
  await page.addInitScript(user => {
    localStorage.setItem('dnd_auth_token', 'preview.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.preview');
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
  }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === 'DELETE') {
      assert.equal(pathname, '/api/characters/preview');
      characters = [];
      await route.fulfill({ status: 204 });
    } else await route.fulfill({ json: pathname.endsWith('/auth/me') ? user : characters });
  });
  const results = [];
  try {
    for (const width of [320, 360, 390, 600, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const scale of [1, 2]) {
        for (const theme of ['light', 'dark']) {
          characters = [{ id: 'preview', characterName: '銀月森林的冒險者艾莉絲' + 'LongUnbrokenCharacterName'.repeat(2), race: '精靈', currentClassesString: 'Wizard1' }];
          await page.goto((process.env.PREVIEW_URL || 'http://127.0.0.1:4200') + '/characters', { waitUntil: 'domcontentloaded' });
          await page.locator('.char-card').waitFor();
          await page.evaluate(({ scale, theme }) => {
            document.documentElement.style.fontSize = 16 * scale + 'px';
            window.ng.getComponent(document.querySelector('app-root')).themeService.setTheme(theme);
          }, { scale, theme });
          await page.locator('.char-card .delete-btn').click();
          if (verify) {
            const dialog = page.getByRole('dialog');
            await dialog.waitFor();
            await dialog.evaluate(async element => {
              await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
            });
            assert.ok(await dialog.evaluate(element => {
              const box = element.getBoundingClientRect();
              return box.left >= -1 && box.right <= innerWidth + 1;
            }), 'Confirmation dialog overflow');
          }
          await page.getByRole('button', { name: '確認刪除', exact: true }).click();
          const snack = page.locator('mat-snack-bar-container');
          await snack.waitFor();
          await snack.evaluate(async container => {
            await Promise.all(container.getAnimations({ subtree: true }).map(animation => animation.finished));
          });
          const result = await snack.evaluate(container => {
            const elements = [...container.querySelectorAll('.mdc-snackbar__surface,.mdc-snackbar__label,.mat-mdc-snack-bar-action')];
            return { contained: elements.every(el => {
              const box = el.getBoundingClientRect();
              return box.left >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
            }), labelClipped: elements.some(el => el.classList.contains('mdc-snackbar__label') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)),
            boxes: elements.map(el => ({ className: el.className, width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, minWidth: getComputedStyle(el).minWidth })) };
          });
          if (width === 320 && scale === 1 && theme === 'light') await page.screenshot({ path: 'output/playwright/delete-character-snackbar-' + (verify ? 'after' : 'before') + '.png', fullPage: true });
          if (verify) {
            assert.ok(result.contained && !result.labelClipped, JSON.stringify({ width, scale, theme, ...result }));
            assert.ok((await snack.innerText()).includes('已刪除角色'));
            await snack.getByRole('button', { name: '關閉', exact: true }).click();
            await snack.waitFor({ state: 'hidden' });
          }
          results.push({ width, scale, theme, ...result });
        }
      }
    }
    console.log(JSON.stringify({ cases: results.length, failures: results.filter(r => !r.contained || r.labelClipped).map(result => ({ width: result.width, scale: result.scale, theme: result.theme, contained: result.contained, labelClipped: result.labelClipped })), first: results[0] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
