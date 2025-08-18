"use client";

import { useMemo, useState } from "react";
import type { DeckCard, DeckBloomLevel, DeckMCQMeta, DeckShortMeta, DeckFillMeta, DeckSortingMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckTwoTierMCQMeta, DeckCERMeta } from "@/types/deck-cards";
import AddCardModal from "@/components/decks/AddCardModal";

export type CardListProps = {
  cards: DeckCard[];
  onEdit: (card: DeckCard) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (nextIds: number[]) => Promise<void>;
};

export default function CardList({ cards, onEdit, onDelete, onReorder }: CardListProps) {
  const items = useMemo(() => cards, [cards]);
  const [editing, setEditing] = useState<DeckCard | null>(null);

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const ids = [...items.map((c) => c.id)];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await onReorder(ids);
  };

  type ModalSubmitPayload = {
    type: DeckCard["type"];
    bloomLevel?: DeckBloomLevel;
    question: string;
    explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
  };

  const submitEdit = async (payload: ModalSubmitPayload) => {
    if (!editing) return;
    const common = {
      id: editing.id,
      deckId: editing.deckId,
      question: payload.question,
      explanation: payload.explanation,
      bloomLevel: payload.bloomLevel,
      position: editing.position,
      createdAt: editing.createdAt,
      updatedAt: editing.updatedAt,
    };

    if (payload.type === "Standard MCQ") {
      await onEdit({ ...common, type: "Standard MCQ", meta: payload.meta as DeckMCQMeta });
    } else if (payload.type === "Short Answer") {
      await onEdit({ ...common, type: "Short Answer", meta: payload.meta as DeckShortMeta });
    } else if (payload.type === "Sorting") {
      await onEdit({ ...common, type: "Sorting", meta: payload.meta as DeckSortingMeta });
    } else if (payload.type === "Sequencing") {
      await onEdit({ ...common, type: "Sequencing", meta: payload.meta as DeckSequencingMeta });
    } else if (payload.type === "Compare/Contrast") {
      await onEdit({ ...common, type: "Compare/Contrast", meta: payload.meta as DeckCompareContrastMeta });
    } else if (payload.type === "Two-Tier MCQ") {
      await onEdit({ ...common, type: "Two-Tier MCQ", meta: payload.meta as DeckTwoTierMCQMeta });
    } else if (payload.type === "Fill in the Blank") {
      await onEdit({ ...common, type: "Fill in the Blank", meta: payload.meta as DeckFillMeta });
    } else if (payload.type === "CER") {
      await onEdit({ ...common, type: "CER", meta: payload.meta as DeckCERMeta });
    }
    setEditing(null);
  };

  return (
    <>
      <ul className="space-y-3">
        {items.map((card, idx) => (
          <li key={card.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              {/* Left: question, type, bloom */}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{card.question || "Untitled"}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {card.type}
                  {card.bloomLevel ? <span className="text-gray-400"> · {card.bloomLevel}</span> : null}
                </p>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2">
                <IconButton label="Star" onClick={() => { /* TODO: persist star */ }}>
                  <StarIcon />
                </IconButton>
                <IconButton label="View" onClick={() => { /* TODO: study single-card */ }}>
                  <EyeIcon />
                </IconButton>
                <IconButton label="Edit" onClick={() => setEditing(card)}>
                  <EditIcon />
                </IconButton>
                <IconButton label="Delete" onClick={() => onDelete(card.id)} danger>
                  <TrashIcon />
                </IconButton>
                <div className="ml-2 flex items-center gap-1">
                  <SmallIconButton label="Move up" onClick={() => move(idx, -1)}>
                    <UpIcon />
                  </SmallIconButton>
                  <SmallIconButton label="Move down" onClick={() => move(idx, 1)}>
                    <DownIcon />
                  </SmallIconButton>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AddCardModal
        open={Boolean(editing)}
        mode="edit"
        initialCard={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={submitEdit}
      />
    </>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`p-2 rounded-lg border transition-colors hover:bg-gray-100 ${danger ? "text-red-600 border-red-200 hover:bg-red-50" : "text-gray-700 border-gray-200"}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SmallIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
      aria-label={label}
      title={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.11a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.57a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.845.61l-4.725-2.885a.563.563 0 00-.586 0L6.258 20.506a.562.562 0 01-.845-.61l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.57a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.11z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 5v14" />
      <path d="M5 12l7 7 7-7" />
    </svg>
  );
}
