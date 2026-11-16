import { expect, test } from '@playwright/test';

test('reads character sections on demand and retains a loaded list when saving a device copy fails', async ({ page, context }) => {
  const date = '2026-11-12T00:00:00Z';
  await page.clock.install({ time: new Date(date) });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'readCopies' && sessionStorage.getItem('allow-device-copies') !== 'true') throw new DOMException('Simulated quota', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });

  const role = '/api/characters/test-role';
  const counts = new Map<string, number>();
  const responses: Record<string, unknown> = {
    '/api/auth/csrf': {},
    '/api/auth/me': { user: { id: 'test-user', email: 'test@example.invalid', displayName: '測試玩家' },
      session: { id: 'test-session', issuedAt: date, expiresAt: '2026-11-13T00:00:00Z' } },
    [role]: { id: 'test-role', characterName: '測試角色', currentClassesString: 'Fighter5', updatedAt: date },
    [role + '/entries']: [],
    [role + '/inventory']: [{ id: 'item', itemType: 'PERMANENT', itemName: '測試護符', quantity: 1, updatedAt: date }],
    [role + '/inventory/movements']: { items: [], nextCursor: null },
  };
  let delayInventory = false;
  let failInventory = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE' && path === role + '/inventory/item') {
      responses[role + '/inventory'] = [];
      await route.fulfill({ status: 204 });
      return;
    }
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if (delayInventory && path === role + '/inventory') await new Promise(resolve => setTimeout(resolve, 450));
    if (failInventory && path === role + '/inventory') {
      await route.fulfill({ status: 503, json: {} });
      return;
    }
    await route.fulfill(path in responses ? { json: responses[path] } : { status: 404, json: {} });
  });

  const nav = page.locator('.character-bottom-nav');
  const adventures = page.locator('app-adventure-list .empty-state');
  const item = page.getByText('測試護符', { exact: true });
  const firstStarted = performance.now();
  await page.goto('/characters/test-role');
  await expect(adventures).toBeVisible();
  test.info().annotations.push({ type: '首次顯示 ms', description: String(Math.round(performance.now() - firstStarted)) });
  expect(counts.get(role + '/entries')).toBe(1);
  expect(counts.has(role + '/inventory')).toBe(false);
  expect(counts.has(role + '/inventory/movements')).toBe(false);
  await nav.getByRole('link', { name: '倉庫', exact: true }).click();
  await expect(item).toBeVisible();
  await nav.getByRole('link', { name: '物品異動紀錄' }).click();
  await expect(page.getByText('尚無異動紀錄。')).toBeVisible();
  const freshStarted = performance.now();
  await nav.getByRole('link', { name: '冒險紀錄', exact: true }).click();
  await expect(adventures).toBeVisible();
  test.info().annotations.push({ type: '新鮮命中 ms', description: String(Math.round(performance.now() - freshStarted)) });
  expect(counts.get(role + '/entries')).toBe(1);
  expect(counts.get(role + '/inventory')).toBe(1);
  expect(counts.get(role + '/inventory/movements')).toBe(1);
  expect(counts.get(role)).toBe(1);

  delayInventory = true;
  await page.clock.fastForward(30_000);
  await expect(adventures).toBeVisible();
  expect(counts.get(role + '/entries')).toBe(1);
  await nav.getByRole('link', { name: '倉庫', exact: true }).click();
  const expiredStarted = performance.now();
  await expect(page.locator('app-inventory-list .skeleton-box').first()).toBeVisible();
  await expect(item).toBeVisible();
  test.info().annotations.push({ type: '過期重讀（模擬慢網）ms', description: String(Math.round(performance.now() - expiredStarted)) });
  expect(counts.get(role + '/inventory')).toBe(2);
  delayInventory = false;

  await context.setOffline(true);
  await expect(item).toBeVisible();
  await expect(page.getByRole('button', { name: '刪除物品：測試護符' })).toBeDisabled();
  await expect(page.locator('app-inventory-list app-cache-notice')).toContainText('上次更新');
  const connection = page.locator('.connection-status');
  await expect(connection).toHaveText('已離線，目前僅供查看。');
  await expect(connection).not.toHaveClass(/\bfailed\b/);
  for (const [width, height] of [[320, 900], [390, 900], [402, 874], [412, 891], [600, 900], [601, 900], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => {
      const noticeBox = (await connection.boundingBox())!;
      const navBox = await nav.boundingBox();
      return Math.abs((navBox?.y ?? height) - (noticeBox.y + noticeBox.height));
    }).toBeLessThanOrEqual(8);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  delayInventory = true;
  failInventory = true;
  await context.setOffline(false);
  await expect(page.locator('app-inventory-list .skeleton-box').first()).toBeVisible();
  await expect(connection).toHaveText('');
  await expect(connection).toContainText('無法更新資料，請重試。');
  await expect(connection).toHaveClass(/\bfailed\b/);
  await expect(page.getByRole('button', { name: '新增物品' })).toBeDisabled();
  failInventory = false;
  delayInventory = false;
  await connection.getByRole('button', { name: '重試' }).click();
  await expect(page.getByRole('button', { name: '刪除物品：測試護符' })).toBeEnabled();
  await expect(connection).toHaveText('');
  expect(counts.get(role + '/inventory')).toBe(4);

  // Store two full responses whose combined UTF-8 payload exceeds the account budget.
  await page.evaluate(() => sessionStorage.setItem('allow-device-copies', 'true'));
  const large = '資料'.repeat(185_000);
  responses[role + '/entries'] = [{ id: 'entry', adventureName: '測試冒險', playDate: date, padding: large }];
  responses[role + '/inventory'] = [{ id: 'item', itemName: '更新後的護符', itemType: 'PERMANENT', quantity: 2, padding: large }];
  await page.clock.fastForward(30_000);
  await nav.getByRole('link', { name: '冒險紀錄', exact: true }).click();
  await expect(page.getByText('測試冒險', { exact: true }).first()).toBeVisible();
  const targets = () => page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const db = indexedDB.open('dnd-device-data');
    db.onerror = () => reject(db.error);
    db.onsuccess = () => {
      const read = db.result.transaction('readCopies').objectStore('readCopies').getAllKeys();
      read.onerror = () => { db.result.close(); reject(read.error); };
      read.onsuccess = () => {
        db.result.close();
        resolve(read.result.map(key => JSON.parse(String(key))[2] as string).sort());
      };
    };
  }));
  await expect.poll(targets).toContain('adventures');
  await nav.getByRole('link', { name: '倉庫', exact: true }).click();
  await expect(page.getByText('更新後的護符', { exact: true })).toBeVisible();
  await expect.poll(targets).toEqual(['inventory']);

  const countBeforeDelete = counts.get(role + '/inventory')!;
  await page.getByRole('button', { name: '刪除物品：更新後的護符' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(page.getByText('尚無永久性魔法物品')).toBeVisible();
  await expect.poll(() => counts.get(role + '/inventory')).toBe(countBeforeDelete + 1);

  await context.setOffline(true);
  await expect(page.getByText('測試角色', { exact: true }).filter({ visible: true })).not.toHaveCount(0);
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(page.getByText('測試角色', { exact: true })).toHaveCount(0);
});
