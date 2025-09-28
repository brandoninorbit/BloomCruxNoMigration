import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import FillBlankStudy from '@/components/cards/FillBlankStudy';

describe('FillBlankStudy telemetry', () => {
  it('includes responseMs/confidence/guessed in onAnswer', async () => {
    const onAnswer = vi.fn();
  const { getByText, getByLabelText, getByPlaceholderText } = render(
      React.createElement(FillBlankStudy, {
        stem: 'The capital of [[1]] is [[2]]',
        blanks: [
          { id: 1, answers: ['France'] },
          { id: 2, answers: ['Paris'] },
        ],
        wordBank: ['France', 'Paris'],
        onAnswer,
      })
    );

    // set telemetry controls first
    const select = getByLabelText('Confidence') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '3' } });
    const guessed = getByLabelText('Guessed') as HTMLInputElement;
    fireEvent.click(guessed);

    // fill blanks by typing (free mode is allowed by default via either)
  const blank1 = getByPlaceholderText('[[1]]') as HTMLInputElement;
  fireEvent.change(blank1, { target: { value: 'France' } });
  const blank2 = getByPlaceholderText('[[2]]') as HTMLInputElement;
  fireEvent.change(blank2, { target: { value: 'Paris' } });

    fireEvent.click(getByText('Submit answer'));

  // onAnswer may be invoked multiple times (immediate + effect). Use last call.
  expect(onAnswer.mock.calls.length).toBeGreaterThan(0);
  const payload = onAnswer.mock.calls[onAnswer.mock.calls.length - 1][0];
    expect(payload).toMatchObject({ allCorrect: true, confidence: 3, guessed: true });
    expect(typeof payload.responseMs === 'number' && payload.responseMs >= 0).toBe(true);
  });
});
