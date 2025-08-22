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
  meta: { itemA: string; itemB: string; points: { feature: string; a: string; b: string }[] };
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
type MapResult = { payload?: ImportPayload; errors: string[] };

function mapMCQ(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const errors: string[] = [];
  const question = questionFrom(row);
  if (!question) errors.push(`Row ${idx}: missing Question/Title/Prompt/Scenario`);
  const A = pick(row, 'A', 'OptionA', 'Option A');
  const B = pick(row, 'B', 'OptionB', 'Option B');
  const C = pick(row, 'C', 'OptionC', 'Option C');
  const D = pick(row, 'D', 'OptionD', 'Option D');
  const ans = pick(row, 'Answer');
  if (!A) errors.push(`Row ${idx}: missing A`);
  if (!B) errors.push(`Row ${idx}: missing B`);
  if (!C) errors.push(`Row ${idx}: missing C`);
  if (!D) errors.push(`Row ${idx}: missing D`);
  if (!ans) errors.push(`Row ${idx}: missing Answer`);
  if (errors.length) return { errors };
  const options = { A: stripLabel(A!), B: stripLabel(B!), C: stripLabel(C!), D: stripLabel(D!) };
  const answerKey = letterToKey(ans!);
  if (!options[answerKey]) errors.push(`Row ${idx}: Answer points to empty option`);
  if (errors.length) return { errors };
  return {
    errors,
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
  if (!rq) errors.push(`Row ${idx}: missing RQuestion/Tier2Question`);
  if (!RA) errors.push(`Row ${idx}: missing RA`);
  if (!RB) errors.push(`Row ${idx}: missing RB`);
  if (!RC) errors.push(`Row ${idx}: missing RC`);
  if (!RD) errors.push(`Row ${idx}: missing RD`);
  if (!RAnswer) errors.push(`Row ${idx}: missing RAnswer`);
  if (errors.length) return { errors };
  const ropts = { A: stripLabel(RA!), B: stripLabel(RB!), C: stripLabel(RC!), D: stripLabel(RD!) };
  const rKey = letterToKey(RAnswer!);
  if (!ropts[rKey]) errors.push(`Row ${idx}: RAnswer points to empty RA/RB/RC/RD`);
  if (errors.length) return { errors };
  return {
    errors: [],
    payload: {
      type: 'twoTier',
  question: t1.payload!.question,
      bloom,
      explanation: explanationFrom(row),
  meta: { tier1: t1Meta, tier2: { question: rq!.trim(), options: ropts, answer: rKey } },
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
  if (!question) return { errors: [`Row ${idx}: missing Prompt/Question/Title`] };
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
  if (answers.length === 0) errors.push(`Row ${idx}: missing Answer/Answer1`);
  if (multi && maxInPrompt < answers.length) {
    errors.push(`Row ${idx}: Prompt must include [[n]] placeholders up to [[${answers.length}]]`);
  }
  if (errors.length) return { errors };

  // Flags and options (no seeding)
  const caseSensitive = truthy(pick(row, 'CaseSensitive')) || undefined;
  const ignorePunct = truthy(pick(row, 'IgnorePunct')) || undefined;
  const options = splitPipes(pick(row, 'Options'));
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
  const cats = splitPipes(pick(row, 'Categories'));
  const itemsRaw = splitPipes(pick(row, 'Items'));
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: missing Title/Question/Prompt/Scenario`);
  if (!cats.length) errors.push(`Row ${idx}: missing Categories`);
  if (!itemsRaw.length) errors.push(`Row ${idx}: missing Items`);
  const items = itemsRaw.map((s) => {
    const idxColon = s.indexOf(':');
    if (idxColon === -1) {
      errors.push(`Row ${idx}: Sorting item "${s}" must be "term:category"`);
      return { term: '', category: '' };
    }
    return { term: s.slice(0, idxColon).trim(), category: s.slice(idxColon + 1).trim() };
  });
  if (errors.length) return { errors };
  return { errors: [], payload: { type: 'sorting', question, bloom, explanation: explanationFrom(row), meta: { categories: cats, items } } };
}

function mapShort(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const suggested = pick(row, 'SuggestedAnswer', 'Suggested', 'Answer');
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: missing Title/Question/Prompt/Scenario`);
  if (errors.length) return { errors };
  return {
    errors: [],
  payload: { type: 'short', question, bloom, explanation: explanationFrom(row), meta: { suggestedAnswer: suggested ?? '' } },
  };
}

function mapSequencing(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const steps = splitPipes(pick(row, 'Steps') ?? pick(row, 'Items'));
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: missing Title/Question/Prompt/Scenario`);
  if (!steps.length) errors.push(`Row ${idx}: Sequencing requires Steps or Items`);
  if (errors.length) return { errors };
  return { errors: [], payload: { type: 'sequencing', question, bloom, explanation: explanationFrom(row), meta: { steps } } };
}

function mapCompare(row: CsvRow, idx: number, bloom: Bloom): MapResult {
  const question = questionFrom(row);
  const itemA = pick(row, 'ItemA', 'A');
  const itemB = pick(row, 'ItemB', 'B');
  const pts = splitPipes(pick(row, 'Points', 'Pairs'));
  const errors: string[] = [];
  if (!question) errors.push(`Row ${idx}: missing Title/Question/Prompt/Scenario`);
  if (!itemA) errors.push(`Row ${idx}: missing ItemA/A`);
  if (!itemB) errors.push(`Row ${idx}: missing ItemB/B`);
  if (!pts.length) errors.push(`Row ${idx}: missing Points`);
  const points = pts.map((s) => {
    const parts = s.split('::').map((p) => p.trim());
    if (parts.length !== 3) {
      errors.push(`Row ${idx}: Compare point "${s}" must be "feature::a::b"`);
      return { feature: '', a: '', b: '' };
    }
    const [feature, a, b] = parts;
    return { feature, a, b };
  });
  if (errors.length) return { errors };
  return { errors: [], payload: { type: 'compare', question, bloom, explanation: explanationFrom(row), meta: { itemA: itemA!, itemB: itemB!, points } } };
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
  if (!question) errors.push(`Row ${idx}: missing Title/Question/Prompt/Scenario`);
  if (mode === 'Free Text') {
    const claim: CERPartFree = { sampleAnswer: pick(row, 'Claim') };
    const evidence: CERPartFree = { sampleAnswer: pick(row, 'Evidence') };
    const reasoning: CERPartFree = { sampleAnswer: pick(row, 'Reasoning') };
    return { errors, payload: { type: 'cer', question, bloom, explanation: explanationFrom(row), meta: { mode, guidance, claim, evidence, reasoning } } };
  }
  // Multiple Choice
  const parseMC = (prefix: 'Claim' | 'Evidence' | 'Reasoning') => {
    const options = splitPipes(pick(row, `${prefix}Options`));
    const correctStr = pick(row, `${prefix}Correct`);
    let err: string | null = null;
    if (!options.length) err = `${prefix}Options required for CER MC`;
    const idx1 = correctStr ? parseInt(correctStr, 10) : NaN;
    if (!err && !(idx1 >= 1 && idx1 <= options.length)) err = `${prefix}Correct must be 1..${options.length}`;
    return { part: err ? undefined : ({ options, correct: idx1 } as CERPartMC), err };
  };
  const c = parseMC('Claim');
  const e = parseMC('Evidence');
  const r = parseMC('Reasoning');
  if (c.err) errors.push(`Row ${idx}: ${c.err}`);
  if (e.err) errors.push(`Row ${idx}: ${e.err}`);
  if (r.err) errors.push(`Row ${idx}: ${r.err}`);
  if (errors.length) return { errors };
  return {
    errors: [],
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
  okRows: { index: number; payload: ImportPayload }[];
  badRows: { index: number; errors: string[] }[];
  warnings: string[];
} {
  const result = Papa.parse<CsvRow>(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });
  const warnings: string[] = [];
  const okRows: { index: number; payload: ImportPayload }[] = [];
  const badRows: { index: number; errors: string[] }[] = [];
  if (result.errors.length > 0) {
    // Collect the first parse error as a bad row at header level
    warnings.push(`CSV parser reported ${result.errors.length} issue(s); first: ${result.errors[0].message}`);
  }
  const rows = result.data || [];
  rows.forEach((row, i) => {
    const index = i + 2; // header + 1-based
    const t = mapCardType(pick(row, 'CardType'));
    if (!t) {
      badRows.push({ index, errors: [`Row ${index}: missing or unsupported CardType`] });
      return;
    }
    const bloom = normalizeBloom(pick(row, 'BloomLevel')) || DEFAULT_BLOOM[t];
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
        res = { errors: [`Row ${index}: unsupported CardType`] };
    }
    if (res.payload) okRows.push({ index, payload: res.payload });
    else badRows.push({ index, errors: res.errors });
  });
  return { okRows, badRows, warnings };
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
      return { ...baseCard, type: 'Compare/Contrast' as DeckCardType, meta: { itemA: payload.meta.itemA, itemB: payload.meta.itemB, points: payload.meta.points } as DeckCompareContrastMeta };

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
