import Papa from "papaparse";
import type { DeckBloomLevel, DeckCardType, DeckMCQMeta, DeckShortMeta, DeckFillMeta, DeckSortingMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckTwoTierMCQMeta, DeckCERMeta, DeckFillMetaV3, DeckFillMode } from "@/types/deck-cards";
import { defaultBloomForType } from "@/lib/bloom";

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
      transformHeader: (h: string) => h.replace(/^\uFEFF/, "").trim(),
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
// Flexible column getter: tries exact names, then case-insensitive matching ignoring spaces/punct
function col(row: CsvRow, ...names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {};
  Object.keys(row).forEach((k) => { map[norm(k)] = k; });
  for (const n of names) {
    const key = map[norm(n)];
    if (key && typeof row[key] === "string" && row[key].trim() !== "") return row[key].trim();
  }
  return "";
}
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
  const raw = (v || "").trim();
  const l = raw.toUpperCase();
  if (l === "A" || l === "B" || l === "C" || l === "D") return l;
  // Try to extract a leading label from strings like "B) text" or "B. text"
  const m = raw.match(LABEL_RE);
  if (m) {
    const letter = (m[1].toUpperCase() as Letter);
    return letter;
  }
  return "A";
};
// Regex to detect a leading label like A), A., A:, or A-
const LABEL_RE = /^\s*([A-D])\s*[\)\].:–—-]?\s*/i; // supports A) A. A: A- (including en/em dashes)

// Some spreadsheets misalign A/B/C/D fields or include labels like "A) text" in the wrong column.
// This routine collects any labeled values and reconstructs the correct A/B/C/D map.
function normalizeABCD(row: CsvRow): { A: string; B: string; C: string; D: string } {
  const raw: Record<Letter, string> = {
    A: (row["A"] || row["OptionA"] || row["Option A"] || "").trim(),
    B: (row["B"] || row["OptionB"] || row["Option B"] || "").trim(),
    C: (row["C"] || row["OptionC"] || row["Option C"] || "").trim(),
    D: (row["D"] || row["OptionD"] || row["Option D"] || "").trim(),
  };
  const out: Record<Letter, string> = { A: "", B: "", C: "", D: "" };
  // First pass: if any cell has a leading label, respect it.
  (Object.entries(raw) as [Letter, string][]).forEach(([, v]) => {
    const m = v.match(LABEL_RE);
    if (m) {
      const letter = (m[1].toUpperCase() as Letter);
      const text = v.slice(m[0].length).trim();
      if (text) out[letter] = text;
    }
  });
  // Second pass: fill remaining slots from their own column (only if value is unlabeled or label matches the same column)
  (Object.entries(raw) as [Letter, string][]).forEach(([k, v]) => {
    if (out[k] || !v) return;
    const m = v.match(LABEL_RE);
    if (m) {
      const labeled = m[1].toUpperCase() as Letter;
      if (labeled === k) {
        out[k] = v.slice(m[0].length).trim();
      }
      // else: labeled but points to another letter; already handled in first pass; skip to avoid duplication
    } else {
      out[k] = v.trim();
    }
  });
  // Third pass: If any still missing, scan all row values for labeled options (handles misaligned CSVs)
  if (!out.A || !out.B || !out.C || !out.D) {
    const values = Object.values(row) as string[];
    values.forEach((val) => {
      if (!val || typeof val !== "string") return;
      const m = val.match(LABEL_RE);
      if (!m) return;
      const letter = (m[1].toUpperCase() as Letter);
      if (out[letter]) return; // keep first occurrence
      const text = val.slice(m[0].length).trim();
      if (text) out[letter] = text;
    });
  }
  return out;
}

function normalizeRAtoRD(row: CsvRow): { RA: string; RB: string; RC: string; RD: string } {
  const raw = {
    RA: (row["RA"] || "").trim(),
    RB: (row["RB"] || "").trim(),
    RC: (row["RC"] || "").trim(),
    RD: (row["RD"] || "").trim(),
  } as const;
  const map: Record<"RA" | "RB" | "RC" | "RD", string> = { RA: "", RB: "", RC: "", RD: "" };
  (Object.entries(raw) as [keyof typeof raw, string][]).forEach(([, v]) => {
    const m = v.match(LABEL_RE);
    if (m) {
      const letter = m[1].toUpperCase();
      const text = v.slice(m[0].length).trim();
      const key = ("R" + letter) as keyof typeof map;
      map[key] = text;
    }
  });
  (Object.entries(raw) as [keyof typeof raw, string][]).forEach(([k, v]) => {
    if (map[k] || !v) return;
    const m = v.match(LABEL_RE);
    if (m) {
      const labeled = m[1].toUpperCase();
      const expected = ("R" + labeled) as keyof typeof map;
      if (expected === k) {
        map[k] = v.slice(m[0].length).trim();
      }
    } else {
      map[k] = v.trim();
    }
  });
  // Fallback: scan across all values for labeled RA..RD if still missing
  if (!map.RA || !map.RB || !map.RC || !map.RD) {
    const values = Object.values(row) as string[];
    values.forEach((val) => {
      if (!val || typeof val !== "string") return;
      const m = val.match(LABEL_RE);
      if (!m) return;
      const letter = m[1].toUpperCase() as Letter;
      const key = ("R" + letter) as keyof typeof map;
      if (map[key]) return;
      const text = val.slice(m[0].length).trim();
      if (text) map[key] = text;
    });
  }
  return map;
}


// (reserved) const truthy = (s?: string): boolean => /^(1|true|yes|y)$/i.test(s || "");

// Map a CSV row into a NewDeckCard payload
export function rowToPayload(row: CsvRow): {
  type: DeckCardType;
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
} {
  const cardType = (col(row, "CardType", "Type") || "").trim();
  const providedBloom = toBloom(col(row, "BloomLevel"));
  const explanation = col(row, "Explanation") || undefined;

  // Standardize friendly type aliases
  const norm = cardType
    .replace(/^mcq$/i, "Standard MCQ")
    .replace(/^fill$/i, "Fill in the Blank")
    .replace(/^short$/i, "Short Answer")
    .replace(/^compare$/i, "Compare/Contrast")
    .replace(/^twotiermcq$/i, "Two-Tier MCQ")
    .replace(/^cer$/i, "CER");

  const q = (col(row, "Question", "Prompt", "Scenario") || "").trim();

  switch (norm as DeckCardType) {
    case "Standard MCQ": {
      const norm = normalizeABCD(row);
      const ans = asLetter(col(row, "Answer", "Correct", "Correct Answer"));
      // Validation: ensure all options exist and the answer maps to a non-empty option
      const missing: string[] = [];
      (['A','B','C','D'] as const).forEach((k) => { if (!norm[k]) missing.push(k); });
      if (missing.length) {
        throw new Error(`MCQ requires A–D options; missing ${missing.join(', ')} for question: "${q || row['Question'] || ''}"`);
      }
      if (!norm[ans]) {
        throw new Error(`MCQ answer ${ans} has no text; check A–D columns for question: "${q || row['Question'] || ''}"`);
      }
      return {
        type: "Standard MCQ",
        bloomLevel: providedBloom ?? defaultBloomForType("Standard MCQ"),
        question: q,
        explanation,
        meta: { options: { A: norm.A, B: norm.B, C: norm.C, D: norm.D }, answer: ans },
      };
    }
    case "Short Answer": {
  const suggested = col(row, "SuggestedAnswer", "Suggested", "Answer");
  return { type: "Short Answer", bloomLevel: providedBloom ?? defaultBloomForType("Short Answer"), question: q, explanation, meta: { suggestedAnswer: suggested } };
    }
    case "Fill in the Blank": {
      // Support V1/V2 for backward-compat, but prefer emitting V3 rich meta.
  const legacy = row["Answer"] || "";
      if (legacy) {
        const meta: DeckFillMeta = { answer: legacy };
  return { type: "Fill in the Blank", bloomLevel: providedBloom ?? defaultBloomForType("Fill in the Blank"), question: q, explanation, meta };
      }
      const answers: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const v = row[`Answer${i}`];
        if (!v) break;
        const t = v.trim();
        if (t) answers.push(t);
      }
      // Alternate answers per-blank: AnswerNAlt (pipe-delimited)
      const alts: Record<number, string[]> = {};
      for (let i = 1; i <= answers.length; i++) {
        const raw = row[`Answer${i}Alt`];
        if (raw) alts[i] = raw.split("|").map((s) => s.trim()).filter(Boolean);
      }
      // Per-row grading flags
  const rowCase = /^(1|true|yes|y)$/i.test(col(row, "CaseSensitive") || "");
  const rowIgnore = /^(1|true|yes|y)$/i.test(col(row, "IgnorePunct") || "");
      // Per-blank overrides
      const blankFlags: Record<number, { caseSensitive?: boolean; ignorePunct?: boolean; mode?: DeckFillMode }> = {};
      for (let i = 1; i <= answers.length; i++) {
  const cs = col(row, `Blank${i}CaseSensitive`);
  const ip = col(row, `Blank${i}IgnorePunct`);
  const m = col(row, `Blank${i}Mode`);
        const modeL = (m || "").toLowerCase();
        const mm: DeckFillMode | undefined = modeL
          ? modeL.includes("either")
            ? "Either"
            : modeL.includes("drag") || modeL.includes("dnd")
            ? "Drag & Drop"
            : "Free Text"
          : undefined;
        blankFlags[i] = {
          caseSensitive: cs ? /^(1|true|yes|y)$/i.test(cs) : undefined,
          ignorePunct: ip ? /^(1|true|yes|y)$/i.test(ip) : undefined,
          mode: mm,
        };
      }
      // Options/word bank
  let options = (col(row, "Options") || "").split("|").map((s) => s.trim()).filter(Boolean);
      // Heuristic: some CSVs misplace the word bank into Answer1. If Answer1 looks like a bank and Options is empty, move it.
      if ((!options.length) && answers[0] && answers[0].includes("|") && answers[0].split("|").filter(Boolean).length >= 3) {
        options = answers[0].split("|").map((s) => s.trim()).filter(Boolean);
        answers[0] = "";
      }
      // Heuristic: if Answer1 exactly matches Options pipe list, clear it (it was duplicated/misaligned)
      if (options.length && answers[0] && answers[0].includes("|") && answers[0].split("|").map((s) => s.trim()).join("|") === options.join("|")) {
        answers[0] = "";
      }
      // Default mode: Drag & Drop with word bank (if not specified)
  const modeCell = (col(row, "Mode") || "").trim();
      const modeRaw = (modeCell || (options.length ? "Drag & Drop" : "")).toLowerCase();
      const mode: DeckFillMode = modeRaw.includes("either")
        ? "Either"
        : modeRaw.includes("drag") || modeRaw.includes("dnd")
        ? "Drag & Drop"
        : options.length > 0
        ? "Drag & Drop"
        : "Free Text";
      if ((mode === "Drag & Drop" || mode === "Either") && options.length === 0) {
        // Seed options from unique provided answers and alternates
        const uniq = new Set<string>();
        answers.forEach((a) => uniq.add(a));
        Object.values(alts).forEach((arr) => arr.forEach((a) => uniq.add(a)));
        options = Array.from(uniq);
      }
      // Build V3 blanks list
      const blanks = answers.map((a, idx) => {
        const id = idx + 1;
        const spec = blankFlags[id] ?? {};
        return {
          id: String(id),
          answers: [a, ...(alts[id] ?? [])],
          ...(spec.mode ? { mode: spec.mode } : {}),
          ...(spec.caseSensitive !== undefined ? { caseSensitive: spec.caseSensitive } : {}),
          ...(spec.ignorePunct !== undefined ? { ignorePunct: spec.ignorePunct } : {}),
        };
      });
      const meta: DeckFillMetaV3 = {
        mode,
        blanks,
        ...(options.length ? { options } : {}),
        ...(rowCase ? { caseSensitive: true } : {}),
        ...(rowIgnore ? { ignorePunct: true } : {}),
      };
  return { type: "Fill in the Blank", bloomLevel: providedBloom ?? defaultBloomForType("Fill in the Blank"), question: q, explanation, meta };
    }
    case "Sorting": {
      // Categories as pipe-delimited; Items as "term:category" pipe-delimited
  let cats = (col(row, "Categories") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const items = (col(row, "Items") || "").split("|")
        .map((p) => p.split(":").map((s) => s.trim()))
        .filter(([term, cat]) => term && cat)
        .map(([term, cat]) => ({ term, correctCategory: cat }));
      // If categories look like item pairs (contain ':'), derive categories from items instead
      if (!cats.length || cats.every((c) => c.includes(":"))) {
        const uniqCats = Array.from(new Set(items.map((it) => it.correctCategory)));
        if (uniqCats.length) cats = uniqCats;
      }
  return { type: "Sorting", bloomLevel: providedBloom ?? defaultBloomForType("Sorting"), question: q, explanation, meta: { categories: cats, items } };
    }
    case "Sequencing": {
  const steps = ((col(row, "Steps") || col(row, "Items")) || "").split("|").map((s) => s.trim()).filter(Boolean);
  return { type: "Sequencing", bloomLevel: providedBloom ?? defaultBloomForType("Sequencing"), question: q, explanation, meta: { steps } };
    }
    case "Compare/Contrast": {
  const itemA = col(row, "ItemA", "A");
  const itemB = col(row, "ItemB", "B");
      // Points as "feature::a::b" pipe-delimited
  const points = (col(row, "Points") || "").split("|")
        .map((seg) => seg.split("::").map((s) => s.trim()))
        .filter((a) => a.length === 3 && a[0] && a[1] && a[2])
        .map(([feature, a, b]) => ({ feature, a, b }));
  return { type: "Compare/Contrast", bloomLevel: providedBloom ?? defaultBloomForType("Compare/Contrast"), question: q || `Compare ${itemA} and ${itemB}`, explanation, meta: { itemA, itemB, points } };
    }
    case "Two-Tier MCQ": {
      // Tier1
    const norm = normalizeABCD(row);
    const ans = asLetter(row["Answer"]);
      // Tier2 columns prefixed with R*
  const rQ = col(row, "RQuestion", "ReasoningQuestion");
    const r = normalizeRAtoRD(row);
  const rAns = asLetter(col(row, "RAnswer"));
      return {
        type: "Two-Tier MCQ",
        bloomLevel: providedBloom ?? defaultBloomForType("Two-Tier MCQ"),
        question: q,
        explanation,
        meta: {
      tier1: { options: { A: norm.A, B: norm.B, C: norm.C, D: norm.D }, answer: ans },
      tier2: { question: rQ, options: { A: r.RA, B: r.RB, C: r.RC, D: r.RD }, answer: rAns },
        },
      };
    }
    case "CER": {
      // Scenario/Prompt is the question/title; optional guidance in Guidance column
    const guidance = col(row, "Guidance", "GuidanceQuestion");
    const mode = (col(row, "Mode") || "Free Text").toLowerCase();
      if (mode === "multiple choice" || mode === "mc" || mode === "multiple") {
        // Options pipe-delimited per part; correct index is 1-based in CSV
        const parsePart = (prefix: string) => {
      const options = (col(row, `${prefix}Options`) || "").split("|").map((s) => s.trim()).filter(Boolean);
      const correct = Math.max(0, ((Number(col(row, `${prefix}Correct`)) || 1) - 1));
          return { options, correct };
        };
        const claim = parsePart("Claim");
        const evidence = parsePart("Evidence");
        const reasoning = parsePart("Reasoning");
        const meta: DeckCERMeta = { mode: "Multiple Choice", guidanceQuestion: guidance || undefined, claim, evidence, reasoning };
  return { type: "CER", bloomLevel: providedBloom ?? defaultBloomForType("CER"), question: q, explanation: undefined, meta };
      } else {
        const claim = row["Claim"] || "";
        const evidence = row["Evidence"] || "";
        const reasoning = row["Reasoning"] || "";
        const meta: DeckCERMeta = { mode: "Free Text", guidanceQuestion: guidance || undefined, claim: { sampleAnswer: claim || undefined }, evidence: { sampleAnswer: evidence || undefined }, reasoning: { sampleAnswer: reasoning || undefined } };
  return { type: "CER", bloomLevel: providedBloom ?? defaultBloomForType("CER"), question: q, explanation: undefined, meta };
      }
    }
    default:
      throw new Error(`Unsupported CardType: ${norm}`);
  }
}
