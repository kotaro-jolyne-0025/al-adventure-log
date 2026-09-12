export interface Character {
  id: string;           // UUID
  characterName: string;
  playerName: string;
  race: string;
  subclass?: string | null;
  faction?: string | null;
  avatarUrl?: string | null;
  currentClassesString?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterRequest {
  characterName: string;
  playerName: string;
  race: string;
  subclass?: string | null;
  faction?: string | null;
  avatarUrl?: string | null;
  currentClassesString?: string | null;
}
