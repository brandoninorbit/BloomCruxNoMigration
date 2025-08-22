import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import MCQStudy from '@/components/cards/MCQStudy';

describe('MCQStudy telemetry', () => {
  it('includes responseMs/confidence/guessed in onAnswer', async () => {
    const onAnswer = vi.fn();
    const { getByText, getByLabelText } = render(
      React.createElement(MCQStudy, {
        prompt: 'Q?',
        options: [
          { key: 'A', text: 'A1' },
          { key: 'B', text: 'B1' },
          { key: 'C', text: 'C1' },
          { key: 'D', text: 'D1' },
        ],
        answerKey: 'A',
        onAnswer,
      })
    );

    // set confidence and guessed
    const select = getByLabelText('Confidence') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2' } });
    const guessed = getByLabelText('Guessed') as HTMLInputElement;
    fireEvent.click(guessed);

    // choose then check
    fireEvent.click(getByText('A1'));
    fireEvent.click(getByText('Check Answer'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    const payload = onAnswer.mock.calls[0][0];
    expect(payload).toMatchObject({ correct: true, chosen: 'A', mode: 'auto', confidence: 2, guessed: true });
    expect(typeof payload.responseMs === 'number' && payload.responseMs >= 0).toBe(true);
  });
});
