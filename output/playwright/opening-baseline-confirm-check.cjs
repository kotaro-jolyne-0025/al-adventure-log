// Local UI verification with intercepted API requests; no real data is written.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4200';
const user = { id: 'preview-user', email: 'preview@example.invalid', displayName: '測試玩家' };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark'])
      for (const scale of [1, 2]) for (const hasAdventureEntries of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const character = { id: 'preview', characterName: '確認測試角色', race: 'Human',
          initialClassesString: 'Fighter5', currentClassesString: 'Fighter5',
          initialGold: 10, currentGold: hasAdventureEntries ? 60 : 10,
          initialDowntime: 2, currentDowntime: 2, hasAdventureEntries };
        let updates = 0;
        let previews = 0;
        await context.addInitScript(({ user, theme }) => {
          localStorage.setItem('dnd_auth_token', 'preview.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.preview');
          localStorage.setItem('dnd_auth_user', JSON.stringify(user));
          localStorage.setItem('dnd_theme', theme);
        }, { user, theme });
        await context.route('**/api/**', async route => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          let data = [];
          if (request.method() === 'POST' && path.endsWith('/opening-baseline-preview')) {
            previews++;
            data = { currentClassesString: 'Fighter5', currentGold: 100, currentDowntime: 2 };
          } else if (request.method() === 'PUT' && path === '/api/characters/preview') {
            updates++;
            assert.equal(request.postDataJSON().initialGold, 50);
            data = { ...character, ...request.postDataJSON(), currentGold: hasAdventureEntries ? 100 : 50 };
          } else {
            assert.equal(request.method(), 'GET', request.url());
            data = path.endsWith('/auth/me') ? user : path === '/api/characters/preview' ? character : [];
          }
          await route.fulfill({ json: data });
        });
        await page.goto(origin + '/characters/preview/edit');
        const gold = page.locator('input[formcontrolname="initialGold"]');
        await gold.waitFor();
        await page.waitForFunction(() => document.querySelector('input[formcontrolname="initialGold"]').value === '10');
        await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale}px`, scale);
        await gold.fill('50');
        const save = page.getByRole('button', { name: '儲存變更', exact: true });
        const dialog = page.getByRole('dialog');
        await save.click();
        await dialog.waitFor();
        const cancel = dialog.getByRole('button', { name: '繼續編輯', exact: true });
        const confirm = dialog.getByRole('button', { name: '確認儲存', exact: true });
        await page.waitForFunction(() => document.activeElement?.textContent.trim() === '繼續編輯');
        await dialog.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
        assert.match(await dialog.innerText(), /既有冒險及倉庫物品不會自動修改/);
        assert.equal((await dialog.innerText()).includes('金幣：60 金 → 100 金'), hasAdventureEntries);
        assert.equal(updates, 0);
        const layout = await dialog.evaluate(el => {
          const box = el.getBoundingClientRect();
          const content = el.querySelector('mat-dialog-content');
          const p = content.querySelector('p');
          return { left: box.left, right: box.right, bottom: box.bottom,
            contentOverflow: content.scrollWidth > content.clientWidth + 1,
            whiteSpace: getComputedStyle(p).whiteSpace,
            buttons: [...el.querySelectorAll('button')].map(button => {
              const rect = button.getBoundingClientRect();
              return { top: rect.top, bottom: rect.bottom, height: rect.height, right: rect.right };
            }) };
        });
        assert.ok(layout.left >= 0 && layout.right <= width + 1, JSON.stringify(layout));
        assert.ok(!layout.contentOverflow && layout.whiteSpace === 'pre-line', JSON.stringify(layout));
        assert.ok(layout.buttons.every(b => b.top >= 0 && b.bottom <= 900 && b.right <= width + 1));
        if (width <= 390) assert.ok(layout.buttons.every(b => b.height >= 43.9), JSON.stringify(layout));
        if (width === 320 && scale === 1 && hasAdventureEntries) {
          await page.screenshot({ path: `output/playwright/opening-baseline-confirm-${theme}.png` });
        }
        await page.keyboard.press('Enter'); // Safe default: continue editing.
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(updates, 0);
        assert.equal(await gold.inputValue(), '50');
        await save.click();
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(updates, 0);
        await save.click();
        await dialog.waitFor();
        await confirm.focus();
        await page.keyboard.press('Space');
        await page.waitForURL('**/characters/preview/adventures');
        assert.equal(updates, 1);
        assert.equal(previews, hasAdventureEntries ? 3 : 0);
        assert.deepEqual(errors, []);
        results.push({ width, theme, scale, hasAdventureEntries, updates, previews, layout });
        await context.close();
      }
    fs.writeFileSync('output/playwright/opening-baseline-confirm-results.json', JSON.stringify(results, null, 2));
    console.log(`${results.length} UI cases passed: layout, keyboard cancellation, preserved edits, preview and one confirmed update.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
