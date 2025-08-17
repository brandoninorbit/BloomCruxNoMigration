import type { Deck, Folder } from '@/types';

export const mockFolders: Folder[] = [
  {
    id: 1,
    name: 'Science',
    deckIds: [1, 2],
    updatedAt: new Date().toISOString(),
    user_id: 'mock',
    created_at: new Date().toISOString(),
    color: 'text-blue-500',
  },
  {
    id: 2,
    name: 'Languages',
    deckIds: [3],
    updatedAt: new Date().toISOString(),
    user_id: 'mock',
    created_at: new Date().toISOString(),
    color: 'text-green-500',
  },
];

export const mockDecks: Deck[] = [
  {
    id: 1,
    title: 'Physics Basics',
    description: 'Intro to physics',
    sources: [],
    cards: [],
    folder_id: 1,
    updatedAt: new Date().toISOString(),
    user_id: 'mock',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Biology 101',
    description: 'Basic biology concepts',
    sources: [],
    cards: [],
    folder_id: 1,
    updatedAt: new Date().toISOString(),
    user_id: 'mock',
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    title: 'Spanish Vocabulary',
    description: 'Common Spanish words',
    sources: [],
    cards: [],
    folder_id: 2,
    updatedAt: new Date().toISOString(),
    user_id: 'mock',
    created_at: new Date().toISOString(),
  },
];
