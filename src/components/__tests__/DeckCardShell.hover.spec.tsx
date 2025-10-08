import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, test, expect } from 'vitest';
import { DeckCardShell } from '../decks/DeckCardShell';

/*
  This test attempts to catch a regression where cards that HAVE a description
  appear to move downward instead of lifting slightly compared to cards without
  a description. In jsdom we cannot fully emulate layout / transforms, but we
  can:
    1. Ensure classNames applied on hover are identical except for presence of
       the popover element.
    2. Verify no *additional* translate-y positive class is injected when a
       description exists.
    3. Assert the popover injection does not wrap the card in an extra block
       that could shift layout (structure invariant).
*/

describe('DeckCardShell hover lift invariants', () => {
  function setup(hasDescription: boolean) {
    const utils = render(
      <DeckCardShell
        title={hasDescription ? 'With Desc' : 'No Desc'}
        description={hasDescription ? 'Some detailed description text that triggers popover.' : undefined}
        onClick={() => {}}
      />
    );
    const root = utils.container.firstElementChild as HTMLElement; // wrapper div.group
    const article = root.querySelector('article') as HTMLElement;
    return { utils, root, article };
  }

  test('hover adds the same translate-y class regardless of description', () => {
    const withDesc = setup(true);
    const withoutDesc = setup(false);

    // Pre-hover: neither article should have translate-y utility
    expect(withDesc.article.className).not.toMatch(/-translate-y-/);
    expect(withoutDesc.article.className).not.toMatch(/-translate-y-/);

    // Simulate hover: fire events on wrapper (group)
    fireEvent.mouseEnter(withDesc.root);
    fireEvent.mouseEnter(withoutDesc.root);

    // After hover: both should have group-hover applied class physically present? Tailwind group-hover
    // classes are static in markup (already present). We assert the exact translate-y utility is identical.
    const withDescTranslate = (withDesc.article.className.match(/-translate-y-[^\s]+/) || [null])[0];
    const withoutDescTranslate = (withoutDesc.article.className.match(/-translate-y-[^\s]+/) || [null])[0];

    expect(withDescTranslate).toBe(withoutDescTranslate);
  });

  test('popover presence does not insert extra ancestor wrappers', () => {
    const { root } = setup(true);
    // We expect immediate children: optional popover div + article
    const childrenTags = Array.from(root.children).map(el => el.tagName.toLowerCase());
    // Allowed set: at most one div (popover) + article
    expect(childrenTags.filter(t => t === 'article').length).toBe(1);
    expect(childrenTags.filter(t => t === 'div').length).toBeLessThanOrEqual(1);
  });

  test('no positive (downward) translate class added when description present', () => {
    const { root, article } = setup(true);
    fireEvent.mouseEnter(root);
    // Ensure we did not add translate-y-X without a minus sign
    expect(article.className).not.toMatch(/(?<!-)translate-y-[0-9]/);
  });
});
