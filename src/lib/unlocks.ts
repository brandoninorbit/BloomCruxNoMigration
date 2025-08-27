export type Unlock = {
  id: string; // stable identifier (e.g., 'Sunrise')
  name: string; // display name
  level: number; // commander level required
  kind: 'item' | 'category';
  category?: 'DeckCovers' | 'AvatarFrames' | 'PageBackgrounds';
};

export const CATEGORY_UNLOCK_LEVELS = {
  DeckCovers: 2,
  AvatarFrames: 4,
  PageBackgrounds: 6,
} as const;

// Authoritative unlock list (sorted by level asc)
export const UNLOCKS: Unlock[] = [
  { id: 'Sunrise', name: 'Sunrise Deck Cover', level: CATEGORY_UNLOCK_LEVELS.DeckCovers, kind: 'item', category: 'DeckCovers' },
  { id: 'DeepSpace', name: 'Deep Space Deck Cover', level: 3, kind: 'item', category: 'DeckCovers' },
  { id: 'NightMission', name: 'Night Mission Deck Cover', level: 5, kind: 'item', category: 'DeckCovers' },
  { id: 'AvatarFrames', name: 'Avatar Frames', level: CATEGORY_UNLOCK_LEVELS.AvatarFrames, kind: 'category' },
  { id: 'PageBackgrounds', name: 'Page Backgrounds', level: CATEGORY_UNLOCK_LEVELS.PageBackgrounds, kind: 'category' },
];

export function getNextUnlockForLevel(level: number): Unlock | undefined {
  return UNLOCKS.find((u) => level < u.level);
}

export function getUnlocksNewBetween(prevLevel: number, newLevel: number): Unlock[] {
  if (!(Number.isFinite(prevLevel) && Number.isFinite(newLevel))) return [];
  if (newLevel <= prevLevel) return [];
  return UNLOCKS.filter((u) => prevLevel < u.level && u.level <= newLevel);
}

export function getUnlockLevelById(id: string): number | undefined {
  return UNLOCKS.find((u) => u.id === id)?.level;
}

export function getUnlocksAtOrBelow(level: number): Unlock[] {
  return UNLOCKS.filter((u) => u.level <= level);
}
