// Local UI integration check; all API data is fictional and requests are intercepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4200';
function sourceFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(dir + '/' + entry.name) : /\.(scss|html|ts)$/.test(entry.name) ? [dir + '/' + entry.name] : []); }
const styles = sourceFiles('frontend/src').map(file => fs.readFileSync(file, 'utf8')).join('\n');
const defined = new Set([...styles.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
const missingTokens = [...new Set([...styles.matchAll(/var\((--(?:bg|color|text|radius|border|rarity|safe-area|shadow|font)[\w-]*)/g)].map(match => match[1]))].filter(token => !defined.has(token));
assert.deepEqual(missingTokens, [], 'Undefined custom design tokens');
const longName = '銀月森林的冒險者與遠方旅伴'.repeat(3) + 'LongContinuousName'.repeat(5);
const user = { id: 'preview-user', email: 'preview@example.invalid', displayName: '測試玩家' };
const character = { id: 'preview', characterName: longName, race: '高等精靈', subclass: '奧術秘法守護者', faction: '豎琴手同盟', initialClassesString: 'Wizard1', currentClassesString: 'Wizard8/Fighter4/Cleric2', initialGold: 0, initialDowntime: 0, currentGold: 123456789.25, currentDowntime: 123456789, currentMagicItems: 123456, soulCoins: 123456 };
const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY', 'ARTIFACT'];
const items = ['PERMANENT', 'CONSUMABLE'].flatMap((itemType, group) => rarities.map((rarity, i) => ({ id: 'item-' + group + '-' + i, characterId: 'preview', adventureEntryId: 'entry', itemType, itemName: longName, rarity, quantity: 12345, requiresAttunement: true, source: '來源：' + longName, notes: '虛構備註', createdAt: '2026-10-01T00:00:00Z' })));
const gained = items.map(item => ({ ...item, acquisitionSource: 'ADVENTURE', needsDetails: true }));
const adventure = { id: 'entry', characterId: 'preview', adventureName: '測試冒險', adventureCode: 'PREVIEW', dmName: '測試 DM', playDate: '2026-10-01', startingLevel: 14, endingLevel: 14, startingClassesString: character.currentClassesString, endingClassesString: character.currentClassesString, startingGold: 0, startingDowntime: 0, startingMagicItems: 0, goldChange: 10, goldTotal: 10, downtimeChange: 5, downtimeTotal: 5, magicItemsChange: 6, magicItemsTotal: 6, adventureNotes: '用於量測次要說明的虛構備註', downtimeActivities: [], storyAwards: [{ id: 'award', awardName: '銀月同盟', description: '完整故事獎勵說明' }], createdAt: '2026-10-01T00:00:00Z' };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(user => {
    localStorage.setItem('dnd_auth_token', 'preview.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.preview');
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
    localStorage.setItem('dnd_theme', 'light');
  }, user);
  let releaseCharacters, characterGate, listCharacter = character;
  await context.route('**/api/**', async route => {
    assert.equal(route.request().method(), 'GET', 'No writes in this check');
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/characters' && characterGate) await characterGate;
    const data = path.endsWith('/auth/me') ? user
      : path === '/api/characters' ? [listCharacter]
      : path === '/api/characters/preview' ? character
      : path === '/api/entries/entry' ? adventure
      : path.endsWith('/gained-items') ? gained
      : path.endsWith('/entries/defaults') ? { startingLevel: 14, startingClassesString: character.currentClassesString, startingGold: 10, startingDowntime: 5, startingMagicItems: 6 }
      : path.endsWith('/entries') ? [adventure]
      : path.endsWith('/inventory') ? items : [];
    await route.fulfill({ json: data });
  });
  async function open(path, selector, theme = 'light', scale = 1) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await page.locator(selector).first().waitFor();
    await page.evaluate(({ theme, scale }) => {
      window.ng.getComponent(document.querySelector('app-root')).themeService.setTheme(theme);
      document.documentElement.style.fontSize = 16 * scale + 'px';
    }, { theme, scale });
    await page.waitForFunction(theme => getComputedStyle(document.body).backgroundColor === (theme === 'dark' ? 'rgb(24, 24, 27)' : 'rgb(248, 250, 252)'), theme);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function audit(label, selector) {
    const data = await page.locator(selector).evaluateAll(elements => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      function rgba(color) { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((n, i) => i === 3 ? n / 255 : n); }
      function blend(top, bottom) { return top.slice(0, 3).map((c, i) => c * top[3] + bottom[i] * (1 - top[3])); }
      function lum(rgb) { return rgb.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0); }
      return elements.filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height && getComputedStyle(el).visibility !== 'hidden').map(el => {
        const ancestors = []; for (let p = el; p; p = p.parentElement) ancestors.unshift(p);
        let bg = [255, 255, 255];
        for (const p of ancestors) bg = blend(rgba(getComputedStyle(p).backgroundColor), bg);
        const css = getComputedStyle(el, el.matches('.search-input') ? '::placeholder' : null);
        const fg = rgba(css.color); fg[3] *= ancestors.reduce((n, p) => n * Number(getComputedStyle(p).opacity), 1);
        const front = blend(fg, bg), a = lum(front), b = lum(bg);
        return { text: el.textContent.trim().slice(0, 40), class: el.className, color: css.color, bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    });
    assert.ok(data.length, 'No contrast samples: ' + label);
    const failures = data.filter(sample => sample.ratio < 4.5);
    assert.deepEqual(failures, [], label + ': contrast');
    results.push({ check: label, samples: data.length, minimumContrast: Math.min(...data.map(sample => sample.ratio)) });
  }
  async function layout(selector) {
    const failures = await page.locator(selector).evaluateAll(elements => elements.flatMap(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      const css = getComputedStyle(el);
      return r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || css.textOverflow === 'ellipsis'
        ? [{ class: el.className, left: r.left, right: r.right, scroll: [el.scrollWidth, el.scrollHeight], client: [el.clientWidth, el.clientHeight] }] : [];
    }));
    assert.deepEqual(failures, [], 'Complete information layout');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  try {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 390, height: 900 });
      await open('/characters/preview/inventory', '.item-title', theme);
      await audit(theme + '-inventory', '.search-input,.filter-chip,.rarity-pill,.sub-info-line .meta-item > span,.date-text > span,.attunement-pill,.hud-label,.hud-value,.unit');
      const sameRarity = await page.evaluate(() => [...document.querySelectorAll('.filter-chip:not(.filter-chip--attune)')].every((chip, i) => getComputedStyle(chip).color === getComputedStyle(document.querySelector('.rarity-' + ['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact'][i])).color));
      assert.ok(sameRarity);
      await page.locator('.filter-chip').nth(1).click();
      await page.locator('.filter-chip--active').waitFor();
      await audit(theme + '-selected-chip', '.filter-chip--active');
      await page.locator('.filter-chip-clear').click();
      await page.locator('app-inventory-list').getByRole('tab').nth(1).click();
      await page.locator('.qty-badge').first().waitFor();
      await audit(theme + '-quantities', '.qty-badge,.qty-x');
      await page.locator('.delete-btn').first().hover();
      assert.ok(await page.locator('.delete-btn').first().evaluate(el => getComputedStyle(el).backgroundColor !== 'rgb(254, 226, 226)'));
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.item-row-card')).backgroundColor === (document.body.classList.contains('theme-dark') ? 'rgb(63, 63, 70)' : 'rgb(241, 245, 249)'));
      await audit(theme + '-inventory-hover', '.rarity-pill,.sub-info-line .meta-item > span,.date-text > span,.attunement-pill');
      await open('/characters/preview/adventures', '.badge-story-award', theme);
      await audit(theme + '-adventures', '.notes-preview,.badge-story-award,.delta-badge,.hud-label,.hud-value,.unit');
      assert.ok(await page.locator('.badge-story-award').evaluate(el => getComputedStyle(el).color === getComputedStyle(document.body).getPropertyValue('--color-gold').trim() || getComputedStyle(el).color === (() => { const probe = document.createElement('span'); probe.style.color = 'var(--color-gold)'; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })()));
      await open('/characters/preview/adventures/entry', '.story-award-pill', theme);
      await audit(theme + '-detail', '.item-desc,.story-award-pill,.total-val,.level-box-label,.level-box-value');
      await open('/characters/new', '.avatar-placeholder', theme);
      await audit(theme + '-avatar-placeholder', '.placeholder-text');
      await open('/characters', '.char-card', theme);
      await page.locator('.footer-action-btn.delete-btn').hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.footer-action-btn.delete-btn')).backgroundColor === (document.body.classList.contains('theme-dark') ? 'rgba(251, 113, 133, 0.15)' : 'rgb(255, 228, 230)'));
      await audit(theme + '-character-delete-hover', '.footer-action-btn.delete-btn');
      for (const width of [320, 360, 390, 768, 1280]) for (const scale of [1, 2]) {
        await page.setViewportSize({ width, height: 900 });
        await open('/characters/preview/inventory', '.item-title', theme, scale);
        await layout('.item-title,.sub-info-line,.meta-item,.char-name,.char-meta,.hud-value,.hud-stat-box');
        if (width <= 600) {
          const boxes = await page.locator('.hud-stat-box').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
          assert.equal(boxes.length, 5);
          assert.equal(boxes[1].y, boxes[2].y); assert.equal(boxes[3].y, boxes[4].y);
          assert.ok(boxes[0].width > boxes[1].width);
        }
        const actions = await page.locator('.item-row-card').first().evaluate(card => card.querySelector('.row-left-main').getBoundingClientRect().bottom <= card.querySelector('.row-right-actions').getBoundingClientRect().top || card.querySelector('.row-left-main').getBoundingClientRect().right <= card.querySelector('.row-right-actions').getBoundingClientRect().left);
        assert.ok(actions);
        if (width === 390 && scale === 1) {
          await page.locator('.item-row-card').first().screenshot({ path: `output/playwright/p2-inventory-${theme}.png` });
          await page.locator('.char-hud-bar').screenshot({ path: `output/playwright/p2-hud-${theme}.png` });
        }
        results.push({ check: 'long-content', theme, width, scale });
      }
    }
    for (const width of [320, 390, 768]) for (const theme of ['light', 'dark']) for (const scale of [1, 2]) {
      await page.setViewportSize({ width, height: 900 });
      await open('/characters/preview/adventures/entry/edit', 'textarea[formcontrolname="adventureNotes"]', theme, scale);
      if (width === 390 && scale === 1) {
        await page.evaluate(() => document.body.style.setProperty('--safe-area-bottom', '34px'));
        assert.ok(await page.locator('app-adventure-form .form-actions').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom) >= 34));
      }
      await page.evaluate(() => window.scrollTo(0, document.querySelector('app-adventure-form form').getBoundingClientRect().top + scrollY + 100));
      const bar = await page.locator('app-adventure-form .form-actions').boundingBox();
      assert.ok(bar.y >= 0 && bar.y + bar.height <= 901, 'Sticky bar visible while editing: ' + JSON.stringify({ width, theme, scale, bar }));
      const buttonFailures = await page.locator('app-adventure-form .form-actions button').evaluateAll(buttons => buttons.flatMap(button => {
        const b = button.getBoundingClientRect();
        const label = button.querySelector('.mdc-button__label');
        const range = document.createRange(); range.selectNodeContents(label);
        const r = range.getBoundingClientRect();
        return b.height < 44 || b.left < 0 || b.right > innerWidth || r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom ? [{ button: button.textContent, b: b.toJSON(), r: r.toJSON() }] : [];
      }));
      assert.deepEqual(buttonFailures, [], 'Button text and icon contained');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      assert.ok(await page.evaluate(() => document.querySelector('textarea[formcontrolname="adventureNotes"]').getBoundingClientRect().bottom <= document.querySelector('app-adventure-form .form-actions').getBoundingClientRect().top));
      results.push({ check: 'sticky-layout', width, theme, scale });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await open('/characters/preview/adventures/entry/edit', 'textarea[formcontrolname="adventureNotes"]');
    await page.locator('textarea[formcontrolname="adventureNotes"]').focus();
    await page.locator('textarea[formcontrolname="adventureNotes"]').scrollIntoViewIfNeeded();
    const footer = page.locator('app-adventure-form .form-actions');
    assert.equal(await footer.evaluate(el => getComputedStyle(el).position), 'sticky');
    await page.screenshot({ path: 'output/playwright/p2-form-actions.png', fullPage: false });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clearLast = await page.evaluate(() => document.querySelector('textarea[formcontrolname="adventureNotes"]').getBoundingClientRect().bottom <= document.querySelector('app-adventure-form .form-actions').getBoundingClientRect().top);
    assert.ok(clearLast, 'Last field not behind action bar');
    await page.setViewportSize({ width: 390, height: 400 });
    assert.equal(await footer.evaluate(el => getComputedStyle(el).position), 'static');
    await footer.scrollIntoViewIfNeeded();
    assert.ok(await footer.getByRole('button', { name: '取消' }).isVisible());
    await page.evaluate(() => window.ng.getComponent(document.querySelector('app-adventure-form')).isSaving.set(true));
    await page.getByRole('button', { name: '正在儲存…' }).waitFor();
    assert.ok(await page.getByRole('button', { name: '正在儲存…' }).isDisabled());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.locator('mat-spinner').evaluate(el => [...el.querySelectorAll('*')].every(child => getComputedStyle(child).animationName === 'none')));
    results.push({ check: 'form-actions', sticky: true, shortViewport: 'static', savingLabel: true });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    listCharacter = { ...character, characterName: '測試', currentClassesString: 'Wizard1' };
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      characterGate = new Promise(resolve => releaseCharacters = resolve);
      await open('/characters', '.char-portrait-token.skeleton-box');
      const skeleton = await page.locator('.char-portrait-token').first().boundingBox();
      const skeletonCard = await page.locator('.char-card').first().boundingBox();
      assert.equal(await page.locator('.skeleton-box').first().evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.ok(await page.getByRole('status').filter({ hasText: '正在載入角色' }).isVisible());
      releaseCharacters(); characterGate = null;
      await page.locator('.char-avatar-fallback').first().waitFor();
      const portrait = await page.locator('.char-portrait-token').first().boundingBox();
      const realCard = await page.locator('.char-card').first().boundingBox();
      assert.equal(skeleton.width, portrait.width); assert.equal(skeleton.height, portrait.height);
      assert.ok(Math.abs(skeletonCard.height - realCard.height) <= 1, JSON.stringify({ skeletonCard, realCard }));
      assert.equal(skeletonCard.y, realCard.y);
      await page.locator('.char-card').first().hover();
      assert.equal(await page.locator('.char-card').first().evaluate(el => getComputedStyle(el).transform), 'none');
      results.push({ check: 'skeleton', viewport: width, width: portrait.width, height: portrait.height, skeletonCardHeight: skeletonCard.height, realCardHeight: realCard.height, reducedMotion: true });
    }
    for (const [path, root] of [['/characters/new', 'app-character-form'], ['/characters/preview/inventory/new', 'app-inventory-form']]) {
      await open(path, root + ' .form-actions');
      await page.evaluate(root => window.ng.getComponent(document.querySelector(root)).isSaving.set(true), root);
      await page.getByRole('button', { name: '正在儲存…' }).waitFor();
      assert.ok(await page.getByRole('button', { name: '正在儲存…' }).isDisabled());
      results.push({ check: 'saving-label', path, disabled: true });
    }
    for (const theme of ['light', 'dark']) for (const [path, selector] of [['/', '.hero-section'], ['/login', '.auth-page-container'], ['/register', '.auth-page-container'], ['/forgot-password', '.auth-page-container'], ['/reset-password', '.auth-page-container'], ['/legal', '.legal-page-container']]) {
      await page.setViewportSize({ width: 320, height: 400 });
      await open(path, selector, theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path);
      if (path !== '/legal') {
        const height = await page.locator(selector === '.hero-section' ? '.landing-page-container' : selector).evaluate(el => parseFloat(getComputedStyle(el).minHeight));
        assert.equal(height, 320, '100dvh minus 80px at mobile width');
      }
      results.push({ check: 'short-viewport', path, theme });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('output/playwright/p2-ui-results.json', JSON.stringify(results, null, 2));
    console.log('P2 UI checks passed: ' + results.length + ' result groups.');
  } finally { releaseCharacters?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
