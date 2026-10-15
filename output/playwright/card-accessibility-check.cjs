// Run with a local frontend on :4200 and PREVIEW_PLAYWRIGHT_PATH pointing to Playwright.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4200';
const character = {
  id: 'preview', characterName: '銀月森林的冒險者艾莉絲與遠方旅伴',
  race: '來自銀月森林的高等精靈', subclass: '奧術秘法與遠古誓言的守護者',
  faction: '豎琴手同盟與遠方旅伴的聯合派系', currentClassesString: 'Wizard8/Fighter4/Cleric2',
  initialClassesString: 'Wizard1', initialGold: 0, initialDowntime: 0,
  currentGold: 10, currentDowntime: 5, currentMagicItems: 1,
};
const adventure = {
  id: 'entry', characterId: 'preview', adventureName: '銀月森林冒險', playDate: '2026-10-01',
  adventureCode: 'PREVIEW-01', dmName: '測試 DM', startingLevel: 1, endingLevel: 2,
  goldChange: 10, downtimeChange: 5, magicItemsChange: 1, storyAwards: [], gainedItems: [],
  downtimeActivities: [], createdAt: '2026-10-01T00:00:00Z',
};
const items = ['PERMANENT', 'CONSUMABLE'].map((itemType, i) => ({
  id: 'item-' + i, characterId: 'preview', itemType, itemName: i ? '治療藥水' : '月光長劍',
  rarity: 'UNCOMMON', quantity: 1, source: '測試冒險', notes: '虛構資料',
  createdAt: '2026-10-01T00:00:00Z',
}));
const user = { id: 'preview-user', email: 'preview@example.invalid', displayName: '測試玩家' };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(({ user }) => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('dnd_auth_token', 'preview.' + payload + '.preview');
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
    localStorage.setItem('dnd_theme', 'light');
  }, { user });
  await context.route('**/api/**', async route => {
    const request = route.request();
    if (!['GET', 'OPTIONS'].includes(request.method())) writes.push(request.method());
    const pathname = new URL(request.url()).pathname;
    let data;
    if (pathname.endsWith('/auth/me')) data = user;
    else if (pathname === '/api/characters') data = [character];
    else if (pathname === '/api/characters/preview') data = character;
    else if (pathname === '/api/characters/preview/entries') data = [adventure];
    else if (pathname === '/api/entries/entry') data = adventure;
    else if (pathname === '/api/characters/preview/inventory') data = items;
    else if (pathname.includes('/inventory/item-')) data = items.find(item => pathname.endsWith(item.id));
    else data = [];
    await route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
  });
  async function open(path, selector, theme = 'light') {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await page.locator(selector).first().waitFor();
    await page.evaluate(theme => window.ng.getComponent(document.querySelector('app-root')).themeService.setTheme(theme), theme);
  }
  async function tabTo(selector) {
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(selector => document.activeElement.matches(selector), selector)) return;
    }
    throw new Error('Tab cannot reach ' + selector);
  }
  async function focusCheck(selector, cardSelector) {
    await tabTo(selector);
    const result = await page.locator(cardSelector || selector).first().evaluate(element => {
      const css = getComputedStyle(element);
      const active = document.activeElement;
      return { outline: css.outlineStyle, width: parseFloat(css.outlineWidth),
        href: active.getAttribute('href'), label: active.getAttribute('aria-label'),
        visible: active.matches(':focus-visible'), nested: active.querySelectorAll('button,a').length };
    });
    assert.equal(result.outline, 'solid');
    assert.ok(result.width >= 3);
    assert.ok(result.href && result.label && result.visible);
    assert.equal(result.nested, 0);
  }
  const layout = [];
  try {
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await open('/characters', '.char-card');
      for (const scale of [1, 2]) {
        await page.evaluate(scale => document.documentElement.style.fontSize = 16 * scale + 'px', scale);
        const result = await page.locator('.char-card').evaluate(card => {
          const rect = card.getBoundingClientRect();
          const footer = card.querySelector('.card-footer').getBoundingClientRect();
          const content = card.querySelector('.char-content-col').getBoundingClientRect();
          const elements = [...card.querySelectorAll('.info-label,.info-value,.level-badge')];
          const text = [...elements, card.querySelector('.char-name')];
          return { minimumFont: Math.min(...elements.map(el => parseFloat(getComputedStyle(el).fontSize))),
            noClipping: text.every(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1),
            noOverlap: content.bottom <= footer.top,
            contained: rect.left >= 0 && rect.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth,
            height: rect.height };
        });
        assert.ok(result.minimumFont >= 14 * scale);
        assert.ok(result.noClipping && result.noOverlap && result.contained, JSON.stringify({ width, scale, ...result }));
        layout.push({ width, scale, ...result });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const cases = [
      { path: '/characters', card: '.char-card', link: '.char-card .card-navigation-link', target: '/characters/preview/adventures', edit: '.footer-action-btn:not(.delete-btn)', delete: '.delete-btn', editTarget: '/characters/preview/edit' },
      { path: '/characters/preview/adventures', card: '.chronicle-card.navigation-card', link: '.chronicle-card.navigation-card', target: '/characters/preview/adventures/entry' },
      { path: '/characters/preview/inventory', card: '.item-row-card:not(.consumable-row-card)', link: '.item-row-card:not(.consumable-row-card) .card-navigation-link', target: '/characters/preview/inventory/item-0/edit', edit: '.action-btn:not(.delete-btn)', delete: '.delete-btn' },
      { path: '/characters/preview/inventory', tab: true, card: '.consumable-row-card', link: '.consumable-row-card .card-navigation-link', target: '/characters/preview/inventory/item-1/edit', edit: '.action-btn:not(.delete-btn)', delete: '.delete-btn' },
    ];
    let navigationCases = 0;
    for (const theme of ['light', 'dark']) {
      await open('/characters/preview/adventures', '.chronicle-card', theme);
      await focusCheck('.brand-container');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/characters');
      for (const test of cases) {
        async function reset() {
          await open(test.path, test.tab ? '.item-row-card' : test.card, theme);
          if (test.tab) {
            await page.locator('app-inventory-list').getByRole('tab').nth(1).click();
            await page.locator(test.card).waitFor();
          }
        }
        await reset();
        await focusCheck(test.link, test.card);
        await page.keyboard.press('Enter');
        await page.waitForURL('**' + test.target);
        await reset();
        const popupPromise = context.waitForEvent('page');
        await page.locator(test.link).click({ modifiers: ['Control'] });
        const popup = await popupPromise;
        await popup.waitForURL('**' + test.target);
        await popup.close();
        assert.equal(new URL(page.url()).pathname, test.path);
        await page.locator(test.card).click({ position: { x: 8, y: 8 } });
        await page.waitForURL('**' + test.target);
        if (test.edit) {
          for (const keyboard of [true, false]) {
            await reset();
            const editSelector = test.card + ' ' + test.edit;
            if (keyboard) { await tabTo(editSelector); await page.keyboard.press('Enter'); }
            else await page.locator(editSelector).click();
            await page.waitForURL('**' + (test.editTarget || test.target));
            await reset();
            const deleteSelector = test.card + ' ' + test.delete;
            if (keyboard) { await tabTo(deleteSelector); await page.keyboard.press('Enter'); }
            else await page.locator(deleteSelector).click();
            await page.getByRole('dialog').waitFor();
            assert.equal(new URL(page.url()).pathname, test.path);
            if (keyboard) {
              await tabTo('[role="dialog"] mat-dialog-actions button:first-child');
              assert.equal((await page.locator(':focus').innerText()).trim(), '取消');
              await page.keyboard.press('Enter');
            } else await page.getByRole('button', { name: '取消', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            assert.equal(new URL(page.url()).pathname, test.path);
          }
        }
        navigationCases++;
      }
    }
    await open('/characters', '.char-card');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.screenshot({ path: 'output/playwright/readable-character-card-320.png', fullPage: true });
    await page.evaluate(() => document.documentElement.style.fontSize = '32px');
    await page.screenshot({ path: 'output/playwright/readable-character-card-320-large-text.png', fullPage: true });
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ layout, navigationCases, themes: ['light', 'dark'], independentActions: 'keyboard and mouse', writes, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
