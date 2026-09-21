

import { ItemRarity } from './inventory.model';

export type AcquisitionSource = 'ADVENTURE' | 'DOWNTIME';

// ── DowntimeActivity ─────────────────────────────────────────────────────────

export interface DowntimeActivity {
  id: string;           // UUID
  adventureEntryId?: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DowntimeActivityRequest {
  id?: string;
  description: string;
}

// ── AdventureGainedItem (冒險獲得物品快照) ───────────────────────────────────

export interface AdventureGainedItem {
  id: string;           // UUID
  adventureEntryId: string;
  itemName: string;
  itemType: 'PERMANENT' | 'CONSUMABLE';
  rarity?: ItemRarity | null;
  requiresAttunement?: boolean;
  quantity?: number;
  acquisitionSource?: AcquisitionSource | null;
  needsDetails?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdventureGainedItemRequest {
  id?: string;
  itemName: string;
  itemType: 'PERMANENT' | 'CONSUMABLE';
  rarity?: ItemRarity | null;
  requiresAttunement?: boolean;
  quantity?: number;
  notes?: string | null;
}

// ── StoryAward (故事獎勵) ───────────────────────────────────────────────────

export interface StoryAward {
  id: string;           // UUID
  adventureEntryId: string;
  awardName: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoryAwardRequest {
  id?: string;
  awardName: string;
  description?: string | null;
}

// ── AdventureEntry ───────────────────────────────────────────────────────────

export interface AdventureEntry {
  id: string;           // UUID
  characterId: string;  // UUID
  adventureCode?: string;
  adventureName?: string;
  playDate?: string;            // ISO date YYYY-MM-DD
  dmName?: string;
  startingLevel?: number;
  endingLevel?: number;
  startingClassesString?: string;
  endingClassesString?: string;
  startingGold?: number;
  goldChange?: number;
  goldDowntimeChange?: number;
  goldTotal?: number;
  startingDowntime?: number;
  downtimeChange?: number;
  downtimeDowntimeChange?: number;
  downtimeTotal?: number;
  startingMagicItems?: number;
  magicItemsChange?: number;
  magicItemsDowntimeChange?: number;
  magicItemsTotal?: number;
  adventureNotes?: string;
  soulCoinChargesUsed?: string;
  downtimeActivities: DowntimeActivity[];
  storyAwards?: StoryAward[];
  recordingModelVersion?: number;
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdventureEntryRequest {
  adventureCode?: string | null;
  adventureName?: string | null;
  playDate?: string | null;
  dmName?: string | null;
  levelChange?: number | null;
  classChanges?: { className: string; levelChange: number }[] | null;
  goldChange?: number | null;
  goldDowntimeChange?: number | null;
  downtimeChange?: number | null;
  downtimeDowntimeChange?: number | null;
  magicItemsChange?: number | null;
  magicItemsDowntimeChange?: number | null;
  adventureNotes?: string | null;
  soulCoinChargesUsed?: string | null;
}

/**
 * 冒險記錄完整儲存格式。
 *
 * 後端會在同一個資料庫交易中同步主記錄與三種子項目；任何一步失敗時，
 * 整包資料都不會寫入，避免手機網路中斷後留下只存一半的資料。
 */
export interface AdventureEntrySaveRequest {
  entry: AdventureEntryRequest;
  downtimeActivities: DowntimeActivityRequest[];
  gainedItems: AdventureGainedItemRequest[];
  storyAwards: StoryAwardRequest[];
}

export interface EntryDefaults {
  startingLevel?: number | null;
  startingGold?: number | null;
  startingDowntime?: number | null;
  startingMagicItems?: number | null;
  startingClassesString?: string | null;
}
