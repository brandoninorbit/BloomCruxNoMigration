import Papa from "papaparse";
import type { DeckBloomLevel, DeckCardType, DeckMCQMeta, DeckShortMeta, DeckFillMeta, DeckSortingMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckTwoTierMCQMeta, DeckCERMeta } from "@/types/deck-cards";

export type CsvRow = Record<string, string>;

export type ImportResult = {
  ok: boolean;
  created: number;
  errors: { row: number; message: string }[];
};

// Parse a CSV file (File or string) into rows
export function parseCsv(input: File | string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const config = {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    } as Papa.ParseConfig<unknown>;

    const onComplete = (result: Papa.ParseResult<Record<string, unknown>>) => {
      const raw = result.data ?? [];
      const rows: CsvRow[] = raw.map((r) => {
        const obj: CsvRow = {} as CsvRow;
        Object.entries(r).forEach(([k, v]) => {
          obj[String(k)] = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
        });
        return obj;
      });
      resolve(rows);
    };

  const onError = (err: unknown) => reject(err as Error);

    if (typeof input === "string") {
      Papa.parse(input, { ...config, complete: onComplete, error: onError });
    } else {
      Papa.parse(input, { ...config, complete: onComplete, error: onError });
    }
  });
}

// Helpers
const toBloom = (s?: string): DeckBloomLevel | undefined => {
  const t = (s || "").trim().toLowerCase();
  if (!t) return undefined;
  const map: Record<string, DeckBloomLevel> = {
    remember: "Remember",
    understand: "Understand",
    apply: "Apply",
    analyze: "Analyze",
    analyse: "Analyze",
    evaluate: "Evaluate",
    create: "Create",
  };
  return map[t];
};

// Narrow a possibly messy value to the literal union 'A' | 'B' | 'C' | 'D'
type Letter = "A" | "B" | "C" | "D";
const asLetter = (v?: string): Letter => {
  const l = (v || "A").trim().toUpperCase();
  return l === "A" || l === "B" || l === "C" || l === "D" ? l : "A";
};

// (reserved) const truthy = (s?: string): boolean => /^(1|true|yes|y)$/i.test(s || "");

// Map a CSV row into a NewDeckCard payload
export function rowToPayload(row: CsvRow): {
  type: DeckCardType;
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
} {
  const cardType = (row["CardType"] || row["Type"] || "").trim();
  const bloomLevel = toBloom(row["BloomLevel"]);
  const explanation = row["Explanation"]?.trim() || undefined;

  // Standardize friendly type aliases
  const norm = cardType
    .replace(/^mcq$/i, "Standard MCQ")
    .replace(/^fill$/i, "Fill in the Blank")
    .replace(/^short$/i, "Short Answer")
    .replace(/^compare$/i, "Compare/Contrast")
    .replace(/^twotiermcq$/i, "Two-Tier MCQ")
    .replace(/^cer$/i, "CER");

  const q = (row["Question"] || row["Prompt"] || row["Scenario"] || "").trim();

  switch (norm as DeckCardType) {
    case "Standard MCQ": {
      const A = row["A"] || row["OptionA"] || row["Option A"] || "";
      const B = row["B"] || row["OptionB"] || row["Option B"] || "";
  const C = row["C"] || row["OptionC"] || row["Option C"] || "";
  const D = row["D"] || row["OptionD"] || row["Option D"] || "";
  const ans = asLetter(row["Answer"]);
      return {
        type: "Standard MCQ",
        bloomLevel,
        question: q,
        explanation,
  meta: { options: { A, B, C, D }, answer: ans },
      };
    }
    case "Short Answer": {
      const suggested = row["SuggestedAnswer"] || row["Suggested"] || row["Answer"] || "";
      return { type: "Short Answer", bloomLevel, question: q, explanation, meta: { suggestedAnswer: suggested } };
    }
    case "Fill in the Blank": {
      // Multi-blank support:
      // - If Answer is provided, import as legacy single-blank (V1)
      // - Else look for Answer1, Answer2, ... and optional Mode, Options
      const legacy = row["Answer"] || "";
      if (legacy) {
        const meta: DeckFillMeta = { answer: legacy };
        return { type: "Fill in the Blank", bloomLevel, question: q, explanation, meta };
      }
      // Collect numbered answers (Answer1, Answer2, ... up to a reasonable cap)
      const answers: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const v = row[`Answer${i}`];
        if (!v) break;
        const t = v.trim();
        if (t) answers.push(t);
      }
      // If none found, keep it as single blank empty answer to avoid parser rejection
      const modeRaw = (row["Mode"] || "Free Text").toLowerCase();
      const mode = modeRaw === "drag & drop" || modeRaw === "drag and drop" || modeRaw === "dnd" ? "Drag & Drop" : "Free Text";
      const options = (row["Options"] || "").split("|").map((s) => s.trim()).filter(Boolean);
      const meta: DeckFillMeta = { mode, answers: answers.length ? answers : [""] , ...(mode === "Drag & Drop" && options.length ? { options } : {}) } as DeckFillMeta;
      return { type: "Fill in the Blank", bloomLevel, question: q, explanation, meta };
    }
    case "Sorting": {
      // Categories as pipe-delimited; Items as "term:category" pipe-delimited
      const cats = (row["Categories"] || "").split("|").map((s) => s.trim()).filter(Boolean);
      const items = (row["Items"] || "").split("|")
        .map((p) => p.split(":").map((s) => s.trim()))
        .filter(([term, cat]) => term && cat)
        .map(([term, cat]) => ({ term, correctCategory: cat }));
      return { type: "Sorting", bloomLevel, question: q, explanation, meta: { categories: cats, items } };
    }
    case "Sequencing": {
      const steps = (row["Steps"] || row["Items"] || "").split("|").map((s) => s.trim()).filter(Boolean);
      return { type: "Sequencing", bloomLevel, question: q, explanation, meta: { steps } };
    }
    case "Compare/Contrast": {
      const itemA = row["ItemA"] || row["A"] || "";
      const itemB = row["ItemB"] || row["B"] || "";
      // Points as "feature::a::b" pipe-delimited
      const points = (row["Points"] || "").split("|")
        .map((seg) => seg.split("::").map((s) => s.trim()))
        .filter((a) => a.length === 3 && a[0] && a[1] && a[2])
        .map(([feature, a, b]) => ({ feature, a, b }));
      return { type: "Compare/Contrast", bloomLevel, question: q || `Compare ${itemA} and ${itemB}`, explanation, meta: { itemA, itemB, points } };
    }
    case "Two-Tier MCQ": {
      // Tier1
  const A = row["A"] || ""; const B = row["B"] || ""; const C = row["C"] || ""; const D = row["D"] || "";
  const ans = asLetter(row["Answer"]);
      // Tier2 columns prefixed with R*
      const rQ = row["RQuestion"] || row["ReasoningQuestion"] || "";
  const rA = row["RA"] || ""; const rB = row["RB"] || ""; const rC = row["RC"] || ""; const rD = row["RD"] || "";
  const rAns = asLetter(row["RAnswer"]);
      return {
        type: "Two-Tier MCQ",
        bloomLevel,
        question: q,
        explanation,
        meta: {
          tier1: { options: { A, B, C, D }, answer: ans },
          tier2: { question: rQ, options: { A: rA, B: rB, C: rC, D: rD }, answer: rAns },
        },
      };
    }
    case "CER": {
      // Scenario/Prompt is the question/title; optional guidance in Guidance column
      const guidance = row["Guidance"] || row["GuidanceQuestion"] || "";
      const mode = (row["Mode"] || "Free Text").toLowerCase();
      if (mode === "multiple choice" || mode === "mc" || mode === "multiple") {
        // Options pipe-delimited per part; correct index is 1-based in CSV
        const parsePart = (prefix: string) => {
          const options = (row[`${prefix}Options`] || "").split("|").map((s) => s.trim()).filter(Boolean);
          const correct = Math.max(0, ((Number(row[`${prefix}Correct`]) || 1) - 1));
          return { options, correct };
        };
        const claim = parsePart("Claim");
        const evidence = parsePart("Evidence");
        const reasoning = parsePart("Reasoning");
        const meta: DeckCERMeta = { mode: "Multiple Choice", guidanceQuestion: guidance || undefined, claim, evidence, reasoning };
        return { type: "CER", bloomLevel, question: q, explanation: undefined, meta };
      } else {
        const claim = row["Claim"] || "";
        const evidence = row["Evidence"] || "";
        const reasoning = row["Reasoning"] || "";
        const meta: DeckCERMeta = { mode: "Free Text", guidanceQuestion: guidance || undefined, claim: { sampleAnswer: claim || undefined }, evidence: { sampleAnswer: evidence || undefined }, reasoning: { sampleAnswer: reasoning || undefined } };
        return { type: "CER", bloomLevel, question: q, explanation: undefined, meta };
      }
    }
    default:
      throw new Error(`Unsupported CardType: ${norm}`);
  }
}
