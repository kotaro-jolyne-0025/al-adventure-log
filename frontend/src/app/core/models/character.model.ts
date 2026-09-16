export interface Character {
  id: string;           // UUID
  characterName: string;
  playerName?: string | null;
  race: string;
  subclass?: string | null;
  faction?: string | null;
  avatarUrl?: string | null;
  currentClassesString?: string;
  soulCoins?: number;
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
  soulCoins?: number | null;
}
