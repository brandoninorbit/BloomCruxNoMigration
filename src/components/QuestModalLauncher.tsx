"use client";
import React from "react";

export default function QuestModalLauncher({ deckId }: { deckId: number }) {
  // Launcher now navigates to the dedicated mission entry page (no modals).
  return (
    <a
      href={`/decks/${deckId}/quest/enter`}
  className="mt-auto w-full text-center bg-blue-600 text-white py-3 rounded-[46px] font-semibold hover:bg-blue-700 transition-colors"
      aria-label="Enter Quest"
    >
      Enter Quest
    </a>
  );
}
