"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import useDeck from "@/hooks/useDeck";
import useFolders from "@/hooks/useFolders";
import AddCardModal from "@/components/decks/AddCardModal";
import * as cardsRepo from "@/lib/cardsRepo";

type Props = {
  deckId: string;
};

export default function EditDeckForm({ deckId }: Props) {
  const folders = useFolders();
  const router = useRouter();
  const { toast } = useToast();
  const { deck, setDeck, save, loading, error } = useDeck(deckId);

  const [sourceMsg, setSourceMsg] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showAddCard, setShowAddCard] = useState<boolean>(false);

  if (!deckId) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold text-gray-900">No deck selected</h1>
        <p className="mt-2 text-gray-600">Choose a deck from the Decks page.</p>
        <button
          className="mt-4 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={() => router.push("/decks")}
        >
          Back to Decks
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-10">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="mt-4 h-4 w-80 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-gray-600">{error}</p>
        <button
          className="mt-4 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={() => router.push("/decks")}
        >
          Back to Decks
        </button>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold text-gray-900">Deck not found</h1>
        <p className="mt-2 text-gray-600">The deck you’re looking for doesn’t exist.</p>
        <button
          className="mt-4 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={() => router.push("/decks")}
        >
          Back to Decks
        </button>
      </div>
    );
  }

  const title = deck.title ?? "";
  const description = deck.description ?? "";
  const sources: string[] = Array.isArray(deck.sources) ? deck.sources : [];

  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDeck((prev) => (prev ? { ...prev, title: value } : prev));
  };

  const onDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDeck((prev) => (prev ? { ...prev, description: value } : prev));
  };

  const onFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? Number(e.target.value) : null;
    setDeck((prev) => (prev ? { ...prev, folder_id: value } : prev));
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const current = new Set(sources);
    if (!current.has(file.name)) {
      const newSources = [...sources, file.name];
      setDeck((prev) => (prev ? { ...prev, sources: newSources } : prev));
      setSourceMsg(`Added source: ${file.name}`);
      toast({ title: "Source added", description: file.name });
    } else {
      setSourceMsg(`Source already added: ${file.name}`);
      toast({
        title: "Source already added",
        description: file.name,
        variant: "destructive",
      });
    }
  };

  const removeSource = (name: string) => {
    const next = sources.filter((s: string) => s !== name);
    setDeck((prev) => (prev ? { ...prev, sources: next } : prev));
    toast({ title: "Source removed", description: name });
  };

  const handleSave = async () => {
    await save();
    setSourceMsg("Saved changes to deck.");
    toast({ title: "Deck saved" });
  };

  return (
    <>
      {/* Header row */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Deck</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/decks")}
            className="text-gray-600 font-medium hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-[#2481f9] text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-600 transition-colors"
          >
            Save Changes to Deck
          </button>
        </div>
      </div>

      {/* Title / Description / Folder */}
      <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <p className="text-sm text-gray-500 mb-4">
          Editing Deck:{" "}
          <span className="font-semibold text-gray-700">
            {title || "Untitled"}
          </span>
        </p>
        <div className="space-y-6">
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="deck-title"
            >
              Deck Title
            </label>
            <input
              id="deck-title"
              type="text"
              value={title}
              onChange={onTitleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="description"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={onDescriptionChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="deck-folder"
            >
              Folder
            </label>
            <select
              id="deck-folder"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={deck.folder_id ?? ""}
              onChange={onFolderChange}
            >
              <option value="">None</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Deck Actions */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Deck Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              className="w-full bg-[#2481f9] text-white px-5 py-3 rounded-lg font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-blue-600 transition-colors"
              onClick={() => setShowAddCard(true)}
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Card</span>
            </button>
            <button
              className="w-full border border-gray-300 text-gray-700 px-5 py-3 rounded-lg font-semibold inline-flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.11a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.57a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.845.61l-4.725-2.885a.563.563 0 00-.586 0L6.258 20.506a.562.562 0 01-.845-.61l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.57a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.11z"
                />
              </svg>
              <span>Study Starred</span>
            </button>
          </div>
        </div>

        {/* Import From CSV */}
        <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Import From CSV</h2>
            <button
              onClick={() => setShowInstructions(true)}
              className="bg-blue-100 text-[#2481f9] px-4 py-2 rounded-full font-semibold text-sm inline-flex items-center gap-2 hover:bg-blue-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75h.008v.008H12V9.75z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 12h1.5v6h-1.5z" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span>Instructions</span>
            </button>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Upload a CSV and click the instructions button for formatting help.
          </p>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 010-8 5 5 0 019.584-1.003A4.5 4.5 0 1117.5 16H7z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v7m0 0l-3-3m3 3l3-3" />
                </svg>
                <span className="font-medium">Upload CSV</span>
                <span className="text-sm">No file chosen.</span>
              </div>
              <input id="csv-upload" type="file" className="hidden" onChange={onFileChange} />
            </label>
          </div>
          {sourceMsg && <p className="mt-3 text-xs text-gray-500">{sourceMsg}</p>}
        </div>
      </div>

      {/* Deck Sources */}
      <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Deck Sources</h2>
        <p className="text-gray-600 text-sm mb-4">
          This deck contains cards imported from the following files.
        </p>
        <ul className="space-y-3">
          {sources.length === 0 && (
            <li className="text-sm text-gray-500">No sources yet. Upload a CSV to add one.</li>
          )}
          {sources.map((name: string) => (
            <li
              key={name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <span className="material-icons text-gray-500">description</span>
                <span className="font-medium text-gray-800">{name}</span>
              </div>
              <button
                className="text-gray-500 hover:text-gray-800"
                onClick={() => removeSource(name)}
                aria-label={`Remove ${name}`}
              >
                <span className="material-icons text-xl">delete_outline</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* NOTE: Cards section is rendered by EditDeckClient BELOW this component */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">CSV Import — BloomCrux v1</h3>
              <button
                className="text-gray-500 hover:text-gray-800"
                onClick={() => setShowInstructions(false)}
                aria-label="Close"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Your CSV must include a header row. <span className="font-medium">CardType</span> is
                required and must be one of:
              </p>
              <p className="font-mono text-xs bg-gray-50 p-2 rounded">
                MCQ | TwoTierMCQ | Fill | Short | Compare | Sorting | Sequencing | CER
              </p>
              <p className="mt-2">
                <span className="font-medium">Common optional columns:</span>{" "}
                <span className="font-mono">BloomLevel</span>,{" "}
                <span className="font-mono">SelfCheck</span>,{" "}
                <span className="font-mono">Explanation</span>, <span className="font-mono">Id</span>.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowInstructions(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      <AddCardModal
        open={showAddCard}
        onClose={() => setShowAddCard(false)}
        onCreate={async (payload) => {
          // Create via repo, then notify listeners to refresh/append
          const created = await cardsRepo.create({
            id: 0 as unknown as number, // not used by create mapping
            deckId: Number(deckId),
            type: payload.type,
            bloomLevel: payload.bloomLevel,
            question: payload.question,
            explanation: payload.explanation,
            meta: payload.meta,
            position: undefined,
            createdAt: undefined,
            updatedAt: undefined,
          } as any);
          // Broadcast a custom event so EditDeckClient can append when loaded
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("deck-card:created", { detail: { card: created } })
            );
          }
          toast({ title: "Card created" });
        }}
      />
    </>
  );
}
