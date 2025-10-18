// src/lib/csvImport.ts
// Strict, deterministic CSV importer for BloomCrux — no heuristics, no reordering, no dedupe.
/* eslint-disable @typescript-eslint/no-explicit-any */

import Papa from 'papaparse';
import type {
  DeckBloomLevel,
  DeckCardType,
  DeckMCQMeta,
  DeckShortMeta,
  DeckFillMeta,
  DeckSortingMeta,
  DeckSequencingMeta,
  DeckCompareContrastMeta,
  DeckTwoTierMCQMeta,
  DeckCERMeta,
  DeckFillMode,
} from '@/types/deck-cards';
import type { NewDeckCard } from '@/lib/cardsRepo';

export type CsvRow = Record<string, string>;

type Bloom = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

// Public importer payloads
type MCQPayload = {
  type: 'mcq';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { options: { A: string; B: string; C: string; D: string }; answer: 'A' | 'B' | 'C' | 'D' };
};

type TwoTierPayload = {
  type: 'twoTier';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: {
    tier1: { options: { A: string; B: string; C: string; D: string }; answer: 'A' | 'B' | 'C' | 'D' };
    tier2: { question: string; options: { A: string; B: string; C: string; D: string }; answer: 'A' | 'B' | 'C' | 'D' };
  };
};

type ShortPayload = {
  type: 'short';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { suggestedAnswer?: string };
};

type FillPerBlankOverrides = {
  [n: number]: { mode?: DeckFillMode; caseSensitive?: boolean; ignorePunct?: boolean };
};
type FillPayload = {
  type: 'fill';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: {
    mode: DeckFillMode;
    answers: string[]; // primary answers per blank (index 1-based in prompt)
    alternates: string[][]; // alternates per blank
    options?: string[]; // word bank; never auto-seeded
    caseSensitive?: boolean; // row flags
    ignorePunct?: boolean; // row flags
    perBlank?: FillPerBlankOverrides; // per-blank overrides
  };
};

type SortingPayload = {
  type: 'sorting';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { categories: string[]; items: { term: string; category: string }[] };
};

type SequencingPayload = {
  type: 'sequencing';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { steps: string[] };
};

type ComparePayload = {
  type: 'compare';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { itemA: string; itemB: string; points: { feature: string; a: string; b: string }[]; prompt?: string };
};

type CERMode = 'Free Text' | 'Multiple Choice';
type CERPartFree = { sampleAnswer?: string };
type CERPartMC = { options: string[]; correct: number };
type CERPart = CERPartFree | CERPartMC;
type CERPayload = {
  type: 'cer';
  question: string;
  bloom: Bloom;
  explanation?: string;
  meta: { mode: CERMode; guidance?: string; claim?: CERPart; evidence?: CERPart; reasoning?: CERPart };
};

export type ImportPayload =
  | MCQPayload
  | TwoTierPayload
  | ShortPayload
  | FillPayload
  | SortingPayload
  | SequencingPayload
  | ComparePayload
  | CERPayload;

// ---------- Helpers ----------
const LABEL_RE = /^\s*([A-D])\s*[).:]\s*/i;
const truthy = (s?: string) => /^(1|true|yes|y)$/i.test((s || '').trim());
const normKey = (k: string) => (k || '').trim().toLowerCase();

function pick(row: CsvRow, ...aliases: string[]): string | undefined {
  const map = new Map<string, string>();
  Object.keys(row || {}).forEach((k) => map.set(normKey(k), (row as any)[k]));
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v !== undefined && v !== null) {
      const t = String(v).trim();
      if (t !== '') return t;
    }
  }
  return undefined;
}

function splitPipes(s?: string): string[] {
  return (s || '')
    .split('|')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function stripLabel(s: string): string {
  return (s || '').replace(LABEL_RE, '').trim();
}

function letterToKey(s: string): 'A' | 'B' | 'C' | 'D' {
  const L = (s || '').trim().toUpperCase();
  if (L === 'A' || L === 'B' || L === 'C' || L === 'D') return L;
  // default unreachable in validated paths
  return 'A';
}

function normalizeBloom(raw?: string): Bloom | undefined {
  if (!raw) return undefined;
  const x = raw.trim().toLowerCase();
  if (x === 'remember') return 'Remember';
  if (x === 'understand') return 'Understand';
  if (x === 'apply') return 'Apply';
  if (x === 'analyze' || x === 'analyse') return 'Analyze';
  if (x === 'evaluate') return 'Evaluate';
  if (x === 'create') return 'Create';
  return undefined;
}

const DEFAULT_BLOOM: Record<string, Bloom> = {
  mcq: 'Remember',
  fill: 'Remember',
  short: 'Understand',
  sorting: 'Understand',
  sequencing: 'Understand',
  compare: 'Analyze',
  twoTier: 'Evaluate',
  cer: 'Evaluate',
};

// Warning helpers
function hasSmartQuotesOrNbsp(s?: string): boolean {
  if (!s) return false;
  return /[\u2018\u2019\u201C\u201D\u00A0]/.test(s);
}

function looksLikeWrongDelimiter(raw?: string): boolean {
  if (!raw) return false;
  // If contains comma/semicolon but not many pipes
  return /[,;] /.test(raw) || ((raw.includes(',') || raw.includes(';')) && !raw.includes('|'));
}

// CardType mapping — strict, enumerated aliases only
function mapCardType(raw?: string):
  | 'mcq'
  | 'short'
  | 'fill'
  | 'sorting'
  | 'sequencing'
  | 'compare'
  | 'twoTier'
  | 'cer'
  | undefined {
  const x = (raw || '').trim().toLowerCase();
  if (!x) return undefined;
  if (x === 'mcq' || x === 'standard mcq' || x === 'multiple choice') return 'mcq';
  if (x === 'short' || x === 'short answer') return 'short';
  if (x === 'fill' || x === 'fill in the blank') return 'fill';
  if (x === 'sorting' || x === 'sort') return 'sorting';
  if (x === 'sequencing' || x === 'sequence') return 'sequencing';
  if (x === 'compare' || x === 'compare/contrast' || x === 'compare-contrast') return 'compare';
  if (x === 'twotiermcq' || x === 'two-tier mcq' || x === 'two tier mcq' || x === 'two-tier' || x === 'two tier') return 'twoTier';
  if (x === 'cer') return 'cer';
  return undefined;
}

function questionFrom(row: CsvRow): string {
  return (
    pick(row, 'Title') ?? pick(row, 'Question') ?? pick(row, 'Prompt') ?? pick(row, 'Scenario') ?? ''
  ).trim();
}

function explanationFrom(row: CsvRow): string | undefined {
  const v = pick(row, 'Explanation');
  return v && v.trim() ? v.trim() : undefined;
}

// ---------- Per-type mapping with validation (returns errors instead of throwing) ----------
type MapResult = { payload?: ImportPayload; errors: string[]; warnings: string[] };

function mapMCQ(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const question = questionFrom(row);
  if (!question) errors.push(`Row ${idx}: [E-MCQ-MISSING-QUESTION] Missing Question/Title/Prompt/Scenario`);
  const A = pick(row, 'A', 'OptionA', 'Option A');
  const B = pick(row, 'B', 'OptionB', 'Option B');
  const C = pick(row, 'C', 'OptionC', 'Option C');
  const D = pick(row, 'D', 'OptionD', 'Option D');
  const ans = pick(row, 'Answer');
  if (!A) errors.push(`Row ${idx}: [E-MCQ-MISSING-A] Missing A`);
  if (!B) errors.push(`Row ${idx}: [E-MCQ-MISSING-B] Missing B`);
  if (!C) errors.push(`Row ${idx}: [E-MCQ-MISSING-C] Missing C`);
  if (!D) errors.push(`Row ${idx}: [E-MCQ-MISSING-D] Missing D`);
  if (!ans) errors.push(`Row ${idx}: [E-MCQ-MISSING-ANSWER] Missing Answer`);
  if (errors.length) return { errors, warnings: [] };
  const options = { A: stripLabel(A!), B: stripLabel(B!), C: stripLabel(C!), D: stripLabel(D!) };
  const answerKey = letterToKey(ans!);
  if (!options[answerKey]) errors.push(`Row ${idx}: [E-MCQ-ANSWER-EMPTY] Answer points to empty option`);
  // Non-blocking warnings
  if (!/^[A-D]$/i.test(ans || '')) warnings.push(`Row ${idx}: [W-MCQ-ANSWER-NOT-LETTER] Answer should be one of A|B|C|D`);
  // Multiple-answers detected in single-select MCQ (e.g., "AB" or "A,B")
  if ((ans || '').toUpperCase().replace(/[^A-D]/g, '').split('').filter(Boolean).length >= 2) {
    warnings.push(`Row ${idx}: [W-MCQ-MULTI-ANS] Answer contains multiple letters for single-select MCQ`);
  }
  const shortCount = (['A','B','C','D'] as const).filter((k) => (options as any)[k]?.trim().length <= 2).length;
  if (shortCount >= 3) warnings.push(`Row ${idx}: [W-MCQ-SHORT-OPTIONS] Most MCQ options are very short (<=2 chars)`);
  // Near-duplicate options (ignoring punctuation/space/case)
  {
    const norm = (s: string) => s.toLowerCase().replace(/[\W_]+/g, '');
    const normalized = Object.values(options).map((s) => norm(s));
    const uniq = new Set(normalized.filter((s) => s.length > 0));
    if (uniq.size <= 3 && uniq.size < normalized.length) {
      warnings.push(`Row ${idx}: [W-MCQ-OPTIONS-NEAR-DUP] Options are near-duplicates (differ only by punctuation/spacing)`);
    }
  }
  if (hasSmartQuotesOrNbsp(question) || hasSmartQuotesOrNbsp(A) || hasSmartQuotesOrNbsp(B) || hasSmartQuotesOrNbsp(C) || hasSmartQuotesOrNbsp(D)) {
    warnings.push(`Row ${idx}: [W-ENCODING-SMART-QUOTES] Smart quotes or non-breaking spaces detected; consider normalizing`);
  }
  if (errors.length) return { errors, warnings: warnings };
  return {
    errors,
    warnings,
    payload: { type: 'mcq', question, bloom, explanation: explanationFrom(row), meta: { options, answer: answerKey } },
  };
}

function mapTwoTier(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  // Tier-1
  const t1 = mapMCQ(row, idx, bloom);
  if (!t1.payload) return t1;
  const t1Meta = (t1.payload as MCQPayload).meta;
  const rq = pick(row, 'RQuestion', 'ReasoningQuestion', 'Tier2Question', 'Tier-2 Question');
  const RA = pick(row, 'RA', 'Tier2A');
  const RB = pick(row, 'RB', 'Tier2B');
  const RC = pick(row, 'RC', 'Tier2C');
  const RD = pick(row, 'RD', 'Tier2D');
  const RAnswer = pick(row, 'RAnswer', 'Tier2Answer');
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!rq) errors.push(`Row ${idx}: [E-2T-MISSING-RQUESTION] Missing RQuestion/Tier2Question`);
  if (!RA) errors.push(`Row ${idx}: [E-2T-MISSING-RA] Missing RA`);
  if (!RB) errors.push(`Row ${idx}: [E-2T-MISSING-RB] Missing RB`);
  if (!RC) errors.push(`Row ${idx}: [E-2T-MISSING-RC] Missing RC`);
  if (!RD) errors.push(`Row ${idx}: [E-2T-MISSING-RD] Missing RD`);
  if (!RAnswer) errors.push(`Row ${idx}: [E-2T-MISSING-RANSWER] Missing RAnswer`);
  if (errors.length) return { errors, warnings: [] };
  const ropts = { A: stripLabel(RA!), B: stripLabel(RB!), C: stripLabel(RC!), D: stripLabel(RD!) };
  const rKey = letterToKey(RAnswer!);
  if (!ropts[rKey]) errors.push(`Row ${idx}: [E-2T-RANSWER-EMPTY] RAnswer points to empty RA/RB/RC/RD`);
  if (errors.length) return { errors, warnings: [] };
  // Non-blocking warnings
  if (!/^[A-D]$/i.test(RAnswer || '')) warnings.push(`Row ${idx}: [W-2T-RANSWER-NOT-LETTER] Tier-2 answer should be one of A|B|C|D`);
  const t1MetaLocal = (t1.payload as MCQPayload).meta;
  const t1Texts = Object.values(t1MetaLocal.options).map((s) => s.trim().toLowerCase());
  const t2Texts = Object.values(ropts).map((s) => s.trim().toLowerCase());
  const overlap = t2Texts.filter((x) => t1Texts.includes(x)).length;
  if (overlap >= 3) warnings.push(`Row ${idx}: [W-2T-DUP-OPTIONS] Tier-2 options largely duplicate Tier-1 options`);
  // Tier-2 justification options duplicate each other
  {
    const norm = (s: string) => s.toLowerCase().replace(/[\W_]+/g, '');
    const normalized = Object.values(ropts).map((s) => norm(s));
    const uniq = new Set(normalized.filter((s) => s.length > 0));
    if (uniq.size < normalized.length) {
      warnings.push(`Row ${idx}: [W-2T-JUSTIF-DUP] Two or more Tier-2 options are textually identical`);
    }
  }
  return {
    errors: [],
    warnings,
    payload: {
      type: 'twoTier',
  question: t1.payload!.question,
      bloom,
      explanation: explanationFrom(row),
  meta: { tier1: t1MetaLocal, tier2: { question: rq!.trim(), options: ropts, answer: rKey } },
    },
  };
}

function detectMaxPlaceholder(prompt: string): number {
  const matches = prompt.match(/\[\[(\d+)]]/g);
  if (!matches) return 0;
  return Math.max(...matches.map((m) => parseInt(m.replace(/[^\d]/g, ''), 10)));
}

function mapFill(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  if (!question) return { errors: [`Row ${idx}: [E-FILL-MISSING-PROMPT] Missing Prompt/Question/Title`], warnings: [] };
  const modeRaw = pick(row, 'Mode') || '';
  const mode: DeckFillMode = /drag/i.test(modeRaw)
    ? 'Drag & Drop'
    : /either/i.test(modeRaw)
    ? 'Either'
    : 'Free Text';

  const maxInPrompt = detectMaxPlaceholder(question);
  // Collect answers Answer or Answer1..Answer20
  const answers: string[] = [];
  const alternates: string[][] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let multi = false;
  for (let n = 1; n <= 20; n++) {
    const a = pick(row, n === 1 ? 'Answer' : `Answer${n}`);
    const aN = pick(row, `Answer${n}`);
    if (aN !== undefined) multi = true;
    if (a !== undefined || aN !== undefined) {
      const val = (aN ?? a)!;
      answers.push(val.trim());
      alternates.push(splitPipes(pick(row, `Answer${n}Alt`)));
    } else if (n === 1) {
      // allow single-blank via Answer
      const single = pick(row, 'Answer');
      if (single) {
        answers.push(single.trim());
        alternates.push(splitPipes(pick(row, 'AnswerAlt')));
      }
      break;
    } else {
      break;
    }
  }
  if (answers.length === 0) errors.push(`Row ${idx}: [E-FILL-MISSING-ANSWERS] Missing Answer/Answer1`);
  if (answers.length > 0 && maxInPrompt === 0) {
  errors.push(`Row ${idx}: [E-FILL-NO-PLACEHOLDERS] Fill in the Blank prompt must contain [[n]] placeholders`);
  }
  if (multi && maxInPrompt < answers.length) {
  errors.push(`Row ${idx}: [E-FILL-PLACEHOLDER-RANGE] Prompt must include [[n]] placeholders up to [[${answers.length}]]`);
  }
  if (errors.length) return { errors, warnings };

  // Flags and options (no seeding)
  const caseSensitive = truthy(pick(row, 'CaseSensitive')) || undefined;
  const ignorePunct = truthy(pick(row, 'IgnorePunct')) || undefined;
  const optionsRaw = pick(row, 'Options');
  const options = splitPipes(optionsRaw);
  if (options.length > 0 && mode === 'Free Text') {
    warnings.push(`Row ${idx}: [W-FILL-OPTIONS-FREE-TEXT] Word bank provided but mode is Free Text`);
  }
  if (options.length > 0 && answers.length === 0) {
    warnings.push(`Row ${idx}: [W-FILL-OPTIONS-NO-ANSWERS] Word bank provided but no answers`);
  }
  if ((mode === 'Drag & Drop' || mode === 'Either') && options.length < Math.max(answers.length, 2)) {
    warnings.push(`Row ${idx}: [W-FILL-DND-NO-OPTIONS] Drag & Drop mode but Options are missing or too few`);
  }
  if (optionsRaw && looksLikeWrongDelimiter(optionsRaw)) {
    warnings.push(`Row ${idx}: [W-FILL-WRONG-DELIM] Options may be using comma/semicolon instead of pipe`);
  }
  // Placeholder mismatch warning (non-blocking): too many or too few placeholders compared to answers
  if (maxInPrompt > 0 && maxInPrompt !== answers.length) {
    warnings.push(`Row ${idx}: [W-FILL-PLACEHOLDER-MISMATCH] [[n]] placeholders (${maxInPrompt}) don't match number of answers (${answers.length})`);
  }
  // Case sensitivity suggestion
  const anyMixedCase = answers.some((a) => /[A-Z]/.test(a) && /[a-z]/.test(a));
  if (anyMixedCase && !caseSensitive) {
    warnings.push(`Row ${idx}: [W-FILL-CASE-SENSING] Answers include mixed case but CaseSensitive is not set`);
  }
  const perBlank: FillPerBlankOverrides = {};
  for (let n = 1; n <= answers.length; n++) {
    const bModeRaw = pick(row, `Blank${n}Mode`);
    const bMode: DeckFillMode | undefined = bModeRaw
      ? /drag/i.test(bModeRaw)
        ? 'Drag & Drop'
        : /either/i.test(bModeRaw)
        ? 'Either'
        : 'Free Text'
      : undefined;
    const bCS = truthy(pick(row, `Blank${n}CaseSensitive`)) || undefined;
    const bIP = truthy(pick(row, `Blank${n}IgnorePunct`)) || undefined;
    if (bMode || bCS || bIP) perBlank[n] = { mode: bMode, caseSensitive: bCS, ignorePunct: bIP };
  }

  return {
    errors: [],
    warnings,
    payload: {
      type: 'fill',
      question,
      bloom,
      explanation: explanationFrom(row),
      meta: { mode, answers, alternates, options: options.length ? options : undefined, caseSensitive, ignorePunct, perBlank: Object.keys(perBlank).length ? perBlank : undefined },
    },
  };
}

function mapSorting(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const catsRaw = pick(row, 'Categories');
  const cats = splitPipes(catsRaw);
  const itemsStr = pick(row, 'Items');
  const itemsRaw = splitPipes(itemsStr);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!question) errors.push(`Row ${idx}: [E-SORT-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario`);
  if (!cats.length) errors.push(`Row ${idx}: [E-SORT-MISSING-CATEGORIES] Missing Categories`);
  if (!itemsRaw.length) errors.push(`Row ${idx}: [E-SORT-MISSING-ITEMS] Missing Items`);
  const items = itemsRaw.map((s) => {
    const idxColon = s.indexOf(':');
    if (idxColon === -1) {
      errors.push(`Row ${idx}: [E-SORT-ITEM-FORMAT] Sorting item "${s}" must be "term:category"`);
      return { term: '', category: '' };
    }
    return { term: s.slice(0, idxColon).trim(), category: s.slice(idxColon + 1).trim() };
  });
  if (errors.length) return { errors, warnings: [] };

  // Gentle flag: categories that look like single letters (e.g., "B|r|o|a|d")
  const letterSingles = cats.filter((c) => c.length === 1 && /[A-Za-z]/.test(c));
  const lowerSingles = letterSingles.filter((c) => /[a-z]/.test(c));
  const ratioSingles = cats.length > 0 ? letterSingles.length / cats.length : 0;
  const looksLikeSplitWord = cats.length >= 4 && ratioSingles >= 0.75 && lowerSingles.length >= 1;
  if (looksLikeSplitWord) {
    const sample = cats.slice(0, 8).join('|');
    warnings.push(
      `Row ${idx}: [W-SORT-SINGLE-LETTERS] Sorting categories look like single letters (${sample}). If this was a single term (e.g., "Broad") split into letters, consider fixing before import.`
    );
  }
  if (cats.length === 1) warnings.push(`Row ${idx}: [W-SORT-FEW-CATEGORIES] Only one category provided`);
  if (cats.length > 20) warnings.push(`Row ${idx}: [W-SORT-MANY-CATEGORIES] More than 20 categories provided`);
  if (items.length < 2) warnings.push(`Row ${idx}: [W-SORT-FEW-ITEMS] Fewer than 2 items provided`);
  if (items.length > 50) warnings.push(`Row ${idx}: [W-SORT-TOO-MANY-ITEMS] Item count is very high (>50)`);
  if (catsRaw && looksLikeWrongDelimiter(catsRaw)) warnings.push(`Row ${idx}: [W-SORT-WRONG-DELIM] Categories may be using comma/semicolon instead of pipe`);
  if (itemsStr && itemsStr.includes(',') && !itemsStr.includes('|')) warnings.push(`Row ${idx}: [W-SORT-ITEMS-WRONG-DELIM] Items may be using comma instead of pipe`);

  // Unknown/Case-mismatch categories referenced by items
  const catSet = new Set(cats);
  const catLowerMap = new Map(cats.map((c) => [c.toLowerCase(), c] as const));
  let unknown = 0;
  let caseMismatch = 0;
  let unassigned = 0;
  const catCounts = new Map<string, number>(cats.map((c) => [c, 0]));
  const termCats = new Map<string, Set<string>>();
  items.forEach((it) => {
    // Count per-category assignment
    if (catCounts.has(it.category)) catCounts.set(it.category, (catCounts.get(it.category) || 0) + 1);
    // Track unassigned (empty category)
    if (!it.category) unassigned++;
    if (!catSet.has(it.category)) {
      const lc = it.category.toLowerCase();
      if (catLowerMap.has(lc)) caseMismatch++;
      else unknown++;
    }
    // Track duplicate terms across categories
    const tkey = it.term.trim().toLowerCase();
    if (tkey) {
      const set = termCats.get(tkey) || new Set<string>();
      set.add(it.category);
      termCats.set(tkey, set);
    }
  });
  if (unknown > 0) warnings.push(`Row ${idx}: [W-SORT-UNKNOWN-CATEGORY] ${unknown} item(s) reference categories not in Categories`);
  if (caseMismatch > 0) warnings.push(`Row ${idx}: [W-SORT-CATEGORY-CASE] ${caseMismatch} item(s) reference category names with different casing`);
  if (unassigned > 0) warnings.push(`Row ${idx}: [W-SORT-UNASSIGNED-ITEMS] ${unassigned} item(s) have no assigned category`);
  const emptyCats = [...catCounts.entries()].filter(([, n]) => n === 0).length;
  if (emptyCats > 0) warnings.push(`Row ${idx}: [W-SORT-EMPTY-CAT] ${emptyCats} category(ies) have no items`);
  const dupTerms = [...termCats.values()].filter((set) => set.size > 1).length;
  if (dupTerms > 0) warnings.push(`Row ${idx}: [W-SORT-ITEM-DUP] ${dupTerms} item term(s) assigned to multiple categories`);

  return { errors: [], warnings, payload: { type: 'sorting', question, bloom, explanation: explanationFrom(row), meta: { categories: cats, items } } };
}

function mapShort(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const suggested = pick(row, 'SuggestedAnswer', 'Suggested', 'Answer');
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: [E-SHORT-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario`);
  if (errors.length) return { errors, warnings: [] };
  return {
    errors: [],
    warnings: [],
  payload: { type: 'short', question, bloom, explanation: explanationFrom(row), meta: { suggestedAnswer: suggested ?? '' } },
  };
}

function mapSequencing(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const stepsRaw = pick(row, 'Steps') ?? pick(row, 'Items');
  const steps = splitPipes(stepsRaw);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!question) errors.push(`Row ${idx}: [E-SEQ-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario`);
  if (!steps.length) errors.push(`Row ${idx}: [E-SEQ-MISSING-STEPS] Sequencing requires Steps or Items`);
  if (errors.length) return { errors, warnings: [] };
  if (steps.length < 2) warnings.push(`Row ${idx}: [W-SEQ-FEW-STEPS] Fewer than 2 steps provided`);
  const oneLetter = steps.filter((s) => s.length === 1 && /[A-Za-z]/.test(s)).length;
  if (oneLetter >= Math.ceil(steps.length * 0.75) && steps.length >= 3) warnings.push(`Row ${idx}: [W-SEQ-SINGLE-LETTERS] Steps look like single letters (word split)`);
  if (stepsRaw && looksLikeWrongDelimiter(stepsRaw)) warnings.push(`Row ${idx}: [W-SEQ-WRONG-DELIM] Steps may be using comma/semicolon instead of pipe`);
  // Duplicate steps
  {
    const seen = new Set<string>();
    const dups = new Set<string>();
    steps.map((s) => s.trim().toLowerCase()).forEach((s) => {
      if (seen.has(s)) dups.add(s); else seen.add(s);
    });
    if (dups.size > 0) warnings.push(`Row ${idx}: [W-SEQ-DUP-STEP] Duplicate step strings found`);
  }
  // Ordinals like "1.", "First:" which may be redundant
  if (steps.some((s) => /^\s*(\d+[).:-]|(first|second|third|fourth|fifth)\b)/i.test(s))) {
    warnings.push(`Row ${idx}: [W-SEQ-ORDINALS-DETECTED] Steps include ordinal markers which may be redundant`);
  }
  // Ambiguity heuristic: many very short steps (2-3 chars) but not single-letter case
  {
    const shortish = steps.filter((s) => s.trim().length >= 2 && s.trim().length <= 3).length;
    if (steps.length >= 4 && shortish / steps.length >= 0.6 && oneLetter === 0) {
      warnings.push(`Row ${idx}: [W-SEQ-AMBIGUOUS] Many very short steps; the sequence may be ambiguous`);
    }
  }
  return { errors: [], warnings, payload: { type: 'sequencing', question, bloom, explanation: explanationFrom(row), meta: { steps } } };
}

function mapCompare(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const itemA = pick(row, 'ItemA', 'A');
  const itemB = pick(row, 'ItemB', 'B');
  const prompt = pick(row, 'Prompt', 'Context', 'Scenario');
  const ptsRaw = pick(row, 'Points', 'Pairs');
  const pts = splitPipes(ptsRaw);
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: [E-COMPARE-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario`);
  if (!itemA) errors.push(`Row ${idx}: [E-COMPARE-MISSING-ITEMA] Missing ItemA/A`);
  if (!itemB) errors.push(`Row ${idx}: [E-COMPARE-MISSING-ITEMB] Missing ItemB/B`);
  if (!pts.length) errors.push(`Row ${idx}: [E-COMPARE-MISSING-POINTS] Missing Points`);
  const points = pts.map((s) => {
    const parts = s.split('::').map((p) => p.trim());
    if (parts.length !== 3) {
      errors.push(`Row ${idx}: [E-COMPARE-POINT-FORMAT] Compare point "${s}" must be "feature::a::b"`);
      return { feature: '', a: '', b: '' };
    }
    const [feature, a, b] = parts;
    return { feature, a, b };
  });
  if (errors.length) return { errors, warnings: [] };
  const warnings: string[] = [];
  const missingSide = points.filter((p) => !p.a || !p.b).length;
  if (missingSide > 0) warnings.push(`Row ${idx}: [W-COMPARE-MISSING-SIDE] ${missingSide} point(s) missing A or B side`);
  if (ptsRaw && looksLikeWrongDelimiter(ptsRaw)) warnings.push(`Row ${idx}: [W-COMPARE-WRONG-DELIM] Points may be using comma/semicolon instead of pipe between pairs`);
  // Duplicate feature keys
  {
    const seen = new Set<string>();
    const dups = new Set<string>();
    points.forEach((p) => {
      const key = p.feature.trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) dups.add(key); else seen.add(key);
    });
    if (dups.size > 0) warnings.push(`Row ${idx}: [W-COMPARE-KEY-DUP] Duplicate feature keys found across points`);
  }
  // Unbalanced content across sides (aggregate length ratio)
  {
    const lenA = points.reduce((acc, p) => acc + (p.a?.length || 0), 0);
    const lenB = points.reduce((acc, p) => acc + (p.b?.length || 0), 0);
    const max = Math.max(lenA, lenB) || 1;
    const min = Math.min(lenA, lenB) || 1;
    if (max / min >= 2.5 && (lenA + lenB) > 80) {
      warnings.push(`Row ${idx}: [W-COMPARE-UNBALANCED] Item A and B sides are significantly different in total length`);
    }
  }
  return { errors: [], warnings, payload: { type: 'compare', question, bloom, explanation: explanationFrom(row), meta: { itemA: itemA!, itemB: itemB!, points, prompt: prompt || undefined } } };
}

function mapCER(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  // For CER, prefer Scenario/Prompt as the primary prompt; if absent, fall back to Question/Title
  const scenarioOrPrompt = pick(row, 'Scenario') ?? pick(row, 'Prompt') ?? pick(row, 'Title');
  const qCol = pick(row, 'Question');
  const question = (scenarioOrPrompt ?? qCol ?? '').trim();
  const modeRaw = (pick(row, 'Mode') || '').toLowerCase();
  const mode: CERMode = /multiple|mc/.test(modeRaw) ? 'Multiple Choice' : 'Free Text';
  // If a Scenario/Prompt exists and Guidance is not provided, use the Question column as guidance
  const guidance =
    pick(row, 'Guidance', 'GuidanceQuestion') ?? (scenarioOrPrompt ? qCol : undefined);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!question) errors.push(`Row ${idx}: [E-CER-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario`);
  if (modeRaw && !/^(free text|multiple choice)$/i.test(modeRaw)) warnings.push(`Row ${idx}: [W-CER-MODE-ALIAS] Mode value normalized to ${mode}`);
  if (mode === 'Free Text') {
    const claim: CERPartFree = { sampleAnswer: pick(row, 'Claim') };
    const evidence: CERPartFree = { sampleAnswer: pick(row, 'Evidence') };
    const reasoning: CERPartFree = { sampleAnswer: pick(row, 'Reasoning') };
    // Parts missing warning
    if (!claim.sampleAnswer || !evidence.sampleAnswer || !reasoning.sampleAnswer) {
      warnings.push(`Row ${idx}: [W-CER-PARTS-MISSING] One or more of Claim/Evidence/Reasoning is missing in Free Text mode`);
    }
    return { errors, warnings, payload: { type: 'cer', question, bloom, explanation: explanationFrom(row), meta: { mode, guidance, claim, evidence, reasoning } } };
  }
  // Multiple Choice
  const parseMC = (prefix: 'Claim' | 'Evidence' | 'Reasoning') => {
    const options = splitPipes(pick(row, `${prefix}Options`));
    const correctStr = pick(row, `${prefix}Correct`);
    let err: string | null = null;
  if (!options.length) err = `[E-CER-${prefix.toUpperCase()}-OPTIONS-REQUIRED] ${prefix}Options required for CER MC`;
    const idx1 = correctStr ? parseInt(correctStr, 10) : NaN;
  if (!err && !(idx1 >= 1 && idx1 <= options.length)) err = `[E-CER-${prefix.toUpperCase()}-CORRECT-RANGE] ${prefix}Correct must be 1..${options.length}`;
    return { part: err ? undefined : ({ options, correct: idx1 } as CERPartMC), err };
  };
  const c = parseMC('Claim');
  const e = parseMC('Evidence');
  const r = parseMC('Reasoning');
  if (c.err) errors.push(`Row ${idx}: ${c.err}`);
  if (e.err) errors.push(`Row ${idx}: ${e.err}`);
  if (r.err) errors.push(`Row ${idx}: ${r.err}`);
  if (errors.length) return { errors, warnings: [] };
  return {
    errors: [],
    warnings,
    payload: { type: 'cer', question, bloom, explanation: explanationFrom(row), meta: { mode, guidance, claim: c.part!, evidence: e.part!, reasoning: r.part! } },
  };
}

// ---------- Public API ----------

export function rowToPayload(row: CsvRow): ImportPayload {
  // Determine type strictly by CardType cell
  const rawType = pick(row, 'CardType');
  const mapped = mapCardType(rawType);
  const idx = 1; // row index unknown in standalone usage; error strings not emitted here
  const bloom = normalizeBloom(pick(row, 'BloomLevel')) || (DEFAULT_BLOOM[mapped || 'mcq'] as Bloom);
  const t = mapped || 'mcq';
  const res =
    t === 'mcq'
      ? mapMCQ(row, idx, bloom)
      : t === 'twoTier'
      ? mapTwoTier(row, idx, bloom)
      : t === 'fill'
      ? mapFill(row, idx, bloom)
      : t === 'short'
      ? mapShort(row, idx, bloom)
      : t === 'sorting'
      ? mapSorting(row, idx, bloom)
      : t === 'sequencing'
      ? mapSequencing(row, idx, bloom)
      : t === 'compare'
      ? mapCompare(row, idx, bloom)
      : mapCER(row, idx, bloom);
  if (res.payload) return res.payload;
  // Non-throwing fallback for standalone usage; parseCsv will validate in real flows.
  return {
    type: 'mcq',
    question: questionFrom(row),
    bloom,
    explanation: explanationFrom(row),
    meta: { options: { A: stripLabel(pick(row, 'A') || ''), B: stripLabel(pick(row, 'B') || ''), C: stripLabel(pick(row, 'C') || ''), D: stripLabel(pick(row, 'D') || '') }, answer: letterToKey(pick(row, 'Answer') || 'A') },
  } as MCQPayload;
}

export function parseCsv(csvText: string): {
  okRows: { index: number; payload: ImportPayload; warnings?: string[]; flagged?: boolean }[];
  badRows: { index: number; errors: string[] }[];
  warnings: string[];
  rowWarnings: { index: number; warnings: string[] }[];
} {
  const result = Papa.parse<CsvRow>(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });
  const warnings: string[] = [];
  const okRows: { index: number; payload: ImportPayload; warnings?: string[]; flagged?: boolean }[] = [];
  const badRows: { index: number; errors: string[] }[] = [];
  const rowWarnings: { index: number; warnings: string[] }[] = [];
  if (result.errors.length > 0) {
    // Collect the first parse error as a bad row at header level
    warnings.push(`CSV parser reported ${result.errors.length} issue(s); first: ${result.errors[0].message}`);
  }
  // File-level duplicate question detection (across all card types)
  const seenQuestions = new Map<string, number>();
  const rows = result.data || [];
  rows.forEach((row, i) => {
    const index = i + 2; // header + 1-based
    const t = mapCardType(pick(row, 'CardType'));
    if (!t) {
      badRows.push({ index, errors: [`Row ${index}: [E-GENERAL-CARDTYPE] Missing or unsupported CardType`] });
      return;
    }
    const rawBloom = pick(row, 'BloomLevel');
    const bloomNorm = normalizeBloom(rawBloom);
    const bloom = bloomNorm || DEFAULT_BLOOM[t];
    let res: MapResult;
    switch (t) {
      case 'mcq':
        res = mapMCQ(row, index, bloom);
        break;
      case 'twoTier':
        res = mapTwoTier(row, index, bloom);
        break;
      case 'fill':
        res = mapFill(row, index, bloom);
        break;
      case 'short':
        res = mapShort(row, index, bloom);
        break;
      case 'sorting':
        res = mapSorting(row, index, bloom);
        break;
      case 'sequencing':
        res = mapSequencing(row, index, bloom);
        break;
      case 'compare':
        res = mapCompare(row, index, bloom);
        break;
      case 'cer':
        res = mapCER(row, index, bloom);
        break;
      default:
        res = { errors: [`Row ${index}: [E-GENERAL-CARDTYPE] Unsupported CardType`], warnings: [] };
    }
    if (res.warnings.length) {
      warnings.push(...res.warnings);
      rowWarnings.push({ index, warnings: res.warnings });
    }
    // Bloom invalid value provided
    if (rawBloom && !bloomNorm) {
      const msg = `Row ${index}: [W-BLOOM-INVALID] Unrecognized BloomLevel "${rawBloom}" — defaulting to ${bloom}`;
      warnings.push(msg);
      rowWarnings.push({ index, warnings: [msg] });
    }
    // Duplicate question detection (normalize by trimming and lowering)
    const q = questionFrom(row).trim().toLowerCase();
    if (q) {
      const prev = seenQuestions.get(q);
      if (prev !== undefined) {
        const msg = `Row ${index}: [W-DUP-QUESTION] Duplicate question appears (also at row ${prev})`;
        warnings.push(msg);
        rowWarnings.push({ index, warnings: [msg] });
      } else {
        seenQuestions.set(q, index);
      }
    }
    // Large row content warning
    const totalLen = Object.values(row).reduce((acc, v) => acc + String(v ?? '').length, 0);
    if (totalLen > 5000) {
      const msg = `Row ${index}: [W-ROW-LARGE] Row content is very large (>5000 chars)`;
      warnings.push(msg);
      rowWarnings.push({ index, warnings: [msg] });
    }
    // Smart quotes across any cell
    if (Object.values(row).some((v) => hasSmartQuotesOrNbsp(String(v ?? '')))) {
      const msg = `Row ${index}: [W-ENCODING-SMART-QUOTES] Smart quotes or non-breaking spaces detected`;
      warnings.push(msg);
      rowWarnings.push({ index, warnings: [msg] });
    }
    if (res.payload) {
      // Determine if this row should be gently flagged (currently only for Sorting with one-letter categories)
      let flagged = false;
      if (res.payload.type === 'sorting') {
        const cats = res.payload.meta.categories;
        const letterSingles = cats.filter((c) => c.length === 1 && /[A-Za-z]/.test(c));
        const lowerSingles = letterSingles.filter((c) => /[a-z]/.test(c));
        const ratioSingles = cats.length > 0 ? letterSingles.length / cats.length : 0;
        flagged = cats.length >= 4 && ratioSingles >= 0.75 && lowerSingles.length >= 1;
      }
      okRows.push({ index, payload: res.payload, warnings: res.warnings.length ? res.warnings : undefined, flagged: flagged || undefined });
    }
    else badRows.push({ index, errors: res.errors });
  });
  return { okRows, badRows, warnings, rowWarnings };
}

export function importPayloadToNewDeckCard(payload: ImportPayload, deckId: number): NewDeckCard {
  const baseCard = {
    deckId,
    question: payload.question,
    bloomLevel: payload.bloom as DeckBloomLevel,
    explanation: payload.explanation,
  };

  switch (payload.type) {
    case 'mcq':
      return { ...baseCard, type: 'Standard MCQ' as DeckCardType, meta: payload.meta as DeckMCQMeta };

    case 'twoTier':
      return { ...baseCard, type: 'Two-Tier MCQ' as DeckCardType, meta: payload.meta as DeckTwoTierMCQMeta };

    case 'short':
      return { ...baseCard, type: 'Short Answer' as DeckCardType, meta: (payload.meta as DeckShortMeta) };

    case 'fill': {
      const fill = payload.meta;
      const blanks = fill.answers.map((answer, i) => ({
        id: i + 1,
        answers: [answer, ...(fill.alternates[i] || [])],
        // apply per-blank overrides when present
        mode: fill.perBlank?.[i + 1]?.mode,
        caseSensitive: fill.perBlank?.[i + 1]?.caseSensitive ?? fill.caseSensitive,
        ignorePunct: fill.perBlank?.[i + 1]?.ignorePunct ?? fill.ignorePunct,
      }));
      const deckMeta: DeckFillMeta = {
        mode: fill.mode,
        blanks,
        options: fill.options,
        caseSensitive: fill.caseSensitive,
        ignorePunct: fill.ignorePunct,
      };
      return { ...baseCard, type: 'Fill in the Blank' as DeckCardType, meta: deckMeta };
    }

    case 'sorting':
      return {
        ...baseCard,
        type: 'Sorting' as DeckCardType,
        meta: { categories: payload.meta.categories, items: payload.meta.items.map((it) => ({ term: it.term, correctCategory: it.category })) } as DeckSortingMeta,
      };

    case 'sequencing':
      return { ...baseCard, type: 'Sequencing' as DeckCardType, meta: payload.meta as DeckSequencingMeta };

    case 'compare':
      return { ...baseCard, type: 'Compare/Contrast' as DeckCardType, meta: { itemA: payload.meta.itemA, itemB: payload.meta.itemB, points: payload.meta.points, prompt: payload.meta.prompt } as DeckCompareContrastMeta };

    case 'cer': {
      const m = payload.meta;
      const cvt = (part?: CERPart): DeckCERMeta['claim'] => {
        if (!part) return {} as any;
        if ('options' in part && typeof part.correct === 'number') return { options: part.options, correct: part.correct };
        return { sampleAnswer: (part as CERPartFree).sampleAnswer };
      };
      const meta: DeckCERMeta = {
        mode: m.mode,
        guidanceQuestion: m.guidance,
        claim: cvt(m.claim),
        evidence: cvt(m.evidence),
        reasoning: cvt(m.reasoning),
      };
      return { ...baseCard, type: 'CER' as DeckCardType, meta };
    }
  }
}
