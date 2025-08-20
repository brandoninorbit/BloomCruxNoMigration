"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import useDeck from "@/hooks/useDeck";
import useFolders from "@/hooks/useFolders";
import AddCardModal from "@/components/decks/AddCardModal";
import * as cardsRepo from "@/lib/cardsRepo";
import { parseCsv, type ImportPayload } from "@/lib/csvImport";
import { hasImportHash, recordImportHash } from "@/lib/cardsRepo";

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
  const [pendingImport, setPendingImport] = useState<null | {
    fileName: string;
    fileHash: string;
    okRows: { index: number; payload: ImportPayload }[];
    errRows: { index: number; errors: string[] }[];
    warnings: string[];
  }>(null);
  const [showImportErrors, setShowImportErrors] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

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

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Compute a SHA-256 hash of the file to guard against re-imports
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      // Check if this file was already imported for this deck (across sessions)
      try {
        const already = await hasImportHash(Number(deckId), hash);
        if (already) {
          toast({ title: "Already imported", description: `This file appears to be already imported for this deck.`, variant: "destructive" });
          return;
        }
      } catch {
        // ignore check errors; allow import to proceed
      }

      const { okRows, badRows, warnings } = parseCsv(await file.text());
      if (!okRows.length && !badRows.length) {
        toast({ title: "CSV empty", description: "No rows found.", variant: "destructive" });
        return;
      }
      setPendingImport({ fileName: file.name, fileHash: hash, okRows, errRows: badRows, warnings });
      setShowImportErrors(false);
      if (badRows.length) {
        toast({ title: `Parsed ${okRows.length} OK, ${badRows.length} failed`, description: `Review options below to continue.`, variant: "default" });
      } else {
        toast({ title: `Ready to import ${okRows.length} cards`, description: `Click Add Imported Cards to Deck to proceed.` });
      }
    } catch (err) {
      toast({ title: "CSV parse failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const removeSource = async (name: string) => {
    try {
      const deleted = await cardsRepo.removeBySource(Number(deckId), name);
      try {
        const refreshed = await cardsRepo.listSourcesByDeck(Number(deckId));
        setDeck((prev) => (prev ? { ...prev, sources: refreshed } : prev));
      } catch {
        const next = sources.filter((s: string) => s !== name);
        setDeck((prev) => (prev ? { ...prev, sources: next } : prev));
      }
      toast({ title: "Source removed", description: `Deleted ${deleted} cards from ${name}` });
      // Also trigger a reload event so any editor lists/cards refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("deck-cards:reload"));
      }
    } catch (e) {
      toast({ title: "Failed to remove source", description: (e as Error).message, variant: "destructive" });
    }
  };

  const commitPendingImport = async () => {
    if (!pendingImport) return;
    if (importing) return; // prevent double-click
    setImporting(true);
    const filename = pendingImport.fileName;
  const fileHash = pendingImport.fileHash;
    const created = await cardsRepo.createMany(
      pendingImport.okRows.map((r) => {
        const tmap = {
          mcq: 'Standard MCQ',
          short: 'Short Answer',
          fill: 'Fill in the Blank',
          sorting: 'Sorting',
          sequencing: 'Sequencing',
          compare: 'Compare/Contrast',
          twoTier: 'Two-Tier MCQ',
          cer: 'CER',
        } as const;
        const p = r.payload as ImportPayload;
        if (p.type === 'short') {
          return {
            deckId: Number(deckId),
            type: tmap[p.type],
            question: p.question,
            bloomLevel: p.bloom,
            explanation: p.explanation,
            meta: { suggestedAnswer: p.meta.suggestedAnswer ?? '' },
            source: filename,
          } satisfies cardsRepo.NewDeckCard;
        }
        if (p.type === 'fill') {
          const blanks = p.meta.answers.map((answer, i) => ({
            id: i + 1,
            answers: [answer, ...(p.meta.alternates[i] || [])],
            mode: p.meta.perBlank?.[i + 1]?.mode,
            caseSensitive: p.meta.perBlank?.[i + 1]?.caseSensitive ?? p.meta.caseSensitive,
            ignorePunct: p.meta.perBlank?.[i + 1]?.ignorePunct ?? p.meta.ignorePunct,
          }));
          return {
            deckId: Number(deckId),
            type: tmap[p.type],
            question: p.question,
            bloomLevel: p.bloom,
            explanation: p.explanation,
            meta: {
              mode: p.meta.mode,
              blanks,
              options: p.meta.options,
              caseSensitive: p.meta.caseSensitive,
              ignorePunct: p.meta.ignorePunct,
            },
            source: filename,
          } satisfies cardsRepo.NewDeckCard;
        }
        if (p.type === 'sorting') {
          return {
            deckId: Number(deckId),
            type: tmap[p.type],
            question: p.question,
            bloomLevel: p.bloom,
            explanation: p.explanation,
            meta: { categories: p.meta.categories, items: p.meta.items.map((it) => ({ term: it.term, correctCategory: it.category })) },
            source: filename,
          } satisfies cardsRepo.NewDeckCard;
        }
        if (p.type === 'cer') {
          return {
            deckId: Number(deckId),
            type: tmap[p.type],
            question: p.question,
            bloomLevel: p.bloom,
            explanation: p.explanation,
            meta: {
              mode: p.meta.mode,
              guidanceQuestion: p.meta.guidance,
              claim: p.meta.claim ?? {},
              evidence: p.meta.evidence ?? {},
              reasoning: p.meta.reasoning ?? {},
            },
            source: filename,
          } satisfies cardsRepo.NewDeckCard;
        }
        if (p.type === 'mcq' || p.type === 'compare' || p.type === 'sequencing' || p.type === 'twoTier') {
          return {
            deckId: Number(deckId),
            type: tmap[p.type],
            question: p.question,
            bloomLevel: p.bloom,
            explanation: p.explanation,
            meta: p.meta,
            source: filename,
          } satisfies cardsRepo.NewDeckCard;
        }
        // Fallback should never occur due to exhaustive union above
        throw new Error('Unsupported payload type');
      })
    );
    // Track source name once upon successful insert
    try {
      const refreshed = await cardsRepo.listSourcesByDeck(Number(deckId));
      setDeck((prev) => (prev ? { ...prev, sources: refreshed } : prev));
    } catch {
      const current = new Set(sources);
      if (!current.has(filename)) {
        const newSources = [...sources, filename];
        setDeck((prev) => (prev ? { ...prev, sources: newSources } : prev));
      }
    }
    setPendingImport(null);
    setShowImportErrors(false);
    setSourceMsg(`Imported ${created} cards from ${filename}`);
    toast({ title: `Imported ${created} cards`, description: filename });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("deck-cards:reload"));
    }
  // Record the import hash (best-effort)
  try { await recordImportHash(Number(deckId), filename, fileHash); } catch {}
    setImporting(false);
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
      {pendingImport && (
            <div className="mt-4">
              <button
        className="w-full bg-white text-[#2481f9] border border-[#2481f9] px-5 py-3 rounded-lg font-semibold inline-flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                type="button"
                onClick={() => {
                  if (importing) { toast({ title: "Import in progress", description: "Please wait—this may take a moment." }); return; }
                  void commitPendingImport();
                }}
        disabled={importing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
                </svg>
        <span>{importing ? "Importing…" : "Add Imported Cards to Deck"}</span>
              </button>
            </div>
          )}
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
          {pendingImport && (
            <div className="mt-4 space-y-3">
              {pendingImport.errRows.length > 0 ? (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                  {pendingImport.okRows.length} rows OK, {pendingImport.errRows.length} failed. Choose an action:
                </div>
              ) : (
                <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
                  {pendingImport.okRows.length} rows parsed and ready.
                </div>
              )}
              {pendingImport.errRows.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    className="w-full bg-[#2481f9] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    type="button"
                    onClick={() => {
                      if (importing) { toast({ title: "Import in progress", description: "Please wait—this may take a moment." }); return; }
                      void commitPendingImport();
                    }}
                    disabled={importing}
                  >
                    {importing ? "Importing…" : "Import successful cards"}
                  </button>
                  <button
                    className="w-full border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    type="button"
                    onClick={() => setPendingImport(null)}
                  >
                    Don&apos;t import anything
                  </button>
                </div>
              )}
              {pendingImport.errRows.length > 0 && (
                <div>
                  <button
                    className="text-sm text-gray-700 underline underline-offset-2"
                    type="button"
                    onClick={() => setShowImportErrors((v) => !v)}
                  >
                    What went wrong?
                  </button>
                  {showImportErrors && (
                    <ul className="mt-2 list-disc pl-6 text-sm text-gray-700 max-h-40 overflow-auto">
                      {pendingImport.errRows.slice(0, 200).map((e) => (
                        <li key={e.index}>Row {e.index}: {e.errors.join('; ')}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
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
                className="text-red-500 hover:text-red-700 inline-flex items-center gap-2"
                onClick={() => removeSource(name)}
                aria-label={`Remove ${name}`}
                title="Delete all cards from this source"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 6v12m6-12v12M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14M10 6l1-2h2l1 2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* NOTE: Cards section is rendered by EditDeckClient BELOW this component */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-lg max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">CSV Import — Reference</h3>
              <button
                className="text-gray-500 hover:text-gray-800"
                onClick={() => setShowInstructions(false)}
                aria-label="Close"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-gray-700">
              <p className="mb-2">CSV requirements and supported columns (matches current parser behavior):</p>
              <ul className="list-disc pl-5">
                <li>Include a header row.</li>
                <li><span className="font-medium">CardType</span> is required. Accepted: <span className="font-mono">Standard MCQ, Short Answer, Fill in the Blank, Sorting, Sequencing, Compare/Contrast, Two-Tier MCQ, CER</span>. Aliases: <span className="font-mono">MCQ</span>, <span className="font-mono">Short</span>, <span className="font-mono">Fill</span>, <span className="font-mono">Compare</span>, <span className="font-mono">TwoTierMCQ</span>, <span className="font-mono">CER</span>.</li>
                <li>Title can be in <span className="font-mono">Question</span>, <span className="font-mono">Prompt</span>, or <span className="font-mono">Scenario</span>.</li>
                <li>Optional: <span className="font-mono">BloomLevel</span> (case-insensitive; accepts <span className="font-mono">Analyze/Analyse</span>) and <span className="font-mono">Explanation</span>. If omitted, Bloom defaults by type: MCQ/Fill → Remember; Short/Sorting/Sequencing → Understand; Two-Tier → Evaluate; Compare/Contrast → Analyze; CER → Evaluate.</li>
                <li>Unknown columns are ignored. Use the exact casing below for best results.</li>
              </ul>

              <h4 className="mt-4 font-semibold">By Card Type</h4>

              <p className="mt-2"><span className="font-medium">Standard MCQ</span></p>
              <ul className="list-disc pl-5">
                <li>Always include <span className="font-mono">A</span>, <span className="font-mono">B</span>, <span className="font-mono">C</span>, <span className="font-mono">D</span>. Aliases like <span className="font-mono">OptionA</span>/<span className="font-mono">Option A</span> are tolerated but discouraged.</li>
                <li><span className="font-mono">Answer</span> is required and must be one of <span className="font-mono">A|B|C|D</span> (case-insensitive).</li>
                <li>Option cells may include labels like <span className="font-mono">A)</span>, <span className="font-mono">B:</span>, <span className="font-mono">C.</span> — these are stripped.</li>
              </ul>

              <p className="mt-2"><span className="font-medium">Short Answer</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">SuggestedAnswer</span> (or <span className="font-mono">Suggested</span> or <span className="font-mono">Answer</span>): sample answer text.</li>
              </ul>

              <p className="mt-2"><span className="font-medium">Fill in the Blank</span></p>
              <ul className="list-disc pl-5">
                <li>One blank: <span className="font-mono">Answer</span>. Multiple blanks: <span className="font-mono">Answer1</span>, <span className="font-mono">Answer2</span>, … (up to 20).</li>
                <li>For multiple blanks, the prompt must include placeholders <span className="font-mono">[[1]]</span>, <span className="font-mono">[[2]]</span>, … up to the highest numbered answer.</li>
                <li>Alternates per blank: <span className="font-mono">Answer{`{n}` }Alt</span> as pipe list. Example: <span className="font-mono">Answer2Alt: &quot;mitochondrion|mito&quot;</span>.</li>
                <li>Row flags: <span className="font-mono">CaseSensitive</span>, <span className="font-mono">IgnorePunct</span> accept <span className="font-mono">1/true/yes/y</span>.</li>
                <li>Per-blank overrides: <span className="font-mono">Blank{`{n}` }Mode</span> (<span className="font-mono">Free Text</span> | <span className="font-mono">Drag & Drop</span> | <span className="font-mono">Either</span>), <span className="font-mono">Blank{`{n}` }CaseSensitive</span>, <span className="font-mono">Blank{`{n}` }IgnorePunct</span>.</li>
                <li><span className="font-mono">Mode</span> (row-level default): if not provided, it defaults to <span className="font-mono">Free Text</span>.</li>
                <li><span className="font-mono">Options</span> (word bank) is a pipe list. It is never auto-seeded; include it explicitly when needed.</li>
              </ul>
              <div className="mt-2 space-y-1 text-xs">
                <div className="text-gray-600">Example (Free Text, multiple blanks):</div>
                <div className="font-mono">CardType,Prompt,Answer1,Answer2</div>
                <div className="font-mono">Fill in the Blank,&quot;Energy carriers include [[1]] and [[2]]&quot;,ATP,NADH</div>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="text-gray-600">Example (Drag &amp; Drop with options bank):</div>
                <div className="font-mono">CardType,Prompt,Mode,Answer1,Answer2,Options</div>
                <div className="font-mono">Fill in the Blank,&quot;Label the parts: [[1]] and [[2]]&quot;,&quot;Drag &amp; Drop&quot;,Nucleus,Chloroplast,&quot;Nucleus|Chloroplast|Mitochondria|Golgi&quot;</div>
              </div>

              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Grading notes:</span> By default, grading is case-insensitive and ignores punctuation unless overridden by row or per-blank flags.
              </div>

              <p className="mt-2"><span className="font-medium">Sorting</span></p>
              <ul className="list-disc pl-5">
                <li>Requires both <span className="font-mono">Categories</span> and <span className="font-mono">Items</span>.</li>
                <li><span className="font-mono">Categories</span>: pipe-delimited, e.g. <span className="font-mono">Mammal|Bird|Reptile</span></li>
                <li><span className="font-mono">Items</span>: entries as <span className="font-mono">term:category</span> pipe-delimited, e.g. <span className="font-mono">Dog:Mammal|Eagle:Bird</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Sequencing</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">Steps</span> (or <span className="font-mono">Items</span>): pipe-delimited, e.g. <span className="font-mono">First|Second|Third</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Compare/Contrast</span></p>
              <ul className="list-disc pl-5">
                <li>Requires <span className="font-mono">ItemA</span> and <span className="font-mono">ItemB</span> (or <span className="font-mono">A</span>/<span className="font-mono">B</span>).</li>
                <li><span className="font-mono">Points</span> must follow <span className="font-mono">Feature::a::b</span>, pipe-delimited. Example: <span className="font-mono">Backbone::Sequence::Local folding|Bonds::Peptide::H-bonds</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Two-Tier MCQ</span></p>
              <ul className="list-disc pl-5">
                <li>Tier 1 requires <span className="font-mono">A</span>, <span className="font-mono">B</span>, <span className="font-mono">C</span>, <span className="font-mono">D</span>, and <span className="font-mono">Answer</span> (A|B|C|D). Labels like <span className="font-mono">A) text</span> are OK.</li>
                <li>Tier 2 requires <span className="font-mono">RQuestion</span>, <span className="font-mono">RA</span>, <span className="font-mono">RB</span>, <span className="font-mono">RC</span>, <span className="font-mono">RD</span>, and <span className="font-mono">RAnswer</span> (A|B|C|D). <span className="font-mono">RA..RD</span> also accept labels like <span className="font-mono">A) text</span>.</li>
              </ul>

              <p className="mt-2"><span className="font-medium">CER (Claim–Evidence–Reasoning)</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">Mode</span>: <span className="font-mono">Free Text</span> or <span className="font-mono">Multiple Choice</span> (also accepts <span className="font-mono">MC</span> / <span className="font-mono">Multiple</span>).</li>
                <li><span className="font-mono">Guidance</span> (or <span className="font-mono">GuidanceQuestion</span>): optional guidance prompt.</li>
                <li>If Mode = Multiple Choice:
                  <ul className="list-disc pl-5">
                    <li><span className="font-mono">ClaimOptions</span>, <span className="font-mono">ClaimCorrect</span> (1-based index)</li>
                    <li><span className="font-mono">EvidenceOptions</span>, <span className="font-mono">EvidenceCorrect</span> (1-based index)</li>
                    <li><span className="font-mono">ReasoningOptions</span>, <span className="font-mono">ReasoningCorrect</span> (1-based index)</li>
                  </ul>
                </li>
                <li>If Mode = Free Text (required fields):
                  <ul className="list-disc pl-5">
                    <li><span className="font-mono">Claim</span>, <span className="font-mono">Evidence</span>, <span className="font-mono">Reasoning</span> sample answers</li>
                  </ul>
                </li>
              </ul>

              <h4 className="mt-4 font-semibold">Workflow</h4>
              <ul className="list-disc pl-5">
                <li>Upload your CSV; we parse and show counts of successful and failed rows.</li>
                <li>Click <span className="font-medium">Add Imported Cards to Deck</span> to commit successful rows.</li>
                <li>If some rows fail, use <span className="font-medium">Import successful cards</span> or <span className="font-medium">Don&apos;t import anything</span>, and check <span className="font-medium">What went wrong?</span> for error details.</li>
                <li className="text-gray-500">Tips:
                  <ul className="list-disc pl-5">
                    <li>Use <span className="font-mono">Question</span> (or <span className="font-mono">Prompt</span>/<span className="font-mono">Scenario</span>) for the title.</li>
                    <li>MCQ/Two‑Tier: labels like <span className="font-mono">A) text</span> are accepted and normalized.</li>
                    <li>Fill: <span className="font-mono">Options</span> is never auto-seeded; include it explicitly when using <span className="font-mono">Drag & Drop</span>.</li>
                  </ul>
                </li>
              </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <a
                className="text-sm text-blue-600 hover:text-blue-800 underline"
                href="/docs/csv-import"
                target="_blank"
                rel="noopener noreferrer"
                title="Open full CSV guide in a new tab"
              >
                View full guide
              </a>
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
    onSubmit={async (payload) => {
          const created = await cardsRepo.create({
            deckId: Number(deckId),
            type: payload.type,
            bloomLevel: payload.bloomLevel,
            question: payload.question,
            explanation: payload.explanation,
            meta: payload.meta,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("deck-card:created", { detail: { card: created } }));
          }
          toast({ title: "Card created" });
        }}
      />
    </>
  );
}
