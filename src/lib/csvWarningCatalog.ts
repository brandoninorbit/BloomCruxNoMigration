// src/lib/csvWarningCatalog.ts
// Central catalog of CSV importer warning codes -> user-friendly info.

export type CsvWarningInfo = {
  code: string;
  title: string;
  description: string;
  impact?: string;
  learnMoreUrl?: string;
};

const make = (code: string, title: string, description: string, impact?: string): CsvWarningInfo => ({ code, title, description, impact });

export const CSV_WARNING_CATALOG: Record<string, CsvWarningInfo> = {
  // General
  'W-ENCODING-SMART-QUOTES': make(
    'W-ENCODING-SMART-QUOTES',
    'Smart quotes or non-breaking spaces detected',
    'Your CSV contains “smart quotes” (curly quotes) or non‑breaking spaces. These can cause mismatches when grading or parsing.',
    'Replace smart quotes with straight quotes and remove non‑breaking spaces. Most editors have a plain‑text mode or a “smart punctuation” setting.'
  ),
  'W-BLOOM-INVALID': make(
    'W-BLOOM-INVALID',
    'Unrecognized BloomLevel',
    'The BloomLevel cell did not match a supported level, so a default was applied.',
    'Fix the Bloom value to one of: Remember, Understand, Apply, Analyze, Evaluate, Create.'
  ),
  'W-DUP-QUESTION': make(
    'W-DUP-QUESTION',
    'Duplicate question detected',
    'A question appears more than once within the same import file.',
    'Remove duplicates or adjust wording to avoid accidental duplication.'
  ),
  'W-ROW-LARGE': make(
    'W-ROW-LARGE',
    'Very large row content',
    'This row has unusually large content (>5000 characters).',
    'Large rows can be slow to render or harder to edit. Consider splitting content.'
  ),

  // MCQ / Two-Tier
  'W-MCQ-ANSWER-NOT-LETTER': make('W-MCQ-ANSWER-NOT-LETTER', 'MCQ answer not A/B/C/D', 'The Answer cell for an MCQ should be one of A, B, C, or D.', 'If the answer is not a single letter, grading can be incorrect or default to the wrong option.'),
  'W-MCQ-SHORT-OPTIONS': make('W-MCQ-SHORT-OPTIONS', 'Most MCQ options are very short', 'Most options are 1–2 chars long, which can be ambiguous or accidental.', 'Learners may be confused by cryptic choices; the item may feel low-quality or misleading.'),
  'W-MCQ-MULTI-ANS': make('W-MCQ-MULTI-ANS', 'Multiple letters in single-select MCQ', 'The Answer contains multiple letters (e.g., "AB"). Single-select MCQ expects a single letter.', 'The answer key may be interpreted as the first letter only, causing mis-grading.'),
  'W-MCQ-OPTIONS-NEAR-DUP': make('W-MCQ-OPTIONS-NEAR-DUP', 'Options are near-duplicates', 'Two or more options differ only by casing, punctuation, or spaces.', 'Near-duplicate answers increase guesswork and reduce clarity.'),
  'W-2T-RANSWER-NOT-LETTER': make('W-2T-RANSWER-NOT-LETTER', 'Tier‑2 answer not A/B/C/D', 'The Tier‑2 Answer should be A, B, C, or D.', 'Incorrect answer format can lead to wrong grading or a broken follow-up question.'),
  'W-2T-DUP-OPTIONS': make('W-2T-DUP-OPTIONS', 'Tier‑2 options duplicate Tier‑1', 'Tier‑2 options largely duplicate Tier‑1 options, which may confuse students.', 'Learners may not understand the distinction between tiers; reasoning may appear redundant.'),
  'W-2T-JUSTIF-DUP': make('W-2T-JUSTIF-DUP', 'Duplicate Tier‑2 options', 'Two or more Tier‑2 options are textually identical.', 'Duplicate justifications reduce diagnostic value and can frustrate learners.'),

  // Fill
  'W-FILL-OPTIONS-FREE-TEXT': make('W-FILL-OPTIONS-FREE-TEXT', 'Word bank in Free Text mode', 'Options were provided but the mode is Free Text. Options are ignored in Free Text.', 'Learners will not see the word bank; if they expect drag & drop, this can be confusing.'),
  'W-FILL-OPTIONS-NO-ANSWERS': make('W-FILL-OPTIONS-NO-ANSWERS', 'Word bank with no answers', 'Options were provided but no answers were specified.', 'The activity may appear incomplete or unsolvable.'),
  'W-FILL-DND-NO-OPTIONS': make('W-FILL-DND-NO-OPTIONS', 'Drag & Drop mode without options', 'Drag & Drop/Either mode needs an Options bank.', 'Drag & Drop will not have tiles to place, making the task impossible.'),
  'W-FILL-WRONG-DELIM': make('W-FILL-WRONG-DELIM', 'Options delimiter may be wrong', 'Options might use comma/semicolon instead of the required pipe (|).', 'Options may appear as one long string instead of separate choices.'),
  'W-FILL-PLACEHOLDER-MISMATCH': make('W-FILL-PLACEHOLDER-MISMATCH', 'Placeholder count mismatches answers', 'The number of [[n]] placeholders in the prompt does not match the number of answers provided.', 'Blanks and answers will not line up, leading to mis-grading or an unsolvable prompt.'),
  'W-FILL-CASE-SENSING': make('W-FILL-CASE-SENSING', 'Mixed-case answers but case-insensitive', 'Answers include mixed case but CaseSensitive is off. Grading may ignore casing unintentionally.', 'Learners may get credit for answers with incorrect casing, or carefully cased answers may not matter.'),

  // Sorting
  'W-SORT-SINGLE-LETTERS': make('W-SORT-SINGLE-LETTERS', 'Categories look like single letters', 'Categories appear to be individual letters, possibly from a split word.', 'Drop zones may be incorrectly shown or incomplete, leading to confusion about what to sort.'),
  'W-SORT-FEW-CATEGORIES': make('W-SORT-FEW-CATEGORIES', 'Only one category provided', 'Sorting needs multiple categories to be meaningful.', 'With a single category, sorting becomes trivial or nonsensical.'),
  'W-SORT-MANY-CATEGORIES': make('W-SORT-MANY-CATEGORIES', 'Many categories', 'More than 20 categories can be unwieldy.', 'Too many drop zones cause a cramped UI and reduce learning effectiveness.'),
  'W-SORT-FEW-ITEMS': make('W-SORT-FEW-ITEMS', 'Few items', 'Fewer than 2 items were provided.', 'The task may feel trivial or not worth presenting as a sorting exercise.'),
  'W-SORT-WRONG-DELIM': make('W-SORT-WRONG-DELIM', 'Categories delimiter may be wrong', 'Categories may use comma/semicolon instead of the required pipe (|).', 'All categories may merge into one, producing missing or incorrect drop zones.'),
  'W-SORT-ITEMS-WRONG-DELIM': make('W-SORT-ITEMS-WRONG-DELIM', 'Items delimiter may be wrong', 'Items may use comma instead of the required pipe (|).', 'Items may not split correctly; the task may have very few or no draggable items.'),
  'W-SORT-UNKNOWN-CATEGORY': make('W-SORT-UNKNOWN-CATEGORY', 'Unknown category referenced', 'Some items reference categories that are not in the Categories list.', 'Those items will have nowhere valid to go; grading can be incorrect.'),
  'W-SORT-CATEGORY-CASE': make('W-SORT-CATEGORY-CASE', 'Category name casing mismatch', 'Some items reference categories with a different case than declared.', 'Items may be treated as pointing to a different category, causing mis-grading.'),
  'W-SORT-EMPTY-CAT': make('W-SORT-EMPTY-CAT', 'Empty category', 'A declared category has no items assigned.', 'Learners may waste time trying to sort into a category that has no correct items.'),
  'W-SORT-ITEM-DUP': make('W-SORT-ITEM-DUP', 'Item term assigned to multiple categories', 'The same item appears under multiple categories.', 'Ambiguity about the correct destination makes grading unreliable.'),
  'W-SORT-TOO-MANY-ITEMS': make('W-SORT-TOO-MANY-ITEMS', 'Very high item count', 'Item count is >50 which often indicates formatting problems.', 'Performance may degrade and the interface can become cluttered/unusable.'),

  // Sequencing
  'W-SEQ-FEW-STEPS': make('W-SEQ-FEW-STEPS', 'Few steps', 'Fewer than 2 steps provided.', 'The task may be trivial or not worth sequencing.'),
  'W-SEQ-SINGLE-LETTERS': make('W-SEQ-SINGLE-LETTERS', 'Steps look like single letters', 'Steps appear to be single letters, likely from a split word.', 'Learners won’t get meaningful steps to arrange; likely a parsing error.'),
  'W-SEQ-WRONG-DELIM': make('W-SEQ-WRONG-DELIM', 'Steps delimiter may be wrong', 'Steps may use comma/semicolon instead of the required pipe (|).', 'All steps may merge into one, making the exercise impossible.'),
  'W-SEQ-DUP-STEP': make('W-SEQ-DUP-STEP', 'Duplicate steps', 'Duplicate step strings found in the sequence.', 'Ambiguity in ordering can make grading unfair or confusing.'),
  'W-SEQ-ORDINALS-DETECTED': make('W-SEQ-ORDINALS-DETECTED', 'Ordinal markers detected', 'Steps include ordinals like "1.", "First:" which may be redundant.', 'Numbers embedded in steps may conflict with UI numbering and distract learners.'),
  'W-SEQ-AMBIGUOUS': make('W-SEQ-AMBIGUOUS', 'Very short/ambiguous steps', 'Many steps are very short, which can make the sequence ambiguous.', 'The item may not effectively assess ordering skills.'),

  // Compare/Contrast
  'W-COMPARE-MISSING-SIDE': make('W-COMPARE-MISSING-SIDE', 'Missing A or B side', 'One or more points are missing the A or B side.', 'A point may render incomplete, making comparison unclear.'),
  'W-COMPARE-WRONG-DELIM': make('W-COMPARE-WRONG-DELIM', 'Points delimiter may be wrong', 'Points may use comma/semicolon instead of the required pipe (|).', 'Pairs may not split correctly; you may see a single giant point.'),
  'W-COMPARE-KEY-DUP': make('W-COMPARE-KEY-DUP', 'Duplicate feature keys', 'Multiple points use the same feature key.', 'Duplicate keys can cause redundant bullets and confuse differences.'),
  'W-COMPARE-UNBALANCED': make('W-COMPARE-UNBALANCED', 'Unbalanced sides', 'The A/B content lengths differ significantly across all points.', 'One side may dominate visually, making comparison harder to skim.'),

  // CER
  'W-CER-MODE-ALIAS': make('W-CER-MODE-ALIAS', 'Mode value normalized', 'Mode was normalized from an alias like "MC" or "Multiple".', 'No functional issue; this warning is informational.'),
  'W-CER-PARTS-MISSING': make('W-CER-PARTS-MISSING', 'Missing CER parts (Free Text)', 'One or more of Claim, Evidence, or Reasoning are missing for Free Text mode.', 'Learners won’t have full guidance or targets for all three CER components.'),
};

export function getWarningInfo(code: string): CsvWarningInfo | undefined {
  return CSV_WARNING_CATALOG[code];
}
