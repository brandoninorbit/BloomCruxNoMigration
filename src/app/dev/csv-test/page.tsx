"use client";

import React from "react";
import { parseCsv, rowToPayload, type CsvRow, type ImportPayload } from "@/lib/csvImport";
import Papa from "papaparse";

type Case = { name: string; row: CsvRow };
type ParseResult = 
  | { idx: number; ok: true; payload: ImportPayload }
  | { idx: number; ok: false; error: string };

const cases: Case[] = [
  {
    name: "MCQ with mislabeled options (A/B/C/D)",
    row: {
      CardType: "Standard MCQ",
      Question: "Which functional group is common to all amino acids?",
      // Note the leading labels and swapped cells
      A: "B) Carboxyl",
      B: "A) Amino",
      C: "C) Hydroxyl",
      D: "D) Phosphate",
      Answer: "B",
      BloomLevel: "",
      Explanation: "All amino acids have an amino and a carboxyl group.",
    },
  },
  {
    name: "Two-Tier MCQ with RA/RB/RC/RD labels",
    row: {
      CardType: "Two-Tier MCQ",
      Question: "What does DNA polymerase do?",
      A: "A) Synthesizes DNA",
      B: "B) Synthesizes RNA",
      C: "C) Ligates DNA",
      D: "D) Unwinds DNA",
      Answer: "A",
      RQuestion: "Why is that correct?",
      RA: "C) Because it adds deoxynucleotides",
      RB: "A) Because it adds ribonucleotides",
      RC: "B) Because it removes primers",
      RD: "D) Because it breaks H-bonds",
      RAnswer: "C",
    },
  },
  {
    name: "Fill in the Blank with answers only (defaults to Drag & Drop and seeds word bank)",
    row: {
      CardType: "Fill in the Blank",
      Question: "Secondary protein structures include the [[1]] and [[2]].",
      Answer1: "alpha helix",
      Answer2: "beta sheet",
      // No Options, no Mode provided
    },
  },
  {
    name: "Compare/Contrast with points",
    row: {
      CardType: "Compare/Contrast",
      Question: "Compare primary vs secondary structure",
      ItemA: "Primary",
      ItemB: "Secondary",
      Points: "Backbone::Sequence of amino acids::Local folding|Bonds::Peptide::H-bonds",
    },
  },
  {
    name: "Sequencing steps",
    row: {
      CardType: "Sequencing",
      Question: "Order the levels of protein structure",
      Steps: "Primary|Secondary|Tertiary|Quaternary",
    },
  },
  {
    name: "CER Free Text with sample answers",
    row: {
      CardType: "CER",
      Question: "Do stem-loops in the 5' UTR affect translation?",
      Guidance: "Consider ribosome scanning.",
      Claim: "Yes, they can hinder scanning",
      Evidence: "Mutations that disrupt stem-loop increase translation",
      Reasoning: "Stem-loops create secondary structure that blocks scanning",
      Mode: "Free Text",
    },
  },
  {
    name: "CER Multiple Choice",
    row: {
      CardType: "CER",
      Question: "Predict the effect of strong 5' UTR hairpins.",
      Guidance: "Base pairing stability matters.",
      Mode: "Multiple Choice",
      ClaimOptions: "Decrease|Increase",
      ClaimCorrect: "1",
      EvidenceOptions: "Lower protein levels|Higher protein levels",
      EvidenceCorrect: "1",
      ReasoningOptions: "Blocks scanning|Enhances initiation",
      ReasoningCorrect: "1",
    },
  },
];

export default function CsvTestPage() {
  const results = cases.map(({ name, row }: Case) => {
    const csv = [Object.keys(row).join(","), Object.values(row).join(",")].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    if (okRows.length > 0) return { name, ok: true as const, payload: okRows[0].payload };
    return { name, ok: false as const, error: badRows[0]?.errors.join("; ") || "Invalid row" };
  });
  const SAMPLE = `CardType,Question,A,B,C,D,Answer,Explanation,BloomLevel,Mode,Answer1,Answer2,Options,Categories,Items,SuggestedAnswer
Standard MCQ,Which functional group is common to all amino acids?,A) Hydroxyl group,B) Carboxyl group,C) Sulfhydryl group,D) Methyl group,B,"All amino acids have a carboxyl (-COOH) group.",Remember,,,,,,
Standard MCQ,What type of bond links amino acids together in a protein?,A) Disulfide bond,B) Hydrogen bond,C) Peptide bond,D) Ionic bond,C,"Peptide bonds covalently link amino acids.",Remember,,,,,,
Fill in the Blank,"Proteins are made of repeating [[1]] units linked by [[2]] bonds.",,,,,,Understand,Drag & Drop,amino acid,peptide,"amino acid|nucleotide|peptide|hydrogen",,,,
Short Answer,Why do proteins require 3D folding to function properly?,,,,,,,Understand,,,,,,"They create active sites and motifs essential for function."
Sorting,Sort these molecules by type.,,,,,,Remember,,,,,,"Polymers|Monomers","Amino acids:Monomers|Nucleotides:Monomers|Proteins:Polymers|DNA:Polymers"`;

  const [text, setText] = React.useState<string>(SAMPLE);
  const [parsed, setParsed] = React.useState<ParseResult[]>([]);
  const [counts, setCounts] = React.useState<{ ok: number; bad: number }>({ ok: 0, bad: 0 });
  const [previews, setPreviews] = React.useState<Array<{ idx: number; payload: ImportPayload }>>([]);
  const [busy, setBusy] = React.useState(false);

  const runParse = async () => {
    setBusy(true);
    try {
      const { okRows, badRows } = parseCsv(text);
      setCounts({ ok: okRows.length, bad: badRows.length });
      // Re-parse raw rows so we can feed them to rowToPayload for preview
      const raw = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() }).data;
      const first3 = okRows.slice(0, 3).map((r) => {
        const rowIdx = r.index - 2; // account for header
        const rr = raw[rowIdx] as CsvRow;
        return { idx: r.index, payload: rowToPayload(rr) };
      });
      setPreviews(first3);
      const out: ParseResult[] = [
        ...okRows.map((r) => ({ idx: r.index, ok: true as const, payload: r.payload })),
        ...badRows.map((r) => ({ idx: r.index, ok: false as const, error: r.errors.join("; ") })),
      ].sort((a, b) => a.idx - b.idx);
      setParsed(out);
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    // auto-run once on mount for default sample
    void runParse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">CSV Parser Smoke Tests</h1>
      <p className="text-sm text-gray-600">
        Paste CSV below and click Parse to inspect per-row payloads and errors. This isolates importer logic from UI/db.
      </p>
      <div className="grid gap-3">
        <textarea
          className="w-full min-h-48 h-48 border rounded p-3 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button disabled={busy} onClick={runParse} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {busy ? "Parsing…" : "Parse"}
          </button>
          <span className="text-xs text-gray-500">OK: {counts.ok} • Errors: {counts.bad}</span>
        </div>
        {previews.length > 0 && (
          <div className="rounded border p-3 bg-white">
            <div className="text-sm font-semibold mb-2">First 3 OK rows (rowToPayload preview)</div>
            <div className="space-y-2">
              {previews.map((p) => (
                <div key={p.idx} className="text-[11px]">
                  <div className="text-gray-600">Row {p.idx}</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(p.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
        {parsed.length > 0 && (
          <div className="space-y-3">
            {parsed.map((r: ParseResult, i: number) => (
              <div key={i} className="rounded border p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Row {r.idx}</div>
                  <span className={`text-xs px-2 py-0.5 rounded ${r.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.ok ? "OK" : "Error"}</span>
                </div>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(r.ok ? r.payload : r, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="my-6" />
      <p className="text-sm text-gray-600">Canned cases (parser unit samples):</p>
      <div className="space-y-4">
        {results.map((r: { name: string; ok: true; payload: ImportPayload } | { name: string; ok: false; error: string }, idx: number) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{r.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded ${r.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.ok ? "OK" : "Error"}</span>
            </div>
            <pre className="mt-3 text-xs whitespace-pre-wrap break-words">{JSON.stringify(r.ok ? r.payload : r, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
