"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { DeckBloomLevel, DeckCard, DeckStandardMCQ, DeckShortAnswer, DeckMCQMeta, DeckShortMeta, DeckFillMeta, DeckFillBlank, DeckSortingMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckTwoTierMCQMeta, DeckCERMeta, DeckCERMode, DeckFillMode, DeckFillMetaV3, DeckFillBlankSpec } from "@/types/deck-cards";
import { CARD_TYPES_BY_BLOOM, BLOOM_LEVELS, defaultBloomFor, type CardType } from "@/types/card-catalog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

type SubmitPayload = {
  type: DeckCard["type"];
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
};

type Props = {
  open: boolean;
  mode?: "create" | "edit";
  initialCard?: DeckCard;
  onClose: () => void;
  onSubmit: (input: SubmitPayload) => Promise<void> | void;
};

export default function AddCardModal({ open, mode = "create", initialCard, onClose, onSubmit }: Props) {
  const isEdit = mode === "edit";
  type AllowedType = "Standard MCQ" | "Short Answer" | "Fill in the Blank" | "Sorting" | "Sequencing" | "Compare/Contrast" | "Two-Tier MCQ" | "CER";
  const [type, setType] = useState<AllowedType>("Standard MCQ");

  const [question, setQuestion] = useState("");
  const [bloomLevel, setBloomLevel] = useState<DeckBloomLevel | undefined>(
    undefined
  );
  const [explanation, setExplanation] = useState("");
  const [A, setA] = useState("");
  const [B, setB] = useState("");
  const [C, setC] = useState("");
  const [D, setD] = useState("");
  const [answer, setAnswer] = useState<"A" | "B" | "C" | "D">("A");
  const [shortSuggested, setShortSuggested] = useState("");
  // Fill in the Blank (multi-blank + modes)
  const [fillAnswer, setFillAnswer] = useState(""); // legacy single-answer fallback
  const [fillMode, setFillMode] = useState<DeckFillMode>("Free Text");
  const [fillAnswers, setFillAnswers] = useState<string[]>([]); // answers aligned to __n__ markers
  const [fillOptions, setFillOptions] = useState<string[]>([]); // word bank for Drag & Drop
  const [fillAlternates, setFillAlternates] = useState<string[][]>([]); // per-blank alternates
  const [fillPerBlank, setFillPerBlank] = useState<({ mode?: DeckFillMode; caseSensitive?: boolean; ignorePunct?: boolean })[]>([]);
  const passageRef = useRef<HTMLTextAreaElement | null>(null);
  // Two-Tier MCQ Tier 2 fields
  const [tier2Question, setTier2Question] = useState("");
  const [rA, setRA] = useState("");
  const [rB, setRB] = useState("");
  const [rC, setRC] = useState("");
  const [rD, setRD] = useState("");
  const [rAnswer, setRAnswer] = useState<"A" | "B" | "C" | "D">("A");
  const [categories, setCategories] = useState<string[]>(["Category 1", "Category 2"]);
  const [items, setItems] = useState<{ term: string; correctCategory: string }[]>([{ term: "", correctCategory: "" }]);
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [ccItemA, setCcItemA] = useState("");
  const [ccItemB, setCcItemB] = useState("");
  const [ccPrompt, setCcPrompt] = useState<string>("");
  const [ccPoints, setCcPoints] = useState<{ feature: string; a: string; b: string }[]>([{ feature: "", a: "", b: "" }]);
  // CER state
  const [cerMode, setCerMode] = useState<DeckCERMode>("Free Text");
  const [cerGuidance, setCerGuidance] = useState<string>("");
  const [cerClaim, setCerClaim] = useState<string>("");
  const [cerEvidence, setCerEvidence] = useState<string>("");
  const [cerReasoning, setCerReasoning] = useState<string>("");
  const [cerClaimOpts, setCerClaimOpts] = useState<string[]>(["", ""]);
  const [cerEvidenceOpts, setCerEvidenceOpts] = useState<string[]>(["", ""]);
  const [cerReasoningOpts, setCerReasoningOpts] = useState<string[]>(["", ""]);
  const [cerClaimCorrect, setCerClaimCorrect] = useState<number>(0);
  const [cerEvidenceCorrect, setCerEvidenceCorrect] = useState<number>(0);
  const [cerReasoningCorrect, setCerReasoningCorrect] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialCard) {
      setQuestion(initialCard.question ?? "");
      setType(initialCard.type as AllowedType);
      setBloomLevel(initialCard.bloomLevel);
      setExplanation(initialCard.explanation ?? "");
      if (initialCard.type === "Standard MCQ") {
        const meta = (initialCard as DeckStandardMCQ).meta;
        setA(meta.options.A);
        setB(meta.options.B);
        setC(meta.options.C);
        setD(meta.options.D);
        setAnswer(meta.answer);
      } else if (initialCard.type === "Short Answer") {
        setShortSuggested((initialCard as DeckShortAnswer).meta.suggestedAnswer);
    } else if (initialCard.type === "Fill in the Blank") {
        const meta = (initialCard as DeckFillBlank).meta as DeckFillMeta;
        // Legacy single-answer (V1)
        if ("answer" in meta) {
          setFillAnswer(meta.answer);
          setFillMode("Free Text");
          setFillAnswers([meta.answer]);
          setFillOptions([]);
      setFillAlternates([]);
      setFillPerBlank([]);
        } else if ("blanks" in meta) {
          // V3: derive a simple answers array from blanks by id order
          const m = meta; // DeckFillMetaV3
      const blanks = [...m.blanks].sort((a, b) => Number(a.id) - Number(b.id));
      const answers = blanks.map((b) => (Array.isArray(b.answers) && b.answers.length ? b.answers[0] : ""));
      const alternates = blanks.map((b) => (Array.isArray(b.answers) ? b.answers.slice(1) : []));
      const perBlank = blanks.map((b) => ({ mode: b.mode, caseSensitive: b.caseSensitive, ignorePunct: b.ignorePunct }));
      setFillMode(m.mode || "Free Text");
      setFillAnswers(answers);
      setFillAlternates(alternates);
      setFillPerBlank(perBlank);
      setFillOptions(Array.isArray(m.options) ? m.options : []);
      setFillAnswer(answers[0] ?? "");
        } else {
          // V2
          const m = meta; // DeckFillMetaV2
          setFillMode(m.mode || "Free Text");
          setFillAnswers(Array.isArray(m.answers) ? m.answers : []);
          setFillOptions(Array.isArray(m.options) ? m.options : []);
          setFillAnswer(m.answers?.[0] ?? "");
      setFillAlternates([]);
      setFillPerBlank([]);
        }
      } else if (initialCard.type === "Sorting") {
        const meta = (initialCard.meta as DeckSortingMeta);
        setCategories(meta.categories?.length ? meta.categories : ["Category 1", "Category 2"]);
        setItems(meta.items?.length ? meta.items : [{ term: "", correctCategory: "" }]);
      } else if (initialCard.type === "Sequencing") {
        const meta = (initialCard.meta as DeckSequencingMeta);
        setSteps(meta.steps?.length ? meta.steps : ["", ""]);
      } else if (initialCard.type === "Compare/Contrast") {
        const meta = (initialCard.meta as DeckCompareContrastMeta);
        setCcItemA(meta.itemA ?? "");
        setCcItemB(meta.itemB ?? "");
        setCcPrompt(meta.prompt ?? "");
        setCcPoints(meta.points?.length ? meta.points : [{ feature: "", a: "", b: "" }]);
  } else if (initialCard.type === "Two-Tier MCQ") {
        const meta = (initialCard.meta as DeckTwoTierMCQMeta);
        // Tier 1
        setA(meta.tier1.options.A);
        setB(meta.tier1.options.B);
        setC(meta.tier1.options.C);
        setD(meta.tier1.options.D);
        setAnswer(meta.tier1.answer);
        // Tier 2
        setTier2Question(meta.tier2.question ?? "");
        setRA(meta.tier2.options.A);
        setRB(meta.tier2.options.B);
        setRC(meta.tier2.options.C);
        setRD(meta.tier2.options.D);
        setRAnswer(meta.tier2.answer);
      } else if (initialCard.type === "CER") {
        const meta = (initialCard.meta as DeckCERMeta);
        setCerMode(meta.mode);
        setCerGuidance(meta.guidanceQuestion ?? "");
        if (meta.mode === "Free Text") {
          setCerClaim((meta.claim as { sampleAnswer?: string }).sampleAnswer ?? "");
          setCerEvidence((meta.evidence as { sampleAnswer?: string }).sampleAnswer ?? "");
          setCerReasoning((meta.reasoning as { sampleAnswer?: string }).sampleAnswer ?? "");
        } else {
          setCerClaimOpts((meta.claim as { options: string[] }).options ?? ["", ""]);
          setCerEvidenceOpts((meta.evidence as { options: string[] }).options ?? ["", ""]);
          setCerReasoningOpts((meta.reasoning as { options: string[] }).options ?? ["", ""]);
          setCerClaimCorrect((meta.claim as { correct: number }).correct ?? 0);
          setCerEvidenceCorrect((meta.evidence as { correct: number }).correct ?? 0);
          setCerReasoningCorrect((meta.reasoning as { correct: number }).correct ?? 0);
        }
      }
    } else if (open && !isEdit) {
      // reset for creation
      setQuestion("");
      setType("Standard MCQ");
      setBloomLevel(defaultBloomFor("Standard MCQ"));
      setExplanation("");
      setA("");
      setB("");
      setC("");
      setD("");
  setAnswer("A");
  setShortSuggested("");
  setFillAnswer("");
  setFillMode("Free Text");
  setFillAnswers([]);
  setFillOptions([]);
  setFillAlternates([]);
  setFillPerBlank([]);
  setCategories(["Category 1", "Category 2"]);
  setItems([{ term: "", correctCategory: "" }]);
  setSteps(["", ""]);
      setCcItemA("");
      setCcItemB("");
  setCcPrompt("");
      setCcPoints([{ feature: "", a: "", b: "" }]);
      // reset Two-Tier
      setTier2Question("");
      setRA(""); setRB(""); setRC(""); setRD("");
  setRAnswer("A");
  setCerMode("Free Text");
  setCerGuidance("");
  setCerClaim(""); setCerEvidence(""); setCerReasoning("");
  setCerClaimOpts(["", ""]); setCerEvidenceOpts(["", ""]); setCerReasoningOpts(["", ""]);
  setCerClaimCorrect(0); setCerEvidenceCorrect(0); setCerReasoningCorrect(0);
    }
  }, [open, isEdit, initialCard]);

  if (!open) return null;

  // Helpers for Fill-in-the-Blank authoring
  const countBlanks = (text: string): number => {
    if (!text) return 0;
    // Support both legacy __n__ and current [[n]] markers
    const re = /__(\d+)__|\[\[(\d+)\]\]/g;
    const seen = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = parseInt((m[1] || m[2]) as string, 10);
      if (Number.isFinite(n)) seen.add(n);
    }
    return seen.size;
  };

  const hasNumberedBlanks = (text: string): boolean => /__(\d+)__|\[\[(\d+)\]\]/.test(text || "");

  const insertBlankAtCursor = () => {
    const nextIndex = (() => {
      // Compute next index based on both marker styles
      const re = /__(\d+)__|\[\[(\d+)\]\]/g;
      let max = 0; let m: RegExpExecArray | null;
      while ((m = re.exec(question))) {
        const n = parseInt((m[1] || m[2]) as string, 10);
        if (n > max) max = n;
      }
      return max + 1;
    })();
    const ta = passageRef.current;
    // Standardize new inserts to [[n]]
    const token = ` [[${nextIndex}]] `;
    if (ta && typeof ta.selectionStart === "number") {
      const start = ta.selectionStart;
      const end = ta.selectionEnd ?? start;
      const before = question.slice(0, start);
      const after = question.slice(end);
      const next = before + token + after;
      setQuestion(next);
      // re-focus and set caret after inserted token
      requestAnimationFrame(() => {
        ta.focus();
        const pos = before.length + token.length;
        try {
          ta.setSelectionRange(pos, pos);
        } catch {}
      });
    } else {
      setQuestion((prev) => (prev ? prev + token : token.trim()));
    }
  };

  const removeBlank = (index: number) => {
    // remove the specific marker and renumber subsequent ones for both styles
    const nextText = (question || "")
      // remove/renumber legacy __n__
      .replace(/__(\d+)__/g, (match, grp) => {
        const n = parseInt(grp, 10);
        if (n === index) return "";
        if (n > index) return `__${n - 1}__`;
        return match;
      })
      // remove/renumber [[n]]
      .replace(/\[\[(\d+)\]\]/g, (match, grp) => {
        const n = parseInt(grp, 10);
        if (n === index) return "";
        if (n > index) return `[[${n - 1}]]`;
        return match;
      })
      .replace(/\s{2,}/g, " ")
      .trim();
    setQuestion(nextText);
    setFillAnswers((prev) => {
      const next = [...prev];
      if (index - 1 >= 0 && index - 1 < next.length) next.splice(index - 1, 1);
      return next;
    });
  };

  const normalizeAnswers = (arr: string[], blanks: number, legacy: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < blanks; i++) {
      const v = (arr?.[i] ?? "").trim();
      out[i] = v;
    }
    if (blanks <= 1) {
      const leg = (legacy || "").trim();
      if (!out[0] && leg) out[0] = leg;
    }
    return out;
  };

  const renderFillPreview = (text: string) => {
    const nodes: React.ReactNode[] = [];
    // Highlight both legacy __n__ and current [[n]] markers
    const re = /__(\d+)__|\[\[(\d+)\]\]/g;
    let last = 0; let m: RegExpExecArray | null; let key = 0;
    while ((m = re.exec(text || ""))) {
      const before = text.slice(last, m.index);
      if (before) nodes.push(<span key={`t-${key++}`}>{before}</span>);
      const n = parseInt((m[1] || m[2]) as string, 10);
      nodes.push(
        <span key={`b-${key++}`} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded group align-baseline">
          <span className="font-mono">[[{n}]]</span>
          <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700" onClick={() => removeBlank(n)} aria-label={`Remove blank ${n}`}>
            <SmallXIcon className="h-3 w-3" />
          </button>
        </span>
      );
      last = m.index + m[0].length;
    }
    const tail = text.slice(last);
    if (tail) nodes.push(<span key={`t-${key++}`}>{tail}</span>);
    return nodes;
  };

  const canSave = (() => {
    if (type !== "Compare/Contrast" && !question.trim()) return false;
    if (type === "Standard MCQ") {
      return [A, B, C, D].every((s) => s.trim().length > 0);
    }
    if (type === "Short Answer") {
      return shortSuggested.trim().length > 0;
    }
    if (type === "Fill in the Blank") {
      const blanks = countBlanks(question);
      if (blanks <= 1) {
        // single-blank legacy path
        return (fillAnswers[0]?.trim() || fillAnswer.trim()).length > 0;
      }
      // multi-blank: require at least blanks answers
      if (fillAnswers.length < blanks) return false;
      return fillAnswers.slice(0, blanks).every((s) => s.trim().length > 0);
    }
    if (type === "Two-Tier MCQ") {
      const t1Complete = question.trim().length > 0 && [A, B, C, D].every((s) => s.trim().length > 0);
      const t2Complete = tier2Question.trim().length > 0 && [rA, rB, rC, rD].every((s) => s.trim().length > 0);
      return t1Complete && t2Complete;
    }
    if (type === "Compare/Contrast") {
      const hasAB = ccItemA.trim().length > 0 && ccItemB.trim().length > 0;
      const validPoints = ccPoints.filter((p) => p.feature.trim() && p.a.trim() && p.b.trim());
      return hasAB && validPoints.length >= 1;
    }
    if (type === "Sequencing") {
      return steps.length >= 2 && steps.every((s) => s.trim().length > 0);
    }
    if (type === "CER") {
      if (!question.trim()) return false;
      if (cerMode === "Free Text") {
        return [cerClaim, cerEvidence, cerReasoning].some((s) => s.trim().length > 0);
      }
      const ok = (opts: string[], correct: number) => opts.filter((s) => s.trim().length > 0).length >= 2 && correct >= 0 && correct < opts.length;
      return ok(cerClaimOpts, cerClaimCorrect) && ok(cerEvidenceOpts, cerEvidenceCorrect) && ok(cerReasoningOpts, cerReasoningCorrect);
    }
    // Sorting
    const hasCategories = categories.filter((c) => c.trim().length > 0).length >= 2;
    const hasItems = items.length >= 1 && items.every((it) => it.term.trim().length > 0 && it.correctCategory.trim().length > 0);
    return hasCategories && hasItems;
  })();

  const save = async () => {
    try {
      if (!canSave) return;
      setSaving(true);
      setError(undefined);
      let payload: SubmitPayload;
      if (type === "Standard MCQ") {
        payload = {
          type,
          bloomLevel,
          question: question.trim(),
          explanation: explanation.trim() || undefined,
          meta: { options: { A, B, C, D }, answer },
        };
      } else if (type === "Short Answer") {
        payload = {
          type,
          bloomLevel,
          question: question.trim(),
          explanation: explanation.trim() || undefined,
          meta: { suggestedAnswer: shortSuggested.trim() },
        };
      } else if (type === "Fill in the Blank") {
        const blanks = countBlanks(question);
        const answersNorm = normalizeAnswers(fillAnswers, blanks, fillAnswer);
        let metaOut: DeckFillMeta;
        if (blanks <= 1 && fillMode === "Free Text" && (!fillOptions.length)) {
          metaOut = { answer: answersNorm[0] ?? "" };
        } else if (blanks > 1 || fillAlternates.length || fillPerBlank.length) {
          // Build V3 preserving per-blank alternates and flags
          const blanksOut: DeckFillBlankSpec[] = answersNorm.map((a, idx) => {
            const id = String(idx + 1);
            const alts = fillAlternates[idx] ?? [];
            const spec = fillPerBlank[idx] ?? {};
            const answers = [a, ...alts].filter((s) => typeof s === 'string');
            const b: DeckFillBlankSpec = { id, answers };
            if (spec.mode) (b as DeckFillBlankSpec & { mode?: DeckFillMode }).mode = spec.mode;
            if (spec.caseSensitive !== undefined) (b as DeckFillBlankSpec & { caseSensitive?: boolean }).caseSensitive = spec.caseSensitive;
            if (spec.ignorePunct !== undefined) (b as DeckFillBlankSpec & { ignorePunct?: boolean }).ignorePunct = spec.ignorePunct;
            return b;
          });
          let options = [...fillOptions];
          if ((fillMode === "Drag & Drop" || fillMode === "Either") && options.length === 0) {
            // Seed from answers + alternates
            const uniq = new Set<string>();
            answersNorm.forEach((a) => a && uniq.add(a));
            fillAlternates.forEach((arr) => arr.forEach((s) => s && uniq.add(s)));
            options = Array.from(uniq);
          }
          let metaV3: DeckFillMetaV3 = { mode: fillMode, blanks: blanksOut };
          if (options.length) metaV3 = { ...metaV3, options };
          metaOut = metaV3;
        } else {
          // V2 path
          if (fillMode === "Drag & Drop") {
            const merged = Array.from(new Set([...(fillOptions || []), ...answersNorm.filter(Boolean)]));
            metaOut = { mode: fillMode, answers: answersNorm, options: merged } as DeckFillMeta;
          } else {
            metaOut = { mode: fillMode, answers: answersNorm } as DeckFillMeta;
          }
        }
        payload = {
          type,
          bloomLevel,
          question: question.trim(),
          explanation: explanation.trim() || undefined,
          meta: metaOut,
        };
      } else if (type === "Sequencing") {
        payload = {
          type,
          bloomLevel,
          question: question.trim(),
          explanation: explanation.trim() || undefined,
          meta: { steps: steps.map((s) => s.trim()) },
        };
      } else if (type === "Two-Tier MCQ") {
        payload = {
          type,
          bloomLevel,
          question: question.trim(),
          explanation: explanation.trim() || undefined,
          meta: {
            tier1: { options: { A, B, C, D }, answer },
            tier2: { question: tier2Question.trim(), options: { A: rA, B: rB, C: rC, D: rD }, answer: rAnswer },
          },
        };
      } else if (type === "Compare/Contrast") {
        payload = {
          type,
          bloomLevel,
          question: `Compare ${ccItemA.trim()} and ${ccItemB.trim()}`,
          explanation: explanation.trim() || undefined,
          meta: {
            itemA: ccItemA.trim(),
            itemB: ccItemB.trim(),
            prompt: ccPrompt.trim() || undefined,
            points: ccPoints
              .map((p) => ({ feature: p.feature.trim(), a: p.a.trim(), b: p.b.trim() }))
              .filter((p) => p.feature && p.a && p.b),
          },
        };
      } else if (type === "CER") {
        const meta: DeckCERMeta = cerMode === "Free Text"
          ? {
              mode: cerMode,
              guidanceQuestion: cerGuidance.trim() || undefined,
              claim: { sampleAnswer: cerClaim.trim() || undefined },
              evidence: { sampleAnswer: cerEvidence.trim() || undefined },
              reasoning: { sampleAnswer: cerReasoning.trim() || undefined },
            }
          : {
              mode: cerMode,
              guidanceQuestion: cerGuidance.trim() || undefined,
              claim: { options: cerClaimOpts.map((s) => s.trim()).filter(Boolean), correct: cerClaimCorrect },
              evidence: { options: cerEvidenceOpts.map((s) => s.trim()).filter(Boolean), correct: cerEvidenceCorrect },
              reasoning: { options: cerReasoningOpts.map((s) => s.trim()).filter(Boolean), correct: cerReasoningCorrect },
            };
        payload = {
          type,
          bloomLevel,
          question: question.trim(), // Scenario/Prompt as title
          explanation: undefined,
          meta,
        };
      } else {
        payload = {
          type,
          bloomLevel,
          question: (question || "").trim(),
          explanation: explanation.trim() || undefined,
          meta: { categories: categories.map((c) => c.trim()).filter(Boolean), items: items.map((i) => ({ term: i.term.trim(), correctCategory: i.correctCategory.trim() })) },
        };
      }
      await onSubmit(payload);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white w-full rounded-xl shadow-sm m-4 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Card" : "Add Card"}</h3>
            <button className="text-gray-500 hover:text-gray-800 p-2 rounded-md hover:bg-gray-100" onClick={onClose} aria-label="Close" type="button">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6 space-y-5 overflow-y-auto">
          {/* Global selectors: always visible so users can switch between any card types */}
          {/* Card Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
            <Select
              value={type}
              onValueChange={(next) => {
                const n = next as CardType;
                if (n === "Standard MCQ" || n === "Short Answer" || n === "Fill in the Blank" || n === "Sorting" || n === "Sequencing" || n === "Compare/Contrast" || n === "Two-Tier MCQ" || n === "CER") {
                  setType(n as AllowedType);
                  setBloomLevel(defaultBloomFor(n));
                  // Reset type-specific fields when switching types to avoid stale UI state
                  if (n === "Standard MCQ") {
                    setA(""); setB(""); setC(""); setD(""); setAnswer("A");
                  } else if (n === "Short Answer") {
                    setShortSuggested("");
                  } else if (n === "Fill in the Blank") {
                    setFillAnswer("");
                  } else if (n === "Sorting") {
                    setCategories(["Category 1", "Category 2"]);
                    setItems([{ term: "", correctCategory: "" }]);
                  } else if (n === "Sequencing") {
                    setSteps(["", ""]);
                  } else if (n === "Compare/Contrast") {
                    setCcItemA(""); setCcItemB(""); setCcPoints([{ feature: "", a: "", b: "" }]);
                  } else if (n === "Two-Tier MCQ") {
                    setTier2Question(""); setRA(""); setRB(""); setRC(""); setRD(""); setRAnswer("A");
                    setA(""); setB(""); setC(""); setD(""); setAnswer("A");
                  } else if (n === "CER") {
                    setCerMode("Free Text");
                    setCerGuidance("");
                    setCerClaim(""); setCerEvidence(""); setCerReasoning("");
                    setCerClaimOpts(["", ""]); setCerEvidenceOpts(["", ""]); setCerReasoningOpts(["", ""]);
                    setCerClaimCorrect(0); setCerEvidenceCorrect(0); setCerReasoningCorrect(0);
                  }
                }
              }}
            >
              <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Card Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                {BLOOM_LEVELS.map((lvl) => (
                  <SelectGroup key={lvl}>
                    <SelectLabel>{lvl}</SelectLabel>
                    {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                      <SelectItem key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ" && t !== "CER"}>
                        {t === "Sorting" ? "Drag & Drop Sorting" : t}
                        {t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ" && t !== "CER" ? " (coming soon)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && <p className="text-xs text-gray-500 mt-1">Standard MCQ, Short Answer, Fill in the Blank, Drag & Drop Sorting, Sequencing, Compare/Contrast, Two-Tier MCQ, and CER are available; others are coming soon.</p>}
          </div>

          {/* Bloom Level (manual override allowed) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
            <Select value={bloomLevel ?? ""} onValueChange={(v) => setBloomLevel((v || undefined) as DeckBloomLevel | undefined)}>
              <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Bloom Level">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                {BLOOM_LEVELS.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

  {/* Prompt / Question (hidden for Sorting, Sequencing, Compare/Contrast, and CER which has its own Scenario/Prompt section) */}
  {type !== "Sorting" && type !== "Sequencing" && type !== "Compare/Contrast" && type !== "CER" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
        {type === "Fill in the Blank" ? (
                  <span>
                    Prompt <span className="text-gray-400 text-xs">(use __1__, __2__... or click Insert Blank)</span>
                  </span>
        ) : (
                  "Question"
                )}
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                ref={type === "Fill in the Blank" ? passageRef : undefined}
        placeholder={type === "Fill in the Blank" ? "The powerhouse of the cell is the __1__. Use 'Insert Blank' to add more." : "Enter question stem"}
              />
              {type === "Fill in the Blank" && (
                <div className="mt-2 text-sm text-gray-800">
                  {renderFillPreview(question)}
                </div>
              )}
            </div>
          )}

          {type === "Standard MCQ" ? (
            <>
              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { key: "A", value: A, setter: setA },
                    { key: "B", value: B, setter: setB },
                    { key: "C", value: C, setter: setC },
                    { key: "D", value: D, setter: setD },
                  ] as const
                ).map((opt) => (
                  <div key={opt.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Option {opt.key}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      type="text"
                      value={opt.value}
                      onChange={(e) => opt.setter(e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Correct Answer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                <Select value={answer} onValueChange={(v) => setAnswer(v as "A" | "B" | "C" | "D")}>
                  <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Correct Answer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : type === "Short Answer" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Answer</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                type="text"
                value={shortSuggested}
                onChange={(e) => setShortSuggested(e.target.value)}
              />
            </div>
          ) : type === "Fill in the Blank" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]"
                  onClick={() => insertBlankAtCursor()}
                >
                  <PlusCircleIcon className="h-4 w-4" /> Insert Blank
                </button>
                <div className="text-xs text-gray-500">Blanks are marked in the prompt as __1__, __2__, ...</div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-2">Answer Mode</div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="fill-mode" checked={fillMode === "Free Text"} onChange={() => setFillMode("Free Text")} />
                    <span>Free Text</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="fill-mode"
                      checked={fillMode === "Drag & Drop"}
                      onChange={() => {
                        setFillMode("Drag & Drop");
                        const blanks = countBlanks(question);
                        const answersNorm = normalizeAnswers(fillAnswers, blanks, fillAnswer).filter(Boolean);
                        if ((fillOptions || []).length === 0) setFillOptions(Array.from(new Set(answersNorm)));
                      }}
                    />
                    <span>Drag & Drop (word bank)</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">Blank Answers</div>
                <div className="text-xs text-gray-500 mb-2">Provide the correct answer for each blank in order of their number.</div>
                <div className="space-y-2">
                  {Array.from({ length: countBlanks(question) }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-16 text-gray-600">Blank {i + 1}</div>
                      <input
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        type="text"
                        value={fillAnswers[i] ?? ""}
                        onChange={(e) => {
                          const next = [...fillAnswers];
                          next[i] = e.target.value;
                          setFillAnswers(next);
                        }}
                        placeholder={`Answer for blank ${i + 1}`}
                      />
                      {hasNumberedBlanks(question) && (
                        <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeBlank(i + 1)} aria-label={`Remove blank ${i + 1}`}>
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {countBlanks(question) === 0 && (
                  <div className="text-xs text-amber-600 mt-1">No blanks found in the prompt. Click &quot;Insert Blank&quot; to add one.</div>
                )}
              </div>

              {fillMode === "Drag & Drop" && (
                <div>
                  <div className="font-semibold text-gray-700 mb-2">Word Bank Options</div>
                  <div className="space-y-2">
                    {(fillOptions.length ? fillOptions : [""]).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-6 text-gray-500">{idx + 1}.</div>
                        <input
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...fillOptions];
                            next[idx] = e.target.value;
                            setFillOptions(next);
                          }}
                          placeholder={`Option ${idx + 1}`}
                        />
                        <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => setFillOptions(fillOptions.filter((_, i) => i !== idx))} aria-label="Remove option">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]" onClick={() => setFillOptions([...(fillOptions || []), ""]) }>
                      <PlusCircleIcon className="h-4 w-4" /> Add Option
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : type === "Sorting" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {/* Left: card selectors + prompt and categories */}
              <div>
                {/* Card Type (Sorting inline only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                  <Select
                    disabled={isEdit}
                    value={type}
                    onValueChange={(next) => {
                      const n = next as CardType;
                      if (n === "Standard MCQ" || n === "Short Answer" || n === "Fill in the Blank" || n === "Sorting" || n === "Sequencing" || n === "Compare/Contrast" || n === "Two-Tier MCQ") {
                        setType(n as AllowedType);
                        setBloomLevel(defaultBloomFor(n));
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Card Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectGroup key={lvl}>
                          <SelectLabel>{lvl}</SelectLabel>
                          {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                            <SelectItem key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ"}>
                              {t === "Sorting" ? "Drag & Drop Sorting" : t}
                              {t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ" ? " (coming soon)" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Bloom Level (override allowed) */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                  <Select value={bloomLevel ?? ""} onValueChange={(v) => setBloomLevel((v || undefined) as DeckBloomLevel | undefined)}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Bloom Level">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt / Instructions</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Sort the terms into the correct categories."
                />
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categories (Drop Zones)</label>
                  <div className="space-y-2">
                    {categories.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          type="text"
                          value={c}
                          onChange={(e) => {
                            const next = [...categories];
                            next[idx] = e.target.value;
                            setCategories(next);
                            // Clear invalid item categories proactively when renaming
                            setItems((prev) => prev.map((it) => (
                              it.correctCategory && !next.includes(it.correctCategory)
                                ? { ...it, correctCategory: "" }
                                : it
                            )));
                          }}
                          placeholder={`Category ${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => {
                            const next = categories.filter((_, i) => i !== idx);
                            setCategories(next);
                            setItems((prev) => prev.map((it) => (
                              it.correctCategory && !next.includes(it.correctCategory)
                                ? { ...it, correctCategory: "" }
                                : it
                            )));
                          }}
                          aria-label="Remove category"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]"
                    onClick={() => setCategories([...categories, `Category ${categories.length + 1}`])}
                  >
                    <PlusCircleIcon className="h-4 w-4" />
                    Add Category
                  </button>
                </div>
              </div>

              {/* Divider (overlay, does not take a grid column) */}
              <div aria-hidden className="hidden md:block absolute inset-y-0 left-1/2 w-px bg-gray-200 -translate-x-1/2 pointer-events-none" />

              {/* Right: items to sort */}
              <div>
                <div className="mb-3 font-semibold text-gray-700">Items to Sort</div>
                <div className="rounded-lg border border-gray-200 p-3 space-y-4">
                  {items.map((it, idx) => (
                    <div key={idx} className="rounded-md bg-gray-50 p-3">
                      <div className="font-medium text-gray-800 mb-2">Item {idx + 1}</div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                        type="text"
                        value={it.term}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...next[idx], term: e.target.value };
                          setItems(next);
                        }}
                      />
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correct Category</label>
                      <Select value={it.correctCategory || undefined} onValueChange={(v) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], correctCategory: v };
                        setItems(next);
                      }}>
                        <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Correct Category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]"
                  onClick={() => setItems([...items, { term: "", correctCategory: "" }])}
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>
            </div>
          ) : type === "Sequencing" ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                  <Select
                    disabled={isEdit}
                    value={type}
                    onValueChange={(next) => {
                      const n = next as CardType;
                      if (n === "Standard MCQ" || n === "Short Answer" || n === "Fill in the Blank" || n === "Sorting" || n === "Sequencing" || n === "Compare/Contrast" || n === "Two-Tier MCQ") {
                        setType(n);
                        setBloomLevel(defaultBloomFor(n));
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Card Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectGroup key={lvl}>
                          <SelectLabel>{lvl}</SelectLabel>
                          {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                            <SelectItem key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ"}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Bloom */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                  <Select value={bloomLevel ?? ""} onValueChange={(v) => setBloomLevel((v || undefined) as DeckBloomLevel | undefined)}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Bloom Level">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt / Instructions</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Place the events of mitosis in the correct order."
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-700">Items (in correct order)</div>
                    <div className="text-xs text-gray-500">These will be shuffled for the user during the study session.</div>
                  </div>
                </div>
                <div className="mt-2 space-y-3">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-6 text-right text-gray-500">{idx + 1}.</div>
                      <input
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        type="text"
                        value={s}
                        onChange={(e) => {
                          const next = [...steps];
                          next[idx] = e.target.value;
                          setSteps(next);
                        }}
                        placeholder={`Step ${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                        aria-label="Remove step"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]"
                  onClick={() => setSteps([...steps, ""])}
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>
            </div>
          ) : type === "Two-Tier MCQ" ? (
            <div className="space-y-6">
              <div>
                <div className="text-[#2481f9] font-semibold mb-2">Tier 1: Content Question</div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { key: "A", value: A, setter: setA },
                    { key: "B", value: B, setter: setB },
                    { key: "C", value: C, setter: setC },
                    { key: "D", value: D, setter: setD },
                  ] as const).map((opt) => (
                    <div key={opt.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Option {opt.key}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={opt.value} onChange={(e) => opt.setter(e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                  <Select value={answer} onValueChange={(v) => setAnswer(v as "A" | "B" | "C" | "D")}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Correct Answer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-[#2481f9] font-semibold mb-2">Tier 2: Reasoning Question</div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" placeholder="e.g., Which statement best supports your answer?" value={tier2Question} onChange={(e) => setTier2Question(e.target.value)} />
                <div className="grid grid-cols-2 gap-4 mt-3">
                  {([
                    { key: "A", value: rA, setter: setRA },
                    { key: "B", value: rB, setter: setRB },
                    { key: "C", value: rC, setter: setRC },
                    { key: "D", value: rD, setter: setRD },
                  ] as const).map((opt) => (
                    <div key={opt.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Option {opt.key}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={opt.value} onChange={(e) => opt.setter(e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                  <Select value={rAnswer} onValueChange={(v) => setRAnswer(v as "A" | "B" | "C" | "D")}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Correct Answer (Tier 2)">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : type === "Compare/Contrast" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {/* Left panel: selects + inputs */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                    <Select
                      disabled={isEdit}
                      value={type}
                      onValueChange={(next) => {
                        const n = next as AllowedType;
                        setType(n);
                        setBloomLevel(defaultBloomFor(n));
                      }}
                    >
                      <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Card Type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                        {BLOOM_LEVELS.map((lvl) => (
                          <SelectGroup key={lvl}>
                            <SelectLabel>{lvl}</SelectLabel>
                            {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                              <SelectItem key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ"}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                    <Select value={bloomLevel ?? ""} onValueChange={(v) => setBloomLevel((v || undefined) as DeckBloomLevel | undefined)}>
                      <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Bloom Level">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                        {BLOOM_LEVELS.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item A</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={ccItemA} onChange={(e) => setCcItemA(e.target.value)} placeholder="e.g., Mitosis" />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item B</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={ccItemB} onChange={(e) => setCcItemB(e.target.value)} placeholder="e.g., Meiosis" />
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompt / Context (optional)</label>
                  <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={ccPrompt} onChange={(e) => setCcPrompt(e.target.value)} placeholder="e.g., In which scenarios would you use A vs B? Define the context to guide the comparison." />
                </div>

                <div className="mt-5">
                  <div className="font-semibold text-gray-700 mb-2">Comparison Points</div>
                  <div className="space-y-4">
                    {ccPoints.map((p, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-200 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Feature</label>
                            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={p.feature} onChange={(e) => {
                              const next = [...ccPoints];
                              next[idx] = { ...p, feature: e.target.value };
                              setCcPoints(next);
                            }} placeholder="e.g., Purpose" />
                          </div>
                          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Point for A</label>
                              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={p.a} onChange={(e) => {
                                const next = [...ccPoints];
                                next[idx] = { ...p, a: e.target.value };
                                setCcPoints(next);
                              }} placeholder="e.g., Cell proliferation, growth, repair" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Point for B</label>
                              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={p.b} onChange={(e) => {
                                const next = [...ccPoints];
                                next[idx] = { ...p, b: e.target.value };
                                setCcPoints(next);
                              }} placeholder="e.g., Sexual reproduction to produce gametes" />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => setCcPoints(ccPoints.filter((_, i) => i !== idx))} aria-label="Remove comparison point">
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]" onClick={() => setCcPoints([...ccPoints, { feature: "", a: "", b: "" }])}>
                    <PlusCircleIcon className="h-4 w-4" />
                    Add Comparison Point
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div aria-hidden className="hidden md:block absolute inset-y-0 left-1/2 w-px bg-gray-200 -translate-x-1/2 pointer-events-none" />

              {/* Right panel: preview */}
              <div>
                <div className="text-center font-semibold text-gray-700 mb-3">Card Preview</div>
                <div className="rounded-xl border border-gray-200 p-5 bg-white">
                  <div className="text-xl font-bold text-gray-900 mb-4">{ccItemA?.trim() || ccItemB?.trim() ? `Compare ${ccItemA || 'Item A'} and ${ccItemB || 'Item B'}` : 'Compare Item A and Item B'}</div>
                  {ccPrompt?.trim() ? (
                    <div className="mb-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">Prompt</div>
                      <div>{ccPrompt}</div>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-gray-200">
                    <div className="grid grid-cols-12 text-sm font-medium text-gray-600">
                      <div className="col-span-4 px-3 py-2 border-b">Feature</div>
                      <div className="col-span-4 px-3 py-2 border-b">Item A</div>
                      <div className="col-span-4 px-3 py-2 border-b">Item B</div>
                    </div>
                    {ccPoints.filter((p) => p.feature.trim() || p.a.trim() || p.b.trim()).length ? (
                      <div className="divide-y">
                        {ccPoints.filter((p) => p.feature.trim() || p.a.trim() || p.b.trim()).map((p, idx) => (
                          <div key={idx} className="grid grid-cols-12 text-sm">
                            <div className="col-span-4 px-3 py-2">{p.feature || '—'}</div>
                            <div className="col-span-4 px-3 py-2">{p.a || '—'}</div>
                            <div className="col-span-4 px-3 py-2">{p.b || '—'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-400">Preview will appear here.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : type === "CER" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                  <Select disabled={isEdit} value={type} onValueChange={(n) => { const t = n as AllowedType; setType(t); setBloomLevel(defaultBloomFor(t)); }}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Card Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectGroup key={lvl}>
                          <SelectLabel>{lvl}</SelectLabel>
                          {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                            <SelectItem key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer" && t !== "Fill in the Blank" && t !== "Sorting" && t !== "Sequencing" && t !== "Compare/Contrast" && t !== "Two-Tier MCQ" && t !== "CER"}>{t}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                  <Select value={bloomLevel ?? ""} onValueChange={(v) => setBloomLevel((v || undefined) as DeckBloomLevel | undefined)}>
                    <SelectTrigger className="rounded-xl border-[#2481f9] text-gray-800 focus:ring-2 focus:ring-[#2481f9]/30 focus:ring-offset-0 focus:border-[#2481f9]" aria-label="Bloom Level">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2481f9] bg-white">
                      {BLOOM_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scenario / Prompt</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Describe the scenario learners will respond to" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guidance Question (optional)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" type="text" value={cerGuidance} onChange={(e) => setCerGuidance(e.target.value)} placeholder="e.g., Can they conclude? Why?" />
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-2">Answer Components</div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="cer-mode" checked={cerMode === "Free Text"} onChange={() => setCerMode("Free Text")} />
                    <span>Free Text</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="cer-mode" checked={cerMode === "Multiple Choice"} onChange={() => { setCerMode("Multiple Choice"); if (cerClaimOpts.length < 2) setCerClaimOpts(["",""]); if (cerEvidenceOpts.length < 2) setCerEvidenceOpts(["",""]); if (cerReasoningOpts.length < 2) setCerReasoningOpts(["",""]); }} />
                    <span>Multiple Choice</span>
                  </label>
                </div>
              </div>

              {/* Claim */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="font-semibold mb-2">Claim</div>
                {cerMode === "Free Text" ? (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Sample Answer</label>
                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={cerClaim} onChange={(e) => setCerClaim(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cerClaimOpts.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="cer-claim-correct" checked={cerClaimCorrect === i} onChange={() => setCerClaimCorrect(i)} />
                        <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" type="text" value={opt} onChange={(e) => { const next=[...cerClaimOpts]; next[i]=e.target.value; setCerClaimOpts(next); }} placeholder={`Option ${i+1}`} />
                        <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => setCerClaimOpts(cerClaimOpts.filter((_, idx) => idx !== i))} aria-label="Remove option"><TrashIcon className="h-5 w-5" /></button>
                      </div>
                    ))}
                    <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]" onClick={() => setCerClaimOpts([...cerClaimOpts, ""]) }>
                      <PlusCircleIcon className="h-4 w-4" /> Add Option
                    </button>
                  </div>
                )}
              </div>

              {/* Evidence */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="font-semibold mb-2">Evidence</div>
                {cerMode === "Free Text" ? (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Sample Answer</label>
                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={cerEvidence} onChange={(e) => setCerEvidence(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cerEvidenceOpts.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="cer-evidence-correct" checked={cerEvidenceCorrect === i} onChange={() => setCerEvidenceCorrect(i)} />
                        <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" type="text" value={opt} onChange={(e) => { const next=[...cerEvidenceOpts]; next[i]=e.target.value; setCerEvidenceOpts(next); }} placeholder={`Option ${i+1}`} />
                        <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => setCerEvidenceOpts(cerEvidenceOpts.filter((_, idx) => idx !== i))} aria-label="Remove option"><TrashIcon className="h-5 w-5" /></button>
                      </div>
                    ))}
                    <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]" onClick={() => setCerEvidenceOpts([...cerEvidenceOpts, ""]) }>
                      <PlusCircleIcon className="h-4 w-4" /> Add Option
                    </button>
                  </div>
                )}
              </div>

              {/* Reasoning */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="font-semibold mb-2">Reasoning</div>
                {cerMode === "Free Text" ? (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Sample Answer</label>
                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} value={cerReasoning} onChange={(e) => setCerReasoning(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cerReasoningOpts.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="cer-reasoning-correct" checked={cerReasoningCorrect === i} onChange={() => setCerReasoningCorrect(i)} />
                        <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" type="text" value={opt} onChange={(e) => { const next=[...cerReasoningOpts]; next[i]=e.target.value; setCerReasoningOpts(next); }} placeholder={`Option ${i+1}`} />
                        <button type="button" className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => setCerReasoningOpts(cerReasoningOpts.filter((_, idx) => idx !== i))} aria-label="Remove option"><TrashIcon className="h-5 w-5" /></button>
                      </div>
                    ))}
                    <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-[#2481f9] hover:text-white hover:border-[#2481f9]" onClick={() => setCerReasoningOpts([...cerReasoningOpts, ""]) }>
                      <PlusCircleIcon className="h-4 w-4" /> Add Option
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Explanation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why is this correct?"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2.5 rounded-lg bg-[#2481f9] text-white font-semibold hover:bg-blue-600 disabled:opacity-60"
              onClick={save}
              disabled={!canSave || saving}
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Card"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Inline icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function SmallXIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 4L4 12" />
      <path d="M4 4l8 8" />
    </svg>
  );
}
