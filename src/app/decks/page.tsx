"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser, useSessionContext } from "@supabase/auth-helpers-react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getSupabaseClient } from "@/lib/supabase/browserClient";
const supabase = getSupabaseClient();

/* ---------- Types ---------- */

interface Deck {
  id: number;
  folderId?: number;
  tag: string;
  title: string;
  locked: boolean;
  mastery: number; // percentage 0-100
  bloomLevel: string; // e.g., "Remember"
  created_at?: string; // ISO timestamp from Supabase
}

type ColorName = "blue" | "green" | "yellow" | "purple" | "pink" | "orange" | "gray";

interface FolderUI {
  id: number;
  name: string;
  colorName: ColorName;   // value stored in DB (e.g., "blue")
  colorClass: string;     // Tailwind text class
  iconBgClass: string;    // Tailwind bg class
}

/** The exact shape we expect from Supabase (public.folders) */
type FolderRow = {
  id: number;
  name: string | null;
  color: string | null; // should be one of ColorName, but stored as string
  user_id?: string;
  created_at?: string;
};

/* ---------- Color helpers ---------- */

const COLOR_NAMES: ColorName[] = [
  "blue",
  "green",
  "yellow",
  "purple",
  "pink",
  "orange",
  "gray",
];

function toColorClasses(name: string | null | undefined): {
  colorClass: string;
  iconBgClass: string;
  colorName: ColorName;
} {
  const fallback: ColorName = "blue";
  const safe = (COLOR_NAMES as readonly string[]).includes(String(name))
    ? (name as ColorName)
    : fallback;

  const map: Record<ColorName, { text: string; bg: string }> = {
    blue: { text: "text-blue-500", bg: "bg-blue-100" },
    green: { text: "text-green-500", bg: "bg-green-100" },
    yellow: { text: "text-yellow-500", bg: "bg-yellow-100" },
    purple: { text: "text-purple-500", bg: "bg-purple-100" },
    pink: { text: "text-pink-500", bg: "bg-pink-100" },
    orange: { text: "text-orange-500", bg: "bg-orange-100" },
    gray: { text: "text-gray-500", bg: "bg-gray-200" },
  };

  return {
    colorClass: map[safe].text,
    iconBgClass: map[safe].bg,
    colorName: safe,
  };
}

function mapRowToUI(r: FolderRow): FolderUI {
  const { colorClass, iconBgClass, colorName } = toColorClasses(r.color);
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    colorName,
    colorClass,
    iconBgClass,
  };
}

/* ---------- Mock data (only when logged-out) ---------- */

const FOLDER_SCIENCE = 173657;
const FOLDER_LANGUAGES = 346752;
const FOLDER_HUMANITIES = 377364;

function makeMockFolder(id: number, name: string, c: ColorName): FolderUI {
  return { id, name, ...toColorClasses(c) };
}

const MOCK_FOLDERS: FolderUI[] = [
  makeMockFolder(FOLDER_SCIENCE, "Science", "blue"),
  makeMockFolder(FOLDER_LANGUAGES, "Languages", "green"),
  makeMockFolder(FOLDER_HUMANITIES, "Humanities", "yellow"),
];

const MOCK_DECKS: Deck[] = [
  {
    id: 106351,
    folderId: FOLDER_SCIENCE,
    tag: "Biology",
    title: "Biology 101",
    locked: false,
    mastery: 54,
    bloomLevel: "Understand",
  },
  {
    id: 106464,
    folderId: FOLDER_SCIENCE,
    tag: "Chemistry",
    title: "Organic Chemistry",
    locked: true,
    mastery: 0,
    bloomLevel: "Remember",
  },
  {
    id: 165405,
    folderId: FOLDER_SCIENCE,
    tag: "Anatomy",
    title: "Anatomy",
    locked: false,
    mastery: 95,
    bloomLevel: "Evaluate",
  },
  {
    id: 105676,
    folderId: FOLDER_SCIENCE,
    tag: "Physics",
    title: "Physics 101",
    locked: false,
    mastery: 33,
    bloomLevel: "Apply",
  },
  {
    id: 104562,
    folderId: FOLDER_LANGUAGES,
    tag: "Spanish",
    title: "Spanish Vocabulary",
    locked: false,
    mastery: 72,
    bloomLevel: "Apply",
  },
  {
    id: 102573,
    folderId: FOLDER_HUMANITIES,
    tag: "History",
    title: "World History",
    locked: false,
    mastery: 10,
    bloomLevel: "Remember",
  },
];

/* ---------- Helper for manual folder creation (no ?columns=) ---------- */
async function createFolderRaw(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  row: { name: string; color: string | null; user_id: string }
) {
  const url = `${supabaseUrl}/rest/v1/folders?select=*`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify([row]),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create folder failed (${res.status}): ${err}`);
  }
  return (await res.json())[0];
}

/* ---------- Page ---------- */

function DecksPage() {
  const user = useUser();
  const { isLoading } = useSessionContext();
  const showMock = !user && !isLoading; // ← mock only if logged out

  // UI state
  const [decks, setDecks] = useState<Deck[]>(showMock ? MOCK_DECKS : []);
  const [folders, setFolders] = useState<FolderUI[]>(showMock ? MOCK_FOLDERS : []);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  // Create Folder modal state
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<ColorName>("blue");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);

  // Edit Folder modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [folderToEdit, setFolderToEdit] = useState<FolderUI | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editColorName, setEditColorName] = useState<ColorName>("blue");

  /* ---------- Data Fetch ---------- */
  // Robust fetch for folders and decks
  // const [dataLoading, setDataLoading] = useState(false); // no longer used
  const fetchUserData = useCallback(async () => {
    if (!user) return;
  // setDataLoading(true);
    try {
      // Fetch folders and decks in parallel for speed
      const [folderRes, deckRes] = await Promise.all([
        supabase.from("folders").select("*").eq("user_id", user.id),
        supabase.from("decks").select("*").eq("user_id", user.id)
      ]);
      const { data: folderData, error: folderError } = folderRes;
      const { data: deckData, error: deckError } = deckRes;
      if (!folderError && Array.isArray(folderData)) {
        setFolders((folderData as FolderRow[]).map(mapRowToUI));
      }
      if (!deckError && Array.isArray(deckData)) {
        setDecks(
          deckData.map((d) => ({
            id: Number(d.id),
            folderId: d.folder_id ? Number(d.folder_id) : undefined,
            tag: typeof d.tag === 'string' ? d.tag : "",
            title: typeof d.title === 'string' ? d.title : "New Deck",
            locked: Boolean(d.locked),
            mastery: typeof d.mastery === 'number' ? d.mastery : 0,
            bloomLevel: typeof d.bloomLevel === 'string' ? d.bloomLevel : "",
            created_at: typeof d.created_at === 'string' ? d.created_at : undefined
          }))
        );
      }
    } finally {
      // setDataLoading(false);
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (user && !showMock) {
      fetchUserData();
    }
  }, [user, showMock, fetchUserData]);

  // Call fetchUserData after deck/folder creation (patch button logic)

  /* ---------- Handlers ---------- */

  // CREATE
  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFolderName.trim()) {
      setFolderError("Folder name is required.");
      return;
    }
    setFolderLoading(true);
    setFolderError(null);
    try {
      if (user && !showMock) {
        const {
          data: { user: authUser },
          error: uerr,
        } = await supabase.auth.getUser();
        if (uerr || !authUser) throw new Error("Not signed in");

        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr || !sessionData?.session) throw new Error("No session");

        const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // Manual fetch to avoid ?columns= in Supabase
        await createFolderRaw(
          envUrl,
          envKey,
          sessionData.session.access_token,
          { name: newFolderName.trim(), color: newFolderColor, user_id: authUser.id }
        );

        // Refresh list
        const { data } = await supabase.from("folders").select("*");
        if (Array.isArray(data)) setFolders((data as FolderRow[]).map(mapRowToUI));
      } else {
        // Local mock path
        setFolders((prev) => [...prev, { id: Date.now(), name: newFolderName.trim(), ...toColorClasses(newFolderColor) }]);
      }

      setIsCreateFolderOpen(false);
      setNewFolderName("");
      setNewFolderColor("blue");
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setFolderLoading(false);
    }
  };

  // EDIT
  useEffect(() => {
    if (folderToEdit) {
      setEditName(folderToEdit.name);
      setEditColorName(folderToEdit.colorName);
    } else {
      setEditName("");
      setEditColorName("blue");
    }
  }, [folderToEdit]);

  const handleSaveEdit = useCallback(async () => {
    if (!folderToEdit) return;

    if (user && !showMock) {
      const { error } = await supabase
        .from("folders")
        .update({ name: editName.trim(), color: editColorName })
        .eq("id", folderToEdit.id)
        .select()
        .single();
      if (error) console.error(error);

      const { data } = await supabase.from("folders").select("*");
      if (Array.isArray(data)) setFolders((data as FolderRow[]).map(mapRowToUI));
    } else {
      setFolders((prev) =>
        prev.map((fld) =>
          fld.id === folderToEdit.id
            ? { ...fld, name: editName.trim(), ...toColorClasses(editColorName) }
            : fld
        )
      );
    }
    setIsEditModalOpen(false);
    setFolderToEdit(null);
  }, [folderToEdit, editName, editColorName, user, showMock]);

  /* ---------- Derived ---------- */

  const activeFolder = useMemo(
    () => (activeFolderId === null ? null : folders.find((f) => f.id === activeFolderId) ?? null),
    [activeFolderId, folders]
  );

  const decksToDisplay = useMemo(() => {
    if (activeFolderId === null) {
      // Show only the 4 most recent decks (by created_at if available, else by id)
      const sorted = [...decks].sort((a, b) => {
        // If created_at exists, sort by it, else by id
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.id - a.id;
      });
      return sorted.slice(0, 4);
    }
    // Show all decks in the selected folder
    return decks.filter((d) => d.folderId === activeFolderId);
  }, [activeFolderId, decks]);

  /* ---------- UI ---------- */

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* accents */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23ffffff;stop-opacity:0.1' /%3E%3Cstop offset='100%25' style='stop-color:%23f9f9f9;stop-opacity:0.1' /%3C/linearGradient%3E%3C/defs%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='url(%23grad)'/%3E%3C/svg%3E\"), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M0 50 Q 25 25, 50 50 T 100 50' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 60 Q 25 35, 50 60 T 100 60' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 70 Q 25 45, 50 70 T 100 70' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3C/svg%3E\")",
        }}
      />

      <div aria-hidden className="pointer-events-none fixed bottom-0 right-0 -z-10 w-1/2 h-1/2 bg-gradient-to-tr from-cyan-50 to-blue-100 opacity-20 blur-3xl" />

      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-[#111418] mb-2">
          {(() => {
            if (!user) return "Welcome Back, Agent";
            const full = (user.user_metadata?.full_name as string | undefined) || "";
            const firstFromFull = full.trim().split(/\s+/)[0] || "";
            const firstFromEmail = (user.email || "").split("@")[0];
            const first = firstFromFull || firstFromEmail || "Agent";
            return `Welcome Back, ${first}`;
          })()}
        </h2>
        <p className="text-[#637488] mb-6">Let&apos;s get learning.</p>

        {/* Search (disabled) */}
        <div className="relative mb-2">
          <input
            type="search"
            placeholder="Search your decks... (Coming Soon)"
            disabled
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:border-transparent transition-shadow shadow-sm"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="20" height="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden>
              <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-[#637488] italic px-2">Tip: Consistent review is the key to long-term memory.</p>

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
              <button
                type="button"
                className="bg-[#f0f2f4] text-[#111418] font-bold py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
                onClick={async () => {
                  // Create blank deck in DB, assign to folder if active, and include user_id
                  if (!user) return;
                  const folder_id = activeFolderId ?? null;
                  const { data, error } = await supabase
                    .from("decks")
                    .insert([{ title: "New Deck", description: "", folder_id, user_id: user.id }])
                    .select("*")
                    .single();
                  if (error || !data?.id) return;
                  // Refetch decks from Supabase to ensure UI is up to date
                  const { data: decksData, error: decksError } = await supabase
                    .from("decks")
                    .select("*")
                    .eq("user_id", user.id);
                  if (!decksError && Array.isArray(decksData)) {
                    setDecks(
                      decksData.map((d) => ({
                        id: Number(d.id),
                        folderId: d.folder_id ? Number(d.folder_id) : undefined,
                        tag: typeof d.tag === 'string' ? d.tag : "",
                        title: typeof d.title === 'string' ? d.title : "New Deck",
                        locked: Boolean(d.locked),
                        mastery: typeof d.mastery === 'number' ? d.mastery : 0,
                        bloomLevel: typeof d.bloomLevel === 'string' ? d.bloomLevel : ""
                      }))
                    );
                  }
                  // Redirect to edit page
                  window.location.href = `/decks/${data.id}/edit`;
                }}
              >
                New Deck
              </button>
              <button
                type="button"
                className="bg-[#1f8fff] text-white font-bold py-2 px-4 rounded-md hover:bg-[#2481f9] focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
                onClick={() => setIsCreateFolderOpen(true)}
              >
                New Folder
              </button>

              {/* Create Folder Modal */}
              <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogContent className="sm:rounded-2xl bg-white">
                  <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                  </DialogHeader>
                  <form className="space-y-6" onSubmit={handleCreateFolder}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="folder-name">
                        Folder Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        id="folder-name"
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        required
                        disabled={folderLoading}
                        placeholder="e.g., Biology 101"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                      <div className="flex gap-4 items-center">
                        {COLOR_NAMES.map((name) => {
                          const bg = toColorClasses(name).colorClass.replace("text-", "bg-");
                          const selected = newFolderColor === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${bg} ${selected ? "ring-2 ring-blue-400" : ""}`}
                              onClick={() => setNewFolderColor(name)}
                              aria-label={name}
                              disabled={folderLoading}
                            >
                              {selected && <span className="h-4 w-4 rounded-full border-2 border-white bg-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {folderError && <div className="text-red-500 text-sm">{folderError}</div>}
                    <DialogFooter className="mt-6 flex justify-end gap-4">
                      <button
                        type="button"
                        className="text-gray-600 font-medium hover:text-gray-900 transition-colors"
                        onClick={() => setIsCreateFolderOpen(false)}
                        disabled={folderLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-400 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-500 transition-colors"
                        disabled={folderLoading}
                      >
                        Create Folder
                      </button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {decksToDisplay.map((d) => (
              <div
                key={d.id}
                className="group [perspective:1000px] cursor-pointer"
                onClick={() => (window.location.href = `/decks/${d.id}/edit`)}
              >
                <div className="relative w-full aspect-[3/4] bg-white rounded-xl shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-2 [transform-style:preserve-3d] group-hover:[transform:rotateY(3deg)]">
                  <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
                    {d.locked && (
                      <div className="absolute top-2 right-2 p-1.5 bg-[#ffc107]/20 text-[#ffc107] rounded-full">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    <p className="text-lg font-medium text-[#637488]">{d.tag}</p>
                  </div>
                  <div className="absolute bottom-4 left-4 text-sm font-medium text-[#111418]">{d.title}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Folders */}
        <section className="mt-12">
          <h3 className="text-2xl font-semibold text-[#111418] mb-4">Folders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {folders.map((f) => {
              const deckCount = decks.filter((d) => d.folderId === f.id).length;
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
                  <div className={`w-12 h-12 flex-shrink-0 rounded-lg ${f.iconBgClass} ${f.colorClass} flex items-center justify-center`}>
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2M7 7h10" />
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
          <Dialog
            open={isEditModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsEditModalOpen(false);
                setFolderToEdit(null);
              }
            }}
          >
            <DialogContent className="sm:rounded-2xl bg-white">
              <DialogHeader>
                <DialogTitle>Edit Folder</DialogTitle>
              </DialogHeader>
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-folder-name">
                    Folder Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-folder-name"
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    placeholder="e.g., Biology 101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-4 items-center">
                    {COLOR_NAMES.map((name) => {
                      const bg = toColorClasses(name).colorClass.replace("text-", "bg-");
                      const selected = editColorName === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${bg} ${selected ? "ring-2 ring-blue-400" : ""}`}
                          onClick={() => setEditColorName(name)}
                          aria-label={name}
                        >
                          {selected && <span className="h-4 w-4 rounded-full border-2 border-white bg-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <DialogFooter className="mt-6 flex justify-end gap-4">
                  <button
                    type="button"
                    className="text-gray-600 font-medium hover:text-gray-900 transition-colors"
                    onClick={() => { setIsEditModalOpen(false); setFolderToEdit(null); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bg-blue-400 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-500 transition-colors"
                    onClick={handleSaveEdit}
                  >
                    Save changes
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </main>
  );
}

export default DecksPage;
