# CSV Importer Warning Patterns

Non-blocking warnings emitted during CSV import. Each code is stable and can be searched in the codebase or logs.

Legend: `[Code]` Description — Applies to (Card types)

### General & File-Level
- `[W-ENCODING-SMART-QUOTES]` Smart quotes or non-breaking spaces detected; consider normalizing — All
- `[W-BLOOM-INVALID]` Unrecognized BloomLevel; default applied — All
- `[W-DUP-QUESTION]` Duplicate question detected within the same file — All
- `[W-ROW-LARGE]` Row content is very large (>5000 chars) — All

### MCQ / Two-Tier MCQ
- `[W-MCQ-ANSWER-NOT-LETTER]` Answer should be one of A|B|C|D — MCQ
- `[W-MCQ-SHORT-OPTIONS]` Most MCQ options are very short (<=2 chars) — MCQ
- `[W-MCQ-MULTI-ANS]` Answer contains multiple letters for single-select MCQ.
- `[W-MCQ-OPTIONS-NEAR-DUP]` Options are near-duplicates (differ by punctuation/space).
- `[W-2T-RANSWER-NOT-LETTER]` Tier-2 Answer should be one of A|B|C|D — Two‑Tier MCQ
- `[W-2T-DUP-OPTIONS]` Tier‑2 options largely duplicate Tier‑1 options — Two‑Tier MCQ
- `[W-2T-JUSTIF-DUP]` Two or more Tier-2 justification options are textually identical.

### Fill-in-the-Blank
- `[W-FILL-OPTIONS-FREE-TEXT]` Word bank provided but Mode is Free Text — Fill
- `[W-FILL-OPTIONS-NO-ANSWERS]` Word bank provided but no answers — Fill
- `[W-FILL-DND-NO-OPTIONS]` Drag & Drop/Either mode but Options missing or too few — Fill
- `[W-FILL-WRONG-DELIM]` Options may be using comma/semicolon instead of pipe — Fill
- `[W-FILL-PLACEHOLDER-MISMATCH]` Number of `[[n]]` placeholders doesn't match number of `AnswerN` columns.
- `[W-FILL-CASE-SENSING]` Answers contain mixed-case words, but `CaseSensitive` flag is not set.

### Sorting
- `[W-SORT-SINGLE-LETTERS]` Categories look like single letters (e.g., split word) — Sorting
- `[W-SORT-FEW-CATEGORIES]` Only one category provided — Sorting
- `[W-SORT-MANY-CATEGORIES]` More than 20 categories provided — Sorting
- `[W-SORT-FEW-ITEMS]` Fewer than 2 items provided — Sorting
- `[W-SORT-WRONG-DELIM]` Categories may be using comma/semicolon instead of pipe — Sorting
- `[W-SORT-ITEMS-WRONG-DELIM]` Items list may be using comma instead of pipe — Sorting
- `[W-SORT-UNKNOWN-CATEGORY]` Items reference categories not in Categories — Sorting
- `[W-SORT-CATEGORY-CASE]` Items reference categories with different casing — Sorting
- `[W-SORT-EMPTY-CAT]` A declared category has no items assigned to it.
- `[W-SORT-ITEM-DUP]` The same item term is assigned to multiple categories.
- `[W-SORT-TOO-MANY-ITEMS]` Item count is very high (>50), suggesting a formatting error.

### Sequencing
- `[W-SEQ-FEW-STEPS]` Fewer than 2 steps provided — Sequencing
- `[W-SEQ-SINGLE-LETTERS]` Steps look like single letters (e.g., split word) — Sequencing
- `[W-SEQ-WRONG-DELIM]` Steps may be using comma/semicolon instead of pipe — Sequencing
- `[W-SEQ-DUP-STEP]` Duplicate step strings found in the sequence.
- `[W-SEQ-ORDINALS-DETECTED]` Steps include ordinals (“1.”, “First:”) which may be redundant.

### Compare/Contrast
- `[W-COMPARE-MISSING-SIDE]` One or more points missing A or B side — Compare/Contrast
- `[W-COMPARE-WRONG-DELIM]` Points may be using comma/semicolon instead of pipe between pairs — Compare/Contrast
- `[W-COMPARE-KEY-DUP]` Duplicate feature keys found across different points.
- `[W-COMPARE-UNBALANCED]` The content for Item A and Item B sides is significantly different in length across points.

### CER (Claim-Evidence-Reasoning)
- `[W-CER-MODE-ALIAS]` Mode value normalized from alias (e.g., MC, Multiple) — CER
- `[W-CER-PARTS-MISSING]` One or more of Claim, Evidence, or Reasoning is missing for Free Text mode.

---
**Notes**
- Warnings never block import; they are surfaced in `parseCsv(...).rowWarnings` and aggregated in `warnings`.
- Flagged rows (currently Sorting single-letter categories) also set `okRows[i].flagged = true` so UIs can offer “exclude flagged” options.
- When adding a new warning, please:
  1) Add a concise description here.
  2) Prefix the message in code with the same `[CODE]`.
  3) Prefer per-row warnings (in `map*` functions) and reserve global ones for file-level patterns.
- Some patterns that would be invalid (e.g., `[W-MCQ-ANSWER-MISSING]`) are treated as hard errors and will cause the row to fail, so they are not listed here as warnings.
