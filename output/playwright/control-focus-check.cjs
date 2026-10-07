// Run with the local frontend and PREVIEW_PLAYWRIGHT_PATH pointing to Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4200';
const user = { id: 'preview-user', email: 'preview@example.invalid', displayName: '測試玩家' };
const character = { id: 'preview', characterName: '焦點測試角色', initialClassesString: 'Wizard1', currentClassesString: 'Wizard1', currentGold: 10, currentDowntime: 5, currentMagicItems: 1 };
const adventure = { id: 'entry', characterId: 'preview', adventureName: '測試冒險', playDate: '2026-10-01', adventureCode: 'PREVIEW', dmName: '測試 DM', goldChange: 10, downtimeChange: 5, magicItemsChange: 1, storyAwards: [], gainedItems: [], createdAt: '2026-10-01T00:00:00Z' };
const items = [{ id: 'item-0', characterId: 'preview', itemType: 'PERMANENT', itemName: '測試長劍', rarity: 'UNCOMMON', quantity: 1, source: '測試冒險', createdAt: '2026-10-01T00:00:00Z' }];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(user => {
    localStorage.setItem('dnd_auth_token', 'preview.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.preview');
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
    localStorage.setItem('dnd_theme', 'light');
  }, user);
  await context.route('**/api/**', async route => {
    assert.equal(route.request().method(), 'GET');
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me') ? user
      : path === '/api/characters' ? [character]
      : path === '/api/characters/preview' ? character
      : path.endsWith('/entries') ? [adventure]
      : path.endsWith('/inventory') ? items : [];
    await route.fulfill({ json: data });
  });
  async function tabTo(selector) {
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(selector => document.activeElement.matches(selector), selector)) return;
    }
    throw new Error('Tab cannot reach ' + selector);
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function checkFocus(selector, container = selector) {
    await tabTo(selector);
    await page.locator(container).first().scrollIntoViewIfNeeded();
    const result = await page.locator(container).first().evaluate(el => {
      const css = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const outside = Math.max(0, parseFloat(css.outlineOffset) + parseFloat(css.outlineWidth));
      let contained = rect.left - outside >= 0 && rect.right + outside <= innerWidth;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
          contained &&= rect.left - outside >= box.left - 1 && rect.right + outside <= box.right + 1;
        }
        if (style.overflowY === 'hidden' || style.overflowY === 'clip') {
          contained &&= rect.top - outside >= box.top - 1 && rect.bottom + outside <= box.bottom + 1;
        }
      }
      return { style: css.outlineStyle, width: parseFloat(css.outlineWidth), color: css.outlineColor,
        visible: document.activeElement.matches(':focus-visible'), contained };
    });
    assert.equal(result.style, 'solid', container);
    assert.equal(result.width, 3, container);
    assert.ok(result.visible && result.contained, JSON.stringify({ selector, ...result }));
    return result;
  }
  const results = [];
  try {
    for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
      for (const name of ['adventures', 'inventory']) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(origin + '/characters/preview/' + name, { waitUntil: 'domcontentloaded' });
        const root = name === 'adventures' ? 'app-adventure-list' : 'app-inventory-list';
        await page.locator(root + ' .search-input').waitFor();
        await page.evaluate(theme => window.ng.getComponent(document.querySelector('app-root')).themeService.setTheme(theme), theme);
        const control = suffix => root + ' ' + suffix;
        const select = page.locator(control('.invisible-native-select'));
        const focus = await checkFocus(control('.invisible-native-select'), control('.select-section'));
        await press('Home');
        await press('ArrowDown');
        assert.equal(await select.inputValue(), 'createdAt');
        assert.match(await page.locator(control('.select-section .capsule-text')).innerText(), name === 'adventures' ? /建立時間/ : /取得時間/);
        await checkFocus(control('.button-section'));
        const before = await page.locator(control('.button-section')).innerText();
        await press('Space');
        assert.notEqual(await page.locator(control('.button-section')).innerText(), before);
        await checkFocus(control('.search-input'), control('.search-bar'));
        await page.keyboard.type('no-result-preview');
        await page.locator(control('.link-btn')).waitFor();
        await checkFocus(control('.search-clear-btn'));
        assert.equal(await page.locator(control('.search-bar')).evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        assert.ok(await page.locator(control('.search-bar')).evaluate(el => el.classList.contains('search-bar--active')));
        await press('Enter');
        assert.equal(await page.locator(control('.search-input')).inputValue(), '');
        await checkFocus(control('.search-input'), control('.search-bar'));
        await page.keyboard.type('no-result-preview');
        await checkFocus(control('.link-btn'));
        await press('Space');
        assert.equal(await page.locator(control('.search-input')).inputValue(), '');
        if (name === 'inventory') {
          await checkFocus(control('.filter-chip'));
          await press('Space');
          assert.equal(await page.locator(control('.filter-chip')).first().getAttribute('aria-pressed'), 'true');
          assert.ok(await page.locator(control('.filter-chip')).first().evaluate(el => el.matches(':focus-visible')));
          assert.equal(await page.locator(control('.filter-chip')).first().evaluate(el => getComputedStyle(el).outlineWidth), '3px');
          await page.screenshot({ path: `output/playwright/control-focus-${theme}-${width}.png`, fullPage: true });
          await checkFocus(control('.filter-chip-clear'));
          await press('Enter');
          assert.equal(await page.locator(control('.filter-chip--active')).count(), 0);
          await checkFocus(control('.filter-chip--attune'));
          await press('Enter');
          assert.equal(await page.locator(control('.filter-chip--attune')).getAttribute('aria-pressed'), 'true');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        results.push({ width, theme, page: name, focus });
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('output/playwright/control-focus-results.json', JSON.stringify(results, null, 2));
    console.log(`Passed ${results.length} list/theme/viewport combinations: Tab, ArrowDown, Space, Enter, search, sort and filters.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
