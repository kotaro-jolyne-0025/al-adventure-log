export type ItemType = 'PERMANENT' | 'CONSUMABLE';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE' | 'LEGENDARY' | 'ARTIFACT';

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PERMANENT: '永久魔法物品',
  CONSUMABLE: '消耗品',
};

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  COMMON: '普通 (Common)',
  UNCOMMON: '非普通 (Uncommon)',
  RARE: '珍稀 (Rare)',
  VERY_RARE: '極珍稀 (Very Rare)',
  LEGENDARY: '傳說 (Legendary)',
  ARTIFACT: '神器 (Artifact)',
};

export const RARITY_COLORS: Record<ItemRarity, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#2196f3',
  VERY_RARE: '#9c27b0',
  LEGENDARY: '#ff9800',
  ARTIFACT: '#e53935',
};

export interface InventoryItem {
  id: string;           // UUID
  characterId: string;  // UUID
  adventureEntryId?: string | null;
  adventureGainedItemId?: string | null;
  itemName: string;
  itemType: ItemType;
  rarity?: ItemRarity;
  requiresAttunement?: boolean;
  quantity: number;
  source?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItemRequest {
  adventureEntryId?: string | null;
  adventureGainedItemId?: string | null;
  itemName: string;
  itemType: ItemType;
  rarity?: ItemRarity | null;
  requiresAttunement?: boolean;
  quantity?: number;
  source?: string | null;
  notes?: string | null;
}
