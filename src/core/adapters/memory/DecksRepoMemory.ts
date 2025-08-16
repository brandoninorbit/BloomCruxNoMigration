import { DecksRepo, Deck, Folder } from "@/core/decksRepo";

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

export class DecksRepoMemory implements DecksRepo {
  async getDecks(userId?: string): Promise<Deck[]> {
    if (userId) {
      // TODO: When login is working, fetch real data for logged-in users
      throw new Error("getDecks: Real data not implemented for logged-in users yet.");
    }
    return decks;
  }
  async getFolders(userId?: string): Promise<Folder[]> {
    if (userId) {
      // TODO: When login is working, fetch real data for logged-in users
      throw new Error("getFolders: Real data not implemented for logged-in users yet.");
    }
    return folders;
  }
  async createDeck(deck: Omit<Deck, 'id'>, userId?: string): Promise<Deck> {
    if (userId) {
      // TODO: When login is working, create real deck for logged-in users
      throw new Error("createDeck: Real data not implemented for logged-in users yet.");
    }
    const newDeck: Deck = { ...deck, id: Date.now() };
    decks.push(newDeck);
    return newDeck;
  }
  async createFolder(folder: Omit<Folder, 'id' | 'sets'>, userId?: string): Promise<Folder> {
    if (userId) {
      // TODO: When login is working, create real folder for logged-in users
      throw new Error("createFolder: Real data not implemented for logged-in users yet.");
    }
    const newFolder: Folder = { ...folder, id: Date.now(), sets: 0 };
    folders.push(newFolder);
    return newFolder;
  }
  // Add more methods as needed
}
