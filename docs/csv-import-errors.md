# CSV Importer Error Codes (E-)

This reference lists all critical importer errors emitted during CSV parsing. These errors block a row from being imported. Each message starts with an [E-...] code to make triage easy and to group similar issues in the UI.

How to read the messages:
- Format: Row N: [E-CODE] Message text
- Impact: The row is excluded from import until the issue is fixed.
- Fix: Adjust your CSV to satisfy the required format or fields.

---

## General

- [E-GENERAL-CARDTYPE] Missing or unsupported CardType
  - Why: The CardType cell is blank or not one of the supported names.
  - Fix: Use one of: "Standard MCQ", "Short Answer", "Fill in the Blank", "Sorting", "Sequencing", "Compare/Contrast", "Two-Tier MCQ", "CER" (aliases accepted per csv-import guide).

---

## Standard MCQ

- [E-MCQ-MISSING-QUESTION] Missing Question/Title/Prompt/Scenario
  - Fix: Provide card text in Question (or Title/Prompt/Scenario).
- [E-MCQ-MISSING-A] Missing A
- [E-MCQ-MISSING-B] Missing B
- [E-MCQ-MISSING-C] Missing C
- [E-MCQ-MISSING-D] Missing D
  - Fix: Provide all four options (A, B, C, D). Labels like "A) text" are OK.
- [E-MCQ-MISSING-ANSWER] Missing Answer
  - Fix: Answer must be A|B|C|D (case-insensitive).
- [E-MCQ-ANSWER-EMPTY] Answer points to empty option
  - Fix: Ensure the referenced option cell has text.

---

## Two‑Tier MCQ

- [E-2T-MISSING-RQUESTION] Missing RQuestion/Tier2Question
- [E-2T-MISSING-RA] Missing RA
- [E-2T-MISSING-RB] Missing RB
- [E-2T-MISSING-RC] Missing RC
- [E-2T-MISSING-RD] Missing RD
- [E-2T-MISSING-RANSWER] Missing RAnswer
  - Fix: Provide Tier‑2 question and options RA..RD with RAnswer = A|B|C|D.
- [E-2T-RANSWER-EMPTY] RAnswer points to empty RA/RB/RC/RD
  - Fix: Ensure the referenced Tier‑2 option has text.

---

## Fill in the Blank

- [E-FILL-MISSING-PROMPT] Missing Prompt/Question/Title
  - Fix: Provide text in Prompt (or Question/Title) with [[n]] placeholders.
- [E-FILL-MISSING-ANSWERS] Missing Answer/Answer1
  - Fix: Provide Answer for one blank, or Answer1..AnswerN for multiple blanks.
- [E-FILL-NO-PLACEHOLDERS] Fill in the Blank prompt must contain [[n]] placeholders
  - Fix: Add [[1]] (and [[2]], etc.) to the prompt matching your Answer columns.
- [E-FILL-PLACEHOLDER-RANGE] Prompt must include [[n]] placeholders up to [[N]]
  - Fix: Ensure prompt includes placeholders up to the highest numbered Answer column.

---

## Sorting

- [E-SORT-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario
- [E-SORT-MISSING-CATEGORIES] Missing Categories
- [E-SORT-MISSING-ITEMS] Missing Items
  - Fix: Provide a prompt, pipe‑delimited Categories, and Items.
- [E-SORT-ITEM-FORMAT] Sorting item "term:category" required
  - Fix: Each Items entry must be formatted as term:category (pipe‑delimited between entries).

---

## Sequencing

- [E-SEQ-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario
- [E-SEQ-MISSING-STEPS] Sequencing requires Steps or Items
  - Fix: Provide pipe‑delimited Steps (or Items) with at least two steps.

---

## Short Answer

- [E-SHORT-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario
  - Fix: Provide card text in Question (or Title/Prompt/Scenario).

---

## Compare/Contrast

- [E-COMPARE-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario
- [E-COMPARE-MISSING-ITEMA] Missing ItemA/A
- [E-COMPARE-MISSING-ITEMB] Missing ItemB/B
- [E-COMPARE-MISSING-POINTS] Missing Points
  - Fix: Provide a prompt, ItemA and ItemB, and pipe‑delimited Points.
- [E-COMPARE-POINT-FORMAT] Point must be "feature::a::b"
  - Fix: Each point is feature::a::b and points are pipe‑delimited.

---

## CER (Claim–Evidence–Reasoning)

- [E-CER-MISSING-QUESTION] Missing Title/Question/Prompt/Scenario
  - Fix: Provide a prompt (Scenario/Prompt preferred; Question is allowed).
- [E-CER-CLAIM-OPTIONS-REQUIRED] ClaimOptions required for CER MC
- [E-CER-CLAIM-CORRECT-RANGE] ClaimCorrect must be 1..N
- [E-CER-EVIDENCE-OPTIONS-REQUIRED] EvidenceOptions required for CER MC
- [E-CER-EVIDENCE-CORRECT-RANGE] EvidenceCorrect must be 1..N
- [E-CER-REASONING-OPTIONS-REQUIRED] ReasoningOptions required for CER MC
- [E-CER-REASONING-CORRECT-RANGE] ReasoningCorrect must be 1..N
  - Fix: For Multiple Choice mode, provide Options for each part and a 1‑based Correct index.

---

Tips:
- Use exact column names from the CSV guide. Unknown columns are ignored.
- Keep values pipe‑delimited for lists (Categories, Items, Steps, Options, Points).
- When in doubt, see the CSV import guide at /docs/csv-import.
