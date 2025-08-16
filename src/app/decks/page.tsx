"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Types and mock data (module scope)
interface Deck {
  id: number;
  folderId: number;
  tag: string;
  title: string;
  locked: boolean;
  mastery: number; // percentage 0-100
  bloomLevel: string; // e.g., "Remember", "Understand", "Apply", ...
}

interface Folder {
  id: number;
  name: string;
  decks: number;
  color: string; // Tailwind text color class
  iconBg: string; // Tailwind background class for icon
}

// Fixed numeric IDs for stable relationships (mock)
const FOLDER_SCIENCE = 173657;
const FOLDER_LANGUAGES = 346752;
const FOLDER_HUMANITIES = 377364;

const MOCK_FOLDERS: Folder[] = [
  { id: FOLDER_SCIENCE, name: "Science", decks: 4, color: "text-blue-500", iconBg: "bg-blue-100" },
  { id: FOLDER_LANGUAGES, name: "Languages", decks: 1, color: "text-green-500", iconBg: "bg-green-100" },
  { id: FOLDER_HUMANITIES, name: "Humanities", decks: 1, color: "text-yellow-500", iconBg: "bg-yellow-100" },
];

const MOCK_DECKS: Deck[] = [
  { id: 106351, folderId: FOLDER_SCIENCE, tag: "Biology", title: "Biology 101", locked: false, mastery: 54, bloomLevel: "Understand" },
  { id: 106464, folderId: FOLDER_SCIENCE, tag: "Chemistry", title: "Organic Chemistry", locked: true, mastery: 0, bloomLevel: "Remember" },
  { id: 165405, folderId: FOLDER_SCIENCE, tag: "Anatomy", title: "Anatomy", locked: false, mastery: 95, bloomLevel: "Evaluate" },
  { id: 105676, folderId: FOLDER_SCIENCE, tag: "Physics", title: "Physics 101", locked: false, mastery: 33, bloomLevel: "Apply" },
  { id: 104562, folderId: FOLDER_LANGUAGES, tag: "Spanish", title: "Spanish Vocabulary", locked: false, mastery: 72, bloomLevel: "Apply" },
  { id: 102573, folderId: FOLDER_HUMANITIES, tag: "History", title: "World History", locked: false, mastery: 10, bloomLevel: "Remember" },
];

function DecksPage() {
  // Client component with typed mock data referenced from module scope
  const [decks] = useState<Deck[]>(MOCK_DECKS);
  const [folders, setFolders] = useState<Folder[]>(MOCK_FOLDERS);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isNewDeckModalOpen, setIsNewDeckModalOpen] = useState<boolean>(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editIconBg, setEditIconBg] = useState<string>("");
  const [editColor, setEditColor] = useState<string>("");

  useEffect(() => {
    if (folderToEdit) {
      setEditName(folderToEdit.name);
      setEditIconBg(folderToEdit.iconBg);
      setEditColor(folderToEdit.color);
    } else {
      setEditName("");
      setEditIconBg("");
      setEditColor("");
    }
  }, [folderToEdit]);

  const handleSaveEdit = useCallback(() => {
    if (!folderToEdit) return;
    setFolders((prev) =>
      prev.map((fld) =>
        fld.id === folderToEdit.id ? { ...fld, name: editName, iconBg: editIconBg, color: editColor } : fld
      )
    );
    setIsEditModalOpen(false);
    setFolderToEdit(null);
  }, [folderToEdit, editName, editIconBg, editColor]);

  const activeFolder = useMemo(
    () => (activeFolderId === null ? null : folders.find((f) => f.id === activeFolderId) ?? null),
    [activeFolderId, folders]
  );

  const decksToDisplay = useMemo(() => {
    if (activeFolderId === null) return decks;
    return decks.filter((d) => d.folderId === activeFolderId);
  }, [activeFolderId, decks]);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Soft background accents */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23ffffff;stop-opacity:0.1' /%3E%3Cstop offset='100%25' style='stop-color:%23f9f9f9;stop-opacity:0.1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='url(%23grad)'/%3E%3C/svg%3E\"), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M0 50 Q 25 25, 50 50 T 100 50' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 60 Q 25 35, 50 60 T 100 60' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 70 Q 25 45, 50 70 T 100 70' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 -z-10 w-1/2 h-1/2 bg-gradient-to-tr from-cyan-50 to-blue-100 opacity-20 blur-3xl"
      />
      <div className="max-w-4xl mx-auto">
        {/* Greeting */}
        <h2 className="text-3xl font-bold text-[#111418] mb-2">
          Welcome back, Sarah
        </h2>
        <p className="text-[#637488] mb-6">Let&apos;s get learning.</p>

        {/* Search (disabled/coming soon) */}
        <div className="relative mb-2">
          <input
            type="search"
            placeholder="Search your decks... (Coming Soon)"
            disabled
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:border-transparent transition-shadow shadow-sm"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              width="20"
              height="20"
              viewBox="0 0 256 256"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              aria-hidden
            >
              <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-[#637488] italic px-2">
          Tip: Consistent review is the key to long-term memory.
        </p>

        {/* Decks */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-semibold text-[#111418]">{activeFolder ? activeFolder.name : "Recent Decks"}</h3>
            <div className="flex items-center gap-4">
              {activeFolder && (
                <button
                  type="button"
                  onClick={() => setActiveFolderId(null)}
                  className="bg-[#f0f2f4] text-[#111418] font-bold py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
                >
                  Back to Recent
                </button>
              )}
              <a
                href="/decks/new"
                className="bg-[#f0f2f4] text-[#111418] font-bold py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
              >
                New Deck
              </a>
              <Link
                href="/folders/new"
                className="bg-[#1f8fff] text-white font-bold py-2 px-4 rounded-md hover:bg-[#2481f9] focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
              >
                New Folder
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {decksToDisplay.map((d) => (
              <div key={d.id} className="group [perspective:1000px] cursor-pointer" onClick={() => window.location.href = `/decks/${d.id}/edit`}>
                <div className="relative w-full aspect-[3/4] bg-white rounded-xl shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-2 [transform-style:preserve-3d] group-hover:[transform:rotateY(3deg)]">
                  <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
                    {d.locked && (
                      <div className="absolute top-2 right-2 p-1.5 bg-[#ffc107]/20 text-[#ffc107] rounded-full">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    )}
                    <p className="text-lg font-medium text-[#637488]">
                      {d.tag}
                    </p>
                  </div>
                  <div className="absolute bottom-4 left-4 text-sm font-medium text-[#111418]">
                    {d.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Folders */}
        <section className="mt-12">
          <h3 className="text-2xl font-semibold text-[#111418] mb-4">
            Folders
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {folders.map((f) => {
              const deckCount = decks.filter(d => d.folderId === f.id).length;
              return (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveFolderId(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setActiveFolderId(f.id);
                  }}
                  aria-pressed={activeFolderId === f.id}
                  className="group relative bg-white rounded-xl shadow-md p-5 flex items-center gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div
                    className={`w-12 h-12 flex-shrink-0 rounded-lg ${f.iconBg} ${f.color} flex items-center justify-center`}
                  >
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[#111418]">{f.name}</p>
                    <p className="text-sm text-[#637488]">{deckCount} decks</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Edit folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderToEdit(f);
                      setIsEditModalOpen(true);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Edit Folder Dialog */}
          <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { setIsEditModalOpen(false); setFolderToEdit(null); } }}>
            <DialogContent className="sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle>Edit Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Folder name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Folder name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Icon color</label>
                  <div className="flex items-center gap-3">
                    {[
                      { iconBg: "bg-blue-100", color: "text-blue-500", dot: "bg-blue-500" },
                      { iconBg: "bg-green-100", color: "text-green-500", dot: "bg-green-500" },
                      { iconBg: "bg-yellow-100", color: "text-yellow-500", dot: "bg-yellow-500" },
                      { iconBg: "bg-purple-100", color: "text-purple-500", dot: "bg-purple-500" },
                      { iconBg: "bg-pink-100", color: "text-pink-500", dot: "bg-pink-500" },
                      { iconBg: "bg-orange-100", color: "text-orange-500", dot: "bg-orange-500" },
                      { iconBg: "bg-gray-200", color: "text-gray-500", dot: "bg-gray-500" },
                    ].map((opt) => {
                      const selected = editIconBg === opt.iconBg && editColor === opt.color;
                      return (
                        <button
                          key={opt.color}
                          type="button"
                          onClick={() => { setEditIconBg(opt.iconBg); setEditColor(opt.color); }}
                          className={`relative h-8 w-8 rounded-full ${opt.dot} ring-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          aria-pressed={selected}
                        >
                          {selected && <span className="absolute inset-0 rounded-full ring-2 ring-black/70"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setFolderToEdit(null); }}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded-md bg-[#2481f9] px-4 py-2 font-semibold text-white hover:opacity-90"
                >
                  Save changes
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Select Folder Dialog */}
          <Dialog open={isNewDeckModalOpen} onOpenChange={(open) => { if (!open) { setIsNewDeckModalOpen(false); } }}>
            <DialogContent className="sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle>Select a Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setActiveFolderId(f.id); setIsNewDeckModalOpen(false); }}
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-left text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </main>
  );
}

export default DecksPage;
