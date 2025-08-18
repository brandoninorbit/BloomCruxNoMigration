"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import useDeck from "@/hooks/useDeck";
import useFolders from "@/hooks/useFolders";
import AddCardModal from "@/components/decks/AddCardModal";
import * as cardsRepo from "@/lib/cardsRepo";
import { parseCsv, rowToPayload } from "@/lib/csvImport";

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
    okRows: { idx: number; payload: ReturnType<typeof rowToPayload> }[];
    errRows: { idx: number; error: string }[];
  }>(null);
  const [showImportErrors, setShowImportErrors] = useState<boolean>(false);

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
      const rows = await parseCsv(file);
      if (!rows.length) {
        toast({ title: "CSV empty", description: "No rows found.", variant: "destructive" });
        return;
      }
      const okRows: { idx: number; payload: ReturnType<typeof rowToPayload> }[] = [];
      const errRows: { idx: number; error: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const payload = rowToPayload(rows[i]);
          okRows.push({ idx: i + 2, payload }); // +2 = header + 1-based index
        } catch (err) {
          errRows.push({ idx: i + 2, error: (err as Error).message });
        }
      }
      setPendingImport({ fileName: file.name, okRows, errRows });
      setShowImportErrors(false);
      if (errRows.length) {
        toast({ title: `Parsed ${okRows.length} OK, ${errRows.length} failed`, description: `Review options below to continue.`, variant: "default" });
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
      const next = sources.filter((s: string) => s !== name);
      setDeck((prev) => (prev ? { ...prev, sources: next } : prev));
      toast({ title: "Source removed", description: `Deleted ${deleted} cards from ${name}` });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("deck-cards:reload"));
      }
    } catch (e) {
      toast({ title: "Failed to remove source", description: (e as Error).message, variant: "destructive" });
    }
  };

  const commitPendingImport = async () => {
    if (!pendingImport) return;
    const filename = pendingImport.fileName;
    let created = 0;
    for (const r of pendingImport.okRows) {
      const p = r.payload;
      await cardsRepo.create({
        deckId: Number(deckId),
        type: p.type,
        bloomLevel: p.bloomLevel,
        question: p.question,
        explanation: p.explanation,
        meta: p.meta,
        source: filename,
      });
      created++;
    }
    // Track source name once upon successful insert
    const current = new Set(sources);
    if (!current.has(filename)) {
      const newSources = [...sources, filename];
      setDeck((prev) => (prev ? { ...prev, sources: newSources } : prev));
    }
    setPendingImport(null);
    setShowImportErrors(false);
    setSourceMsg(`Imported ${created} cards from ${filename}`);
    toast({ title: `Imported ${created} cards`, description: filename });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("deck-cards:reload"));
    }
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
                className="w-full bg-white text-[#2481f9] border border-[#2481f9] px-5 py-3 rounded-lg font-semibold inline-flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                type="button"
                onClick={commitPendingImport}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
                </svg>
                <span>Add Imported Cards to Deck</span>
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
                    className="w-full bg-[#2481f9] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                    type="button"
                    onClick={commitPendingImport}
                  >
                    Import successful cards
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
                        <li key={e.idx}>Row {e.idx}: {e.error}</li>
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
              <h3 className="text-base font-semibold text-gray-900">CSV Import — BloomCrux v1</h3>
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
              <p className="mb-2">CSV requirements and supported columns:</p>
              <ul className="list-disc pl-5">
                <li>Include a header row.</li>
                <li>
                  <span className="font-medium">CardType</span> is required. Accepted values:
                  <span className="ml-1 font-mono">Standard MCQ, Short Answer, Fill in the Blank, Sorting, Sequencing, Compare/Contrast, Two-Tier MCQ, CER</span>
                  <br />Short aliases also work in <span className="font-mono">CardType</span>: <span className="font-mono">MCQ</span>, <span className="font-mono">Short</span>, <span className="font-mono">Fill</span>, <span className="font-mono">Compare</span>, <span className="font-mono">TwoTierMCQ</span>, <span className="font-mono">CER</span>.
                  <br />Only the above types are supported. Unsupported types are rejected.
                </li>
                <li>
                  Title can be in <span className="font-mono">Question</span>, <span className="font-mono">Prompt</span>, or <span className="font-mono">Scenario</span>.
                </li>
                <li>
                  Optional: <span className="font-mono">BloomLevel</span> (Remember, Understand, Apply, Analyze, Evaluate, Create) and <span className="font-mono">Explanation</span>.
                </li>
                <li>Unknown columns are ignored. Use the exact casing below for best results.</li>
                <li><span className="font-mono">BloomLevel</span> is case-insensitive and accepts <span className="font-mono">Analyze</span> or <span className="font-mono">Analyse</span>.</li>
              </ul>

              <h4 className="mt-4 font-semibold">By Card Type</h4>

              <p className="mt-2"><span className="font-medium">Standard MCQ</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">A</span>, <span className="font-mono">B</span>, <span className="font-mono">C</span>, <span className="font-mono">D</span>: option texts (aliases: <span className="font-mono">OptionA</span>/<span className="font-mono">Option A</span>, etc.)</li>
                <li><span className="font-mono">Answer</span>: one of A|B|C|D (case-insensitive)</li>
              </ul>

              <p className="mt-2"><span className="font-medium">Short Answer</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">SuggestedAnswer</span> (or <span className="font-mono">Suggested</span> or <span className="font-mono">Answer</span>): sample answer text</li>
              </ul>

              <p className="mt-2"><span className="font-medium">Fill in the Blank</span></p>
              <ul className="list-disc pl-5">
                <li>Default is one blank: use <span className="font-mono">Answer</span> for the correct value.</li>
                <li>Multiple blanks: use <span className="font-mono">Answer1</span>, <span className="font-mono">Answer2</span>, … (up to 20). If any numbered answers are present, we use those.</li>
                <li><span className="font-mono">Mode</span>: <span className="font-mono">Free Text</span> (default) or <span className="font-mono">Drag &amp; Drop</span> (also accepts <span className="font-mono">Drag and Drop</span> or <span className="font-mono">DnD</span>, case-insensitive).</li>
                <li>If Mode = Drag &amp; Drop: provide a bank via <span className="font-mono">Options</span> (pipe-delimited), e.g. <span className="font-mono">ATP|ADP|NADH</span>.</li>
                <li>Tip: In the prompt, mark blanks with underscores, e.g. <span className="font-mono">The powerhouse of the cell is the ___.</span></li>
              </ul>
              <div className="mt-2 space-y-1 text-xs">
                <div className="text-gray-600">Example (Free Text, multiple blanks):</div>
                <div className="font-mono">CardType,Prompt,Answer1,Answer2</div>
                <div className="font-mono">Fill in the Blank,&quot;Energy carriers include ___ and ___&quot;,ATP,NADH</div>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="text-gray-600">Example (Drag &amp; Drop with options bank):</div>
                <div className="font-mono">CardType,Prompt,Mode,Answer1,Answer2,Options</div>
                <div className="font-mono">Fill in the Blank,&quot;Label the parts: ___ and ___&quot;,&quot;Drag &amp; Drop&quot;,Nucleus,Chloroplast,&quot;Nucleus|Chloroplast|Mitochondria|Golgi&quot;</div>
              </div>

              <p className="mt-2"><span className="font-medium">Sorting</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">Categories</span>: pipe-delimited, e.g. <span className="font-mono">Mammal|Bird|Reptile</span></li>
                <li><span className="font-mono">Items</span>: entries as <span className="font-mono">term:category</span> pipe-delimited, e.g. <span className="font-mono">Dog:Mammal|Eagle:Bird</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Sequencing</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">Steps</span> (or <span className="font-mono">Items</span>): pipe-delimited, e.g. <span className="font-mono">First|Second|Third</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Compare/Contrast</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">ItemA</span>, <span className="font-mono">ItemB</span> (or simply <span className="font-mono">A</span> / <span className="font-mono">B</span>)</li>
                <li><span className="font-mono">Points</span>: each as <span className="font-mono">feature::a::b</span>, pipe-delimited. Example: <span className="font-mono">Speed::Fast::Slow|Color::Red::Blue</span></li>
              </ul>

              <p className="mt-2"><span className="font-medium">Two-Tier MCQ</span></p>
              <ul className="list-disc pl-5">
                <li>Tier 1: <span className="font-mono">A</span>, <span className="font-mono">B</span>, <span className="font-mono">C</span>, <span className="font-mono">D</span>, <span className="font-mono">Answer</span> (A|B|C|D)</li>
                <li>Tier 2: <span className="font-mono">RQuestion</span> (or <span className="font-mono">ReasoningQuestion</span>), <span className="font-mono">RA</span>, <span className="font-mono">RB</span>, <span className="font-mono">RC</span>, <span className="font-mono">RD</span>, <span className="font-mono">RAnswer</span> (A|B|C|D)</li>
              </ul>

              <p className="mt-2"><span className="font-medium">CER (Claim–Evidence–Reasoning)</span></p>
              <ul className="list-disc pl-5">
                <li><span className="font-mono">Mode</span>: <span className="font-mono">Free Text</span> or <span className="font-mono">Multiple Choice</span> (also accepts <span className="font-mono">MC</span> or <span className="font-mono">Multiple</span>, case-insensitive)</li>
                <li><span className="font-mono">Guidance</span> (or <span className="font-mono">GuidanceQuestion</span>): optional guidance question</li>
                <li>If Mode = Multiple Choice:
                  <ul className="list-disc pl-5">
                    <li><span className="font-mono">ClaimOptions</span>, <span className="font-mono">ClaimCorrect</span> (1-based index)</li>
                    <li><span className="font-mono">EvidenceOptions</span>, <span className="font-mono">EvidenceCorrect</span> (1-based index)</li>
                    <li><span className="font-mono">ReasoningOptions</span>, <span className="font-mono">ReasoningCorrect</span> (1-based index)</li>
                  </ul>
                </li>
                <li>If Mode = Free Text:
                  <ul className="list-disc pl-5">
                    <li><span className="font-mono">Claim</span>, <span className="font-mono">Evidence</span>, <span className="font-mono">Reasoning</span> (sample answers; optional)</li>
                  </ul>
                </li>
              </ul>

              <h4 className="mt-4 font-semibold">Workflow</h4>
              <ul className="list-disc pl-5">
                <li>Upload your CSV; we parse and show counts of successful and failed rows.</li>
                <li>Click <span className="font-medium">Add Imported Cards to Deck</span> to commit successful rows.</li>
                <li>If some rows fail, use <span className="font-medium">Import successful cards</span> or <span className="font-medium">Don&apos;t import anything</span>, and check <span className="font-medium">What went wrong?</span> for error details.</li>
                <li className="text-gray-500">Tip: Use <span className="font-mono">Question</span> (or <span className="font-mono">Prompt</span>/<span className="font-mono">Scenario</span>) for the title. For Compare/Contrast specifically, if it’s empty we’ll auto-title as <span className="font-mono">Compare A and B</span>.</li>
              </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
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
