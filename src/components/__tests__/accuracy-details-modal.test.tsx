import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccuracyDetailsModal, MissionAnswer } from '../AccuracyDetailsModal';

// Minimal focused test of classification & render (no Supabase / dashboard coupling)

describe('AccuracyDetailsModal', () => {
  const answers: MissionAnswer[] = [
    { cardId: 1, correct: 1, response: 'ATP' },
    { cardId: 2, correct: 0, response: 'NADH' },
    { cardId: 3, correct: 0.7, response: 'Glucose' },
  ];
  const cards: Record<number, { id: number; question: string }> = {
    1: { id: 1, question: 'Energy currency?' },
    2: { id: 2, question: 'Electron carrier?' },
    3: { id: 3, question: 'Input to glycolysis?' }
  };

  it('renders weak and strong sections with counts', () => {
    render(<AccuracyDetailsModal open onClose={() => {}} answers={answers} cardsById={cards} accuracyPercent={66.6} />);
    expect(screen.getByText(/Mission Accuracy Details/i)).toBeTruthy();
    expect(screen.getByText(/Weak cards \(1\)/i)).toBeTruthy();
    expect(screen.getByText(/Strong points \(2\)/i)).toBeTruthy();
    // verify a card label present
    expect(screen.getByText(/Energy currency/)).toBeTruthy();
  });

  it('shows empty state when no answers', () => {
    render(<AccuracyDetailsModal open onClose={() => {}} answers={[]} />);
    expect(screen.getByText(/No answer data captured/i)).toBeTruthy();
  });
});
