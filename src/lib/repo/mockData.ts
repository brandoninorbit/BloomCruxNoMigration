import type { Deck, Folder } from '@/types';

export const mockFolders: Folder[] = [
  {
    id: 'f1',
    name: 'Science',
    deckIds: ['d1', 'd2'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f2',
    name: 'Languages',
    deckIds: ['d3'],
    updatedAt: new Date().toISOString(),
  },
];

export const mockDecks: Deck[] = [
  {
    id: 'd1',
    title: 'Physics Basics',
    description: 'Intro to physics',
    sources: [],
    cards: [],
    folderId: 'f1',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'd2',
    title: 'Biology 101',
    description: 'Basic biology concepts',
    sources: [],
    cards: [],
    folderId: 'f1',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'd3',
    title: 'Spanish Vocabulary',
    description: 'Common Spanish words',
    sources: [],
    cards: [],
    folderId: 'f2',
    updatedAt: new Date().toISOString(),
  },
];
