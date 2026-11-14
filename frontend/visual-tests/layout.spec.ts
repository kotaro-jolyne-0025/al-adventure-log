import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const date = '2026-11-12T00:00:00Z';
const character = {
  id: 'visual-character', characterName: '銀月森林的旅行者與失落王國守護者',
  race: '人類', currentClassesString: 'Fighter5', initialClassesString: 'Fighter5',
  currentGold: 120, currentDowntime: 20, currentMagicItems: 2, soulCoins: 0,
  initialGold: 120, initialDowntime: 20, createdAt: date, updatedAt: date,
};
const entries = [1, 2].map(id => ({
  id: `entry-${id}`, characterId: character.id,
  adventureName: `失落古城的漫長旅程與森林守護者的約定 ${id}`,
  adventureCode: 'TEST-01', playDate: '2026-11-10', dmName: '測試地下城主',
  startingClassesString: 'Fighter5', endingClassesString: 'Fighter5',
  startingLevel: 5, endingLevel: 5, goldChange: 10, goldTotal: 120,
  downtimeChange: 5, downtimeTotal: 20, magicItemsChange: 1, magicItemsTotal: 2,
  storyAwards: [], gainedItems: [], downtimeActivities: [], createdAt: date, updatedAt: date,
}));
const items = ['PERMANENT', 'CONSUMABLE'].flatMap(itemType => [1, 2].map(id => ({
  id: `${itemType}-${id}`, characterId: character.id, itemType,
  itemName: `森林守護者贈送的古老魔法物品與冒險紀念品 ${id}`,
  quantity: 2, rarity: 'UNCOMMON', requiresAttunement: itemType === 'PERMANENT',
  acquisitionSource: 'ADVENTURE', acquiredDate: '2026-11-10',
  createdAt: date, updatedAt: date,
})));
const screens = [
  { name: 'characters', path: '/characters', host: 'app-character-list' },
  { name: 'adventures', path: `/characters/${character.id}`, host: 'app-adventure-list' },
  { name: 'permanent', path: `/characters/${character.id}/inventory`, host: 'app-inventory-list' },
  { name: 'consumable', path: `/characters/${character.id}/inventory`, host: 'app-inventory-list' },
  ...['consume-dialog', 'movement-history', 'history-expanded', 'history-menu', 'history-edit', 'history-reverse', 'item-edit'].map(name =>
    ({ name, path: `/characters/${character.id}/inventory`, host: 'app-inventory-list' })),
];

for (const theme of ['light', 'dark']) {
  for (const empty of [false, true]) {
    for (const width of empty ? [390, 1440] : [320, 360, 390, 600, 601, 768, 769, 1280, 1440]) {
      for (const screen of screens) {
        if (!['characters', 'adventures', 'permanent', 'consumable', 'movement-history'].includes(screen.name)
          && (empty || ![390, 1440].includes(width))) continue;
        test(`${screen.name}-${theme}-${width}-${empty ? 'empty' : 'populated'}`, async ({ page }) => {
          const unexpected: string[] = [];
          page.on('pageerror', error => unexpected.push(error.message));
          await page.setViewportSize({ width, height: 900 });
          await page.clock.setFixedTime(new Date(date));
          await page.addInitScript(theme => localStorage.setItem('dnd_theme', theme), theme);
          // Bundle the application's font families so network/font updates cannot change baselines.
          await page.route('https://fonts.googleapis.com/**', async route => {
            const css = ['inter', 'noto-sans-tc'].flatMap(family => [400, 500, 600, 700].map(weight =>
              readFileSync(resolve(`node_modules/@fontsource/${family}/${weight}.css`), 'utf8')
                .replaceAll('./files/', `https://visual-fonts.invalid/${family}/`))).join('\n');
            await route.fulfill({ contentType: 'text/css', body: css });
          });
          await page.route('https://visual-fonts.invalid/**', async route => {
            const [family, file] = new URL(route.request().url()).pathname.slice(1).split('/');
            await route.fulfill({ contentType: 'font/woff2', body: readFileSync(resolve(`node_modules/@fontsource/${family}/files/${file}`)) });
          });
          const responses: Record<string, unknown> = {
            '/api/auth/csrf': {},
            '/api/auth/me': { user: { id: 'visual-user', email: 'visual@example.invalid', displayName: '測試玩家' },
              session: { id: 'visual-session', issuedAt: date, expiresAt: '2026-11-13T00:00:00Z' } },
            '/api/characters': empty ? [] : [character, { ...character, id: 'second', characterName: '測試角色二' }],
            [`/api/characters/${character.id}`]: character,
            [`/api/characters/${character.id}/entries`]: empty ? [] : entries,
            [`/api/characters/${character.id}/inventory`]: empty ? [] : items,
            [`/api/characters/${character.id}/inventory/movements`]: { items: empty ? [] : [{
              id: 'movement', itemName: items[2].itemName, operation: 'CONSUME',
              quantityBefore: 3, quantityDelta: -1, quantityAfter: 2, reversible: true,
              reversed: false, createdAt: date, updatedAt: date, notes: '測試消耗備註',
            }, ...['ACQUIRE', 'ADJUST', 'REMOVE'].map((operation, index) => ({
              id: operation, itemType: 'PERMANENT', itemName: items[0].itemName, operation,
              quantityBefore: index === 0 ? 0 : 1, quantityDelta: index === 0 ? 1 : -1,
              quantityAfter: index === 0 ? 1 : 0, createdAt: date, updatedAt: date,
            }))], nextCursor: !empty && screen.name === 'movement-history' ? 'visual-next' : null },
            [`/api/characters/${character.id}/inventory/${items[2].id}`]: items[2],
          };
          await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            const path = url.pathname;
            if (route.request().method() !== 'GET' || !(path in responses)) {
              unexpected.push(`${route.request().method()} ${path}`);
              await route.fulfill({ status: 500, json: { message: 'Undefined visual fixture' } });
              return;
            }
            if (path.endsWith('/movements') && url.searchParams.get('cursor') === 'visual-next') {
              await route.fulfill({ json: { items: [{
                id: 'older', itemType: 'PERMANENT', itemName: '前一天取得的魔法物品', operation: 'ACQUIRE',
                quantityBefore: 0, quantityDelta: 1, quantityAfter: 1, createdAt: '2026-11-11T00:00:00Z',
              }], nextCursor: null } });
            } else await route.fulfill({ json: responses[path] });
          });
          await page.goto(screen.path);
          const host = page.locator(screen.host);
          await expect(host).toBeVisible();
          if (screen.name === 'adventures') await expect(page).toHaveURL(/\/adventures$/);
          if (!['characters', 'adventures', 'permanent', 'movement-history'].includes(screen.name)) await page.getByRole('tab', { name: /消耗品/ }).click();
          await expect(host.locator('.skeleton-box')).toHaveCount(0);
          await expect(host.locator(empty ? '.empty-state:visible' : '.navigation-card:visible').first()).toBeVisible();
          if (screen.name === 'consume-dialog') {
            await page.getByRole('button', { name: /消耗物品/ }).first().click();
            await expect(page.getByRole('dialog')).toContainText('消耗數量');
          }
          if (screen.name.startsWith('history-') || screen.name === 'movement-history') {
            const nav = page.locator(width <= 600 ? '.character-bottom-nav' : '.character-top-nav');
            const history = nav.getByRole('link', { name: '物品異動紀錄', exact: true });
            if (screen.name === 'movement-history' && [320, 601].includes(width)) {
              await history.focus();
              await page.keyboard.press('Enter');
            } else await history.click();
            const selected = nav.locator('[aria-current="page"]');
            await expect(selected).toHaveCount(1);
            await expect(selected).toHaveText('物品異動紀錄');
            await expect(page).toHaveURL(/inventory\?view=history$/);
            await expect(host.getByRole('region', { name: '物品異動紀錄' })).toBeFocused();
            await expect(host.locator('.inventory-header')).toHaveCount(0);
            if (screen.name === 'movement-history') {
              if (empty) await expect(host.getByText('尚無異動紀錄。')).toBeVisible();
              else {
                await expect(host.locator('summary')).toHaveCount(4);
                await expect(host.getByRole('button', { name: /的紀錄操作/ })).toHaveCount(1);
              }
              if (!empty && [320, 601].includes(width)) {
                await page.goBack();
                await expect(selected).toHaveText('倉庫');
                await expect(selected).toBeFocused();
                await page.goForward();
                await expect(page).toHaveURL(/inventory\?view=history$/);
                await expect(selected).toHaveText('物品異動紀錄');
                await page.reload();
                await expect(selected).toHaveText('物品異動紀錄');
                const otherNav = page.locator(width <= 600 ? '.character-top-nav' : '.character-bottom-nav');
                await selected.focus();
                await page.setViewportSize({ width: width <= 600 ? 601 : 600, height: 900 });
                await expect(otherNav.locator('[aria-current="page"]')).toBeFocused();
                await page.setViewportSize({ width, height: 900 });
                await expect(selected).toBeFocused();
                await host.getByRole('region', { name: '物品異動紀錄' }).focus();
              }
              if (!empty && width === 320) {
                const more = host.getByRole('button', { name: '載入更多' });
                const zoom = await page.addStyleTag({ content: 'html { font-size: 200%; }' });
                await more.focus();
                await expect.poll(async () => {
                  const button = await more.boundingBox();
                  const bottomNav = await nav.boundingBox();
                  return button!.y + button!.height <= bottomNav!.y;
                }).toBe(true);
                await page.keyboard.press('Enter');
                await expect(host.getByText('前一天取得的魔法物品')).toBeVisible();
                await zoom.evaluate(node => node.remove());
                await page.evaluate(() => window.scrollTo(0, 0));
              }
            } else {
              await expect(page.locator('app-inventory-history summary').first()).toBeVisible();
              await page.locator('app-inventory-history summary').first().click();
              await expect(page.locator('app-inventory-history details[open]')).toContainText('測試消耗備註');
              if (screen.name !== 'history-expanded') {
                await page.getByRole('button', { name: /的紀錄操作/ }).first().click();
                if (screen.name === 'history-edit') await page.getByRole('menuitem', { name: '編輯', exact: true }).click();
                if (screen.name === 'history-reverse') await page.getByRole('menuitem', { name: '撤銷消耗' }).click();
                if (screen.name !== 'history-menu') await expect(page.getByRole('dialog')).toBeVisible();
              }
            }
          }
          if (screen.name === 'item-edit') {
            await page.getByRole('link', { name: /編輯物品/ }).first().click();
            await expect(page.locator('app-inventory-form')).toBeVisible();
            await expect(page.locator('.character-bottom-nav, .character-top-nav')).toHaveCount(0);
          }
          await page.evaluate(() => document.fonts.ready);
          expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans TC"', '冒險紀錄'))).toBe(true);
          await expect(page.locator('app-read-error')).toHaveCount(0);
          await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
          const capsule = host.locator('.sort-toolbar-capsule:visible');
          if (await capsule.count()) {
            const box = await capsule.boundingBox();
            const container = host.locator(screen.host === 'app-inventory-list' ? '.filter-panel:visible' : '.list-tools');
            const bounds = await container.boundingBox();
            if (width <= 600) {
              expect(Math.abs(box!.x - bounds!.x)).toBeLessThanOrEqual(2);
              expect(Math.abs(box!.x + box!.width - bounds!.x - bounds!.width)).toBeLessThanOrEqual(2);
              const search = host.locator('.search-input:visible');
              const searchBox = await search.boundingBox();
              expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(box!.y);
            }
            if (screen.name === 'adventures') {
              const search = host.locator('.search-input:visible');
              expect(Math.abs(box!.x + box!.width - bounds!.x - bounds!.width)).toBeLessThanOrEqual(2);
              if (width > 600) {
                const searchBar = await host.locator('.search-bar').boundingBox();
                expect(searchBar!.x + searchBar!.width).toBeLessThan(box!.x);
                expect(Math.abs(searchBar!.y + searchBar!.height / 2 - box!.y - box!.height / 2)).toBeLessThanOrEqual(2);
                expect(box!.width).toBeLessThan(400);
              }
              if ([390, 601].includes(width) && !empty) {
                await search.focus();
                await page.keyboard.press('Tab');
                await expect(capsule.locator('select')).toBeFocused();
                await page.keyboard.press('Tab');
                await expect(capsule.getByRole('button')).toBeFocused();
                await capsule.getByRole('button').blur();
              }
            }
            if (width >= 1280 && screen.host === 'app-inventory-list') {
              expect(Math.abs(box!.x + box!.width - bounds!.x - bounds!.width)).toBeLessThanOrEqual(2);
              expect(box!.width).toBeLessThan(400);
              const chips = await host.locator('.filter-chips-row:visible').boundingBox();
              expect(Math.abs(box!.y + box!.height / 2 - chips!.y - chips!.height / 2)).toBeLessThanOrEqual(2);
            }
            await expect(capsule).toHaveScreenshot('sort.png');
          }
          await expect(page).toHaveScreenshot('page.png', { fullPage: true });
          expect(unexpected).toEqual([]);
        });
      }
    }
  }
}
