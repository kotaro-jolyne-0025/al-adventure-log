export interface Character {
  id: string;           // UUID
  characterName: string;
  playerName?: string | null;
  race: string;
  subclass?: string | null;
  faction?: string | null;
  avatarUrl?: string | null;
  currentClassesString?: string;
  initialClassesString?: string;
  initialGold?: number;
  initialDowntime?: number;
  currentGold?: number;
  currentDowntime?: number;
  currentMagicItems?: number;
  soulCoins?: number;
  hasAdventureEntries?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterRequest {
  characterName: string;
  playerName?: string | null;
  race: string;
  subclass?: string | null;
  faction?: string | null;
  avatarUrl?: string | null;
  currentClassesString?: string | null;
  initialClassesString?: string | null;
  initialGold?: number | null;
  initialDowntime?: number | null;
  soulCoins?: number | null;
}

export interface CharacterBaselineRequest {
  initialClassesString?: string | null;
  initialGold?: number | null;
  initialDowntime?: number | null;
}

export interface CharacterBaselinePreview {
  currentClassesString?: string | null;
  currentGold: number;
  currentDowntime: number;
}
