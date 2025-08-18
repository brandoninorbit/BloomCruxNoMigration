"use client";

import { useEffect, useState } from "react";
import type { DeckBloomLevel, DeckCard, DeckStandardMCQ, DeckShortAnswer, DeckMCQMeta, DeckShortMeta } from "@/types/deck-cards";
import { CARD_TYPES_BY_BLOOM, BLOOM_LEVELS, defaultBloomFor, type CardType } from "@/types/card-catalog";

type SubmitPayload = {
  type: DeckCard["type"];
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta;
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
  type AllowedType = "Standard MCQ" | "Short Answer";
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
      } else {
        setShortSuggested((initialCard as DeckShortAnswer).meta.suggestedAnswer);
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
    }
  }, [open, isEdit, initialCard]);

  if (!open) return null;

  const canSave = (() => {
    if (!question.trim()) return false;
    if (type === "Standard MCQ") {
      return [A, B, C, D].every((s) => s.trim().length > 0);
    }
    return shortSuggested.trim().length > 0;
  })();

  const save = async () => {
    try {
      if (!canSave) return;
      setSaving(true);
      setError(undefined);
      const payload: SubmitPayload =
        type === "Standard MCQ"
          ? {
              type,
              bloomLevel,
              question: question.trim(),
              explanation: explanation.trim() || undefined,
              meta: { options: { A, B, C, D }, answer },
            }
          : {
              type,
              bloomLevel,
              question: question.trim(),
              explanation: explanation.trim() || undefined,
              meta: { suggestedAnswer: shortSuggested.trim() },
            };
      await onSubmit(payload);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Card" : "Add Card"}</h3>
          <button className="text-gray-500 hover:text-gray-800" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Card Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              value={type}
              onChange={(e) => {
                const next = e.target.value as CardType;
                if (next === "Standard MCQ" || next === "Short Answer") {
                  setType(next);
                  // Auto-apply default bloom from catalog when type changes
                  setBloomLevel(defaultBloomFor(next));
                }
              }}
              disabled={isEdit}
            >
              {BLOOM_LEVELS.map((lvl) => (
                <optgroup key={lvl} label={lvl}>
                  {CARD_TYPES_BY_BLOOM[lvl].map((t) => (
                    <option key={t} value={t} disabled={t !== "Standard MCQ" && t !== "Short Answer"}>
                      {t}
                      {t !== "Standard MCQ" && t !== "Short Answer" ? " (coming soon)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {!isEdit && <p className="text-xs text-gray-500 mt-1">Only Standard MCQ and Short Answer are available right now; others are coming soon.</p>}
          </div>

          {/* Bloom Level (manual override allowed) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={bloomLevel ?? ""}
              onChange={(e) => setBloomLevel((e.target.value || undefined) as DeckBloomLevel | undefined)}
            >
              <option value="">None</option>
              <optgroup label="Bloom Levels">
                {BLOOM_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter question stem"
            />
          </div>

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
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value as "A" | "B" | "C" | "D")}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Answer</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                type="text"
                value={shortSuggested}
                onChange={(e) => setShortSuggested(e.target.value)}
              />
            </div>
          )}

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
  );
}
