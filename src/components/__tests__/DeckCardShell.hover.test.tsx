import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom';
import { DeckCardShell } from '../decks/DeckCardShell';

/*
  Hover invariants test:
  - Cards with and without description must receive identical translate-y hover class on <article>.
  - No positive translate-y (downward) class should be introduced when description exists.
  - Popover insertion should not add extra ancestor wrappers (only optional popover sibling + article).
*/

describe('DeckCardShell hover invariants', () => {
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

  test('translate-y utility parity (pre & post hover)', () => {
    const withDesc = setup(true);
    const withoutDesc = setup(false);

    // Pre-hover: no actual applied translate-y class (Tailwind group-hover classes are static in markup)
    // We assert absence of a *non-group* translate class.
    expect(withDesc.article.className).not.toMatch(/(?<!group-)-translate-y-/);
    expect(withoutDesc.article.className).not.toMatch(/(?<!group-)-translate-y-/);

    // Simulate hover (jsdom won't apply group-hover, but class list already contains the group-hover variant)
    fireEvent.mouseEnter(withDesc.root);
    fireEvent.mouseEnter(withoutDesc.root);

    const withDescTranslate = (withDesc.article.className.match(/group-hover:-translate-y-[^\s]+/) || [null])[0];
    const withoutDescTranslate = (withoutDesc.article.className.match(/group-hover:-translate-y-[^\s]+/) || [null])[0];
    expect(withDescTranslate).toBe(withoutDescTranslate);
  });

  test('popover presence adds only one extra sibling div', () => {
    const { root } = setup(true);
    const childTags = Array.from(root.children).map(el => el.tagName.toLowerCase());
    expect(childTags.filter(t => t === 'article').length).toBe(1);
    // 0 or 1 popover div allowed
    expect(childTags.filter(t => t === 'div').length).toBeLessThanOrEqual(1);
  });

  test('no downward (positive) translate class appears with description', () => {
    const { root, article } = setup(true);
    fireEvent.mouseEnter(root);
    // Ensure no class like translate-y-1 (without preceding -) exists
    expect(article.className).not.toMatch(/\stranslate-y-[0-9]/);
  });
});
