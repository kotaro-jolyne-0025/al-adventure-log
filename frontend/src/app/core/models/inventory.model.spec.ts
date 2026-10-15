import { soulCoinQuantity } from './inventory.model';

describe('Soul coin totals', () => {
  it('sums quantities across separate records without including other consumables', () => {
    expect(soulCoinQuantity([
      { itemType: 'CONSUMABLE', isSoulCoin: true, itemCategory: 'WONDROUS_ITEM', quantity: 1 },
      { itemType: 'CONSUMABLE', isSoulCoin: true, itemCategory: 'POTION', quantity: 2 },
      { itemType: 'CONSUMABLE', itemName: '靈魂幣', itemCategory: 'WONDROUS_ITEM', quantity: 5 },
      { itemType: 'PERMANENT', isSoulCoin: true, quantity: 4 },
    ])).toBe(3);
  });
});
