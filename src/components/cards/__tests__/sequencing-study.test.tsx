import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import SequencingStudy from '@/components/cards/SequencingStudy';

describe('SequencingStudy telemetry', () => {
  it('includes responseMs/confidence/guessed in onAnswer', async () => {
    const onAnswer = vi.fn();
    const { getByText, getByLabelText } = render(
      React.createElement(SequencingStudy, {
        prompt: 'Order the steps',
        steps: ['A', 'B', 'C'],
        onAnswer,
      })
    );

    // set telemetry controls
    const select = getByLabelText('Confidence') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } });
    const guessed = getByLabelText('Guessed') as HTMLInputElement;
    fireEvent.click(guessed);

    fireEvent.click(getByText('Check Order'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    const payload = onAnswer.mock.calls[0][0];
    expect(payload).toMatchObject({ confidence: 1, guessed: true });
    expect(typeof payload.responseMs === 'number' && payload.responseMs >= 0).toBe(true);
  });
});
