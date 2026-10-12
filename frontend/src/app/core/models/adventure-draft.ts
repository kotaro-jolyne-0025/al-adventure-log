import { ITEM_CATEGORY_LABELS, ITEM_RARITY_LABELS } from './inventory.model';

/** Raw editable values, including incomplete rows. No Angular objects or totals. */
export interface AdventureDraftInput {
  form: Record<string, unknown>;
  levelUp: boolean;
  catchup: boolean;
  catchupCount: number;
  classes: { className: string; level: number }[];
  magicItems: {
    id?: string;
    itemName: string;
    rarity: string;
    itemCategory: string;
    requiresAttunement?: boolean;
    acquisitionSource?: 'ADVENTURE' | 'DOWNTIME' | null;
    needsDetails?: boolean;
    notes: string;
  }[];
  consumables: {
    id?: string;
    itemName: string;
    quantity: number;
    isSoulCoin?: boolean;
    rarity: string;
    itemCategory: string;
    notes: string;
  }[];
  awards: { id?: string; awardName: string; description: string }[];
  activities: {
    id?: string;
    presetLabel?: string;
    description: string;
    gold: number | null;
    downtime: number | null;
    magicItems: number | null;
  }[];
}
export interface AdventureDraft {
  input: AdventureDraftInput;
  baseline: string | null;
  cloudSavedId?: string;
}

export function draftFormValues(raw: Record<string, unknown>): Record<string, unknown> {
  const form = { ...raw };
  const date = raw['playDate'];
  if (date instanceof Date) {
    form['playDate'] = Number.isNaN(date.getTime())
      ? null
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return form;
}

/** Stable cloud content comparison, including children; ignore transport timestamps. */
export function adventureBaseline(value: unknown): string {
  function normalize(item: unknown): unknown {
    if (Array.isArray(item))
      return item.map(normalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .filter(([key]) => !['createdAt', 'updatedAt'].includes(key))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [
            key,
            normalize(
              typeof child === 'string' &&
                child.trim() !== '' &&
                /(level|gold|downtime|magicitems|quantity|lost|change|total)$/i.test(key) &&
                Number.isFinite(Number(child))
                ? Number(child)
                : child,
            ),
          ]),
      );
    return item ?? null;
  }
  return JSON.stringify(normalize(value));
}

export function isDraftInput(value: unknown): value is AdventureDraftInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as AdventureDraftInput;
  const record = (item: unknown) => !!item && typeof item === 'object' && !Array.isArray(item);
  return (
    record(input.form) &&
    ['classes', 'magicItems', 'consumables', 'awards', 'activities'].every((key) =>
      Array.isArray((value as Record<string, unknown>)[key]),
    ) &&
    typeof input.levelUp === 'boolean' &&
    typeof input.catchup === 'boolean' &&
    input.classes.every((item) => record(item) && typeof item.className === 'string') &&
    [...input.magicItems, ...input.consumables].every(
      (item) => record(item) && typeof item.itemName === 'string' && typeof item.notes === 'string',
    ) &&
    input.awards.every(
      (item) =>
        record(item) && typeof item.awardName === 'string' && typeof item.description === 'string',
    ) &&
    input.activities.every((item) => record(item) && typeof item.description === 'string')
  );
}

export function draftText(input: unknown): string {
  if (!isDraftInput(input)) return JSON.stringify(input, null, 2) ?? '無可用草稿文字';
  const value = (item: unknown) => (item == null || item === '' ? '（未填）' : String(item));
  const labels: Record<string, string> = {
    adventureCode: '冒險代碼',
    adventureName: '冒險名稱',
    playDate: '遊玩日期',
    playDateText: '尚未完成的日期輸入',
    dmName: 'DM',
    goldChange: '冒險金幣變動',
    goldDowntimeChange: '休整期金幣變動',
    downtimeChange: '冒險休整期變動',
    downtimeDowntimeChange: '休整期活動天數變動',
    adventureNotes: '備註',
  };
  const rows = [
    '冒險草稿（尚未儲存至雲端）',
    ...Object.entries(labels)
      .filter(([key]) => key in input.form)
      .map(([key, label]) => `${label}：${value(input.form[key])}`),
    `本次升級：${input.levelUp ? '是' : '否'}`,
    `迎頭趕上：${input.catchup ? input.catchupCount : '否'}`,
    `職業：${input.classes.map((item) => `${item.className} ${value(item.level)}`).join('／')}`,
  ];
  const rarity = ITEM_RARITY_LABELS as Record<string, string>;
  const category = ITEM_CATEGORY_LABELS as Record<string, string>;
  rows.push('\n永久性魔法物品');
  input.magicItems.forEach((item, i) =>
    rows.push(
      `${i + 1}. ${value(item.itemName)}｜${rarity[item.rarity] ?? value(item.rarity)}｜${category[item.itemCategory] ?? value(item.itemCategory)}｜同調：${item.requiresAttunement ? '是' : '否'}｜${item.acquisitionSource === 'DOWNTIME' ? '休整期獲得' : '冒險獲得'}\n備註：${value(item.notes)}`,
    ),
  );
  rows.push('\n消耗品');
  input.consumables.forEach((item, i) =>
    rows.push(
      `${i + 1}. ${value(item.itemName)}｜數量：${value(item.quantity)}｜靈魂幣：${item.isSoulCoin ? '是' : '否'}｜${rarity[item.rarity] ?? value(item.rarity)}｜${category[item.itemCategory] ?? value(item.itemCategory)}\n備註：${value(item.notes)}`,
    ),
  );
  rows.push('\n故事獎勵');
  input.awards.forEach((item, i) =>
    rows.push(`${i + 1}. ${value(item.awardName)}\n${value(item.description)}`),
  );
  rows.push('\n休整期活動');
  input.activities.forEach((item, i) =>
    rows.push(
      `${i + 1}. ${value(item.description)}｜金幣：${value(item.gold)}｜天數：${value(item.downtime)}`,
    ),
  );
  return rows.join('\n');
}
