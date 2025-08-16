// src/core/DecksRepoMock.ts
import { DecksRepo, Deck, Folder } from "./decksRepo";

// Example mock data
const decks: Deck[] = [
  {
    id: 1,
    folderId: 1,
    tag: "science",
    title: "Physics Basics",
    locked: false,
    mastery: 2,
    bloomLevel: "Understand"
  },
  {
    id: 2,
    folderId: 2,
    tag: "languages",
    title: "Spanish 101",
    locked: false,
    mastery: 1,
    bloomLevel: "Remember"
  }
];

const folders: Folder[] = [
  {
    id: 1,
    name: "Science",
    sets: 1,
    color: "blue",
    iconBg: "bg-blue-100"
  },
  {
    id: 2,
    name: "Languages",
    sets: 1,
    color: "green",
    iconBg: "bg-green-100"
  }
];

export class DecksRepoMock implements DecksRepo {
  async getDecks() {
    return decks;
  }
  async getFolders() {
    return folders;
  }
  async createDeck(deck: Omit<Deck, 'id'>) {
    const newDeck: Deck = { ...deck, id: Date.now() };
    decks.push(newDeck);
    return newDeck;
  }
  async createFolder(folder: Omit<Folder, 'id' | 'sets'>) {
    const newFolder: Folder = { ...folder, id: Date.now(), sets: 0 };
    folders.push(newFolder);
    return newFolder;
  }
  // Add more methods as needed
}
