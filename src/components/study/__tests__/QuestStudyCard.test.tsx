import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import QuestStudyCard from "../QuestStudyCard";
import type { DeckShortAnswer } from "@/types/deck-cards";
import { describe, it, expect, vi } from "vitest";

describe("QuestStudyCard Create manual grading (Short Answer)", () => {
  it("shows suggested answer then manual grade buttons and forwards graded correctness", async () => {
    const onAnswer = vi.fn();
    const onContinue = vi.fn();
    const card: DeckShortAnswer = {
      id: 42,
      deckId: 1,
      type: "Short Answer",
      bloomLevel: "Create",
      question: "Explain why X happens",
      meta: { suggestedAnswer: "Because of Y" },
      explanation: "Longer explanation",
    };

    render(<QuestStudyCard card={card} onAnswer={onAnswer} onContinue={onContinue} />);

    // Type an answer into the textarea
    const textarea = screen.getByPlaceholderText("Type your answer...");
    fireEvent.change(textarea, { target: { value: "My attempt" } });

    // Click Check Answer to reveal suggested answer
    const check = screen.getByRole("button", { name: /Check Answer/i });
    fireEvent.click(check);

    // Suggested answer should be visible
    expect(screen.getByText(/Suggested answer/i)).toBeDefined();
    expect(screen.getByText(/Because of Y/)).toBeDefined();

    // Click 'Yes' to mark self-judged correct — this should trigger pending manual grade UI
    const yes = screen.getByRole("button", { name: /Yes/i });
    fireEvent.click(yes);

    // Manual grade buttons should appear
    const grade90 = await screen.findByRole("button", { name: "90%" });
    expect(grade90).toBeDefined();

    // Click 90% and expect onAnswer to be called with correctness 0.9
    fireEvent.click(grade90);

    expect(onAnswer).toHaveBeenCalled();
    const call = onAnswer.mock.calls[onAnswer.mock.calls.length - 1][0];
    expect(call.cardId).toBe(42);
    expect(call.correctness).toBeCloseTo(0.9);
  });
});
