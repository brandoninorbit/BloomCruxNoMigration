0) Global rules

Header row required.

CardType required. Accepted:

Standard MCQ, Short Answer, Fill in the Blank, Sorting, Sequencing, Compare/Contrast, Two‑Tier MCQ, CER

Aliases: MCQ, Short, Fill, Compare, TwoTierMCQ, CER

Title goes in exactly one of: Question | Prompt | Scenario | Title.

Optional on any row: BloomLevel (Remember|Understand|Apply|Analyze|Evaluate|Create) and Explanation.

No heuristics. If a type needs a column, include it. Unknown columns are ignored.

Bloom defaults (if omitted):
MCQ/Fill → Remember · Short/Sorting/Sequencing → Understand · Compare/Contrast → Analyze · Two‑Tier → Evaluate · CER → Evaluate

No auto‑seeding of options anywhere. If you need a bank, include an Options column (see Fill).

1) Standard MCQ (Remember by default)

Required columns: Question, A, B, C, D, Answer
Allowed: Explanation, BloomLevel

A..D: plain option text. Labels like “A) …” are ok; importer strips them.

Answer: one of A|B|C|D (case‑insensitive).

Example

CardType,Question,A,B,C,D,Answer,Explanation,BloomLevel
Standard MCQ,Which base pair has 3 H-bonds?,A–T,A–U,G≡C,A=G,C,"G≡C has 3 H-bonds",Remember

2) Short Answer (Understand by default)

Required: Question, SuggestedAnswer
Allowed: Explanation, BloomLevel
Aliases: Suggested or Answer → SuggestedAnswer.

Example

CardType,Question,SuggestedAnswer,Explanation
Short Answer,Why is RNA less stable than DNA?,2′-OH promotes hydrolysis,The 2′ hydroxyl attacks the phosphodiester bond.

3) Fill in the Blank (Remember by default)

One blank:
Required: Prompt, Answer

Multiple blanks:
Required: Prompt, Answer1..AnswerN (N up to 20), and the prompt must contain [[1]]..[[N]]
Optional (row‑level): Mode = Free Text | Drag & Drop | Either (default = Free Text)
Optional: Options (pipe list word bank), CaseSensitive, IgnorePunct (1/true/yes/y)
Optional per blank: Answer{n}Alt (pipe list), Blank{n}Mode, Blank{n}CaseSensitive, Blank{n}IgnorePunct
Allowed: Explanation, BloomLevel

Note: No auto‑seeding. If you want Drag & Drop, include Options or set Mode and include answers/alternates; the importer will not guess.

Example (multi‑blank, DnD):

CardType,Prompt,Mode,Answer1,Answer2,Options,BloomLevel,Explanation
Fill in the Blank,"Proteins are made of [[1]] units linked by [[2]] bonds.","Drag & Drop",amino acid,peptide,"amino acid|nucleotide|peptide|hydrogen",Understand,"Monomer + linkage"

4) Sorting (Understand by default)

Required: Title (or Question/Prompt/Scenario), Categories, Items

Categories: pipe list, e.g. Polymers|Monomers

Items: pipe list of term:category, e.g. Protein:Polymers|Amino acid:Monomers

Allowed: Explanation, BloomLevel

Importer safeguard: If all/most categories are single letters (e.g., a word split like B|r|o|a|d), the importer will gently flag those rows. In the UI you can choose to exclude flagged rows from import, cancel the import, or proceed anyway.

Example

CardType,Title,Categories,Items,Explanation
Sorting,Sort these examples,"Covalent|Noncovalent","Peptide bond:Covalent|Hydrogen bond:Noncovalent|Disulfide:Covalent","Bonds by interaction"

5) Sequencing (Apply by default)

Required: Prompt, Steps (or Items) as a pipe list in correct order.
Allowed: Explanation, BloomLevel

Important guidance
- Avoid including explicit numbers, dates, or ordinals in step text that give away the correct order. For example, avoid steps like "Stock market crash 1929" or "Great Depression 1929–1939" or prefixed markers like "1.", "2.", "First", "Second". These reveal the answer and defeat the purpose of sequencing practice. Prefer neutral phrasing (e.g., "Stock market crash", "Great Depression period").

Example

CardType,Prompt,Steps,Explanation
Sequencing,Order the hierarchy of protein structure,"Primary|Secondary|Tertiary|Quaternary","Conventional order"

6) Compare/Contrast (Analyze by default)

Required: ItemA (or A), ItemB (or B), Points

Points = pipe list of feature::a_side::b_side

Allowed: Title/Prompt/Scenario, Explanation, BloomLevel

Example

CardType,Title,ItemA,ItemB,Points,Explanation
Compare/Contrast,DNA vs RNA,"DNA","RNA","Sugar::deoxyribose::ribose|Strands::double::single|2' group::H::OH","RNA 2'-OH reduces stability"

7) Two‑Tier MCQ (Evaluate by default)

Tier 1 — Required: Question, A, B, C, D, Answer
Tier 2 — Required: RQuestion (or ReasoningQuestion), RA, RB, RC, RD, RAnswer
Allowed: Explanation, BloomLevel

Keep tiers separate. Tier‑1 options never substitute for Tier‑2 fields.

Example

CardType,Question,A,B,C,D,Answer,RQuestion,RA,RB,RC,RD,RAnswer,Explanation
Two-Tier MCQ,Increasing GC raises Tm because…,Heavier,Three H-bonds,Excludes water,UV absorb,B,Why specifically?,More H-bonds per pair,Bases stack better,Hydrophobic core,GC absorbs more UV,A,"GC has three H-bonds"

8) CER — Claim–Evidence–Reasoning (Evaluate by default)

Required: Mode = Free Text | Multiple Choice (aliases: MC, Multiple)
Guidance optional: Guidance (or GuidanceQuestion)

Prompt selection for CER:
- If Scenario or Prompt is present, that value is used as the card prompt.
- The Question cell is treated as a guidance question when Scenario/Prompt exists (unless Guidance/GuidanceQuestion is explicitly provided).
- If Scenario/Prompt is absent, Question becomes the card prompt.

If Free Text → Required: Claim, Evidence, Reasoning (sample answers)

If Multiple Choice → Required:

ClaimOptions, ClaimCorrect (1‑based index)

EvidenceOptions, EvidenceCorrect

ReasoningOptions, ReasoningCorrect

Allowed: Scenario and/or Question, BloomLevel, Explanation

Example (Free Text)

CardType,Scenario,Question,Mode,Claim,Evidence,Reasoning,Guidance
CER,"Stem-loops observed in 5′ UTR","Predict effect on translation","Free Text","Reduced translation","Impedes scanning/initiation","Secondary structure blocks ribosome scanning","Use C-E-R"


Example (Multiple Choice)

CardType,Scenario,Question,Mode,ClaimOptions,ClaimCorrect,EvidenceOptions,EvidenceCorrect,ReasoningOptions,ReasoningCorrect
CER,"Disulfide bonds disrupted","Effect on quaternary structure?","Multiple Choice","Loses quaternary|No change|Gains tertiary",1,"SDS-PAGE shift|No oligomers|Extra helices",2,"Disulfides stabilize interfaces|Hydrophobic core grows|H-bonds increase",1

9) Common error -> fix map (what your importer’s errors mean)

“missing A; missing B” → You’re creating MCQ or Two‑Tier rows without A,B,C,D. Add them + Answer.

“missing Items (Sorting)” → Include Items as term:category|… (and Categories).

“missing Title/Question/Prompt/Scenario” (Compare/Contrast) → Add one title column + ItemA, ItemB, Points.

“Sequencing requires Steps or Items” → Add Steps (pipe list) or Items (pipe list).

“Tier‑2 missing …” → Add RQuestion, RA..RD, RAnswer (Two‑Tier).

Fill blank answers missing → For multiple blanks, ensure [[1]]..[[N]] appear in Prompt and Answer1..N exist.

10) LLM prompt preamble (paste this before asking an LLM to generate a deck)
STRICT CSV CONTRACT (BloomCrux Importer)
- Every row must include a header field CardType and one of Title|Question|Prompt|Scenario.
- MCQ: require A,B,C,D and Answer (A|B|C|D). No “Options” column.
- Two-Tier MCQ: require A..D, Answer, and RQuestion, RA..RD, RAnswer.
- Sorting: require Categories (pipe) AND Items (pipe of term:category).
- Sequencing: require Steps (pipe list) or Items (pipe list).
- Compare/Contrast: require ItemA, ItemB, Points (pipe of feature::a::b).
- Fill in the Blank: one blank uses Answer; multiple blanks use Answer1..N and Prompt must contain [[1]]..[[N]]; Options is a pipe list if Drag & Drop.
- CER Free Text: Mode="Free Text" with Claim, Evidence, Reasoning samples.
- CER Multiple Choice: Mode="Multiple Choice" with ...Options (pipe) and ...Correct (1-based).
- BloomLevel and Explanation are optional. Unknown columns are ignored.
Generate only rows that fully satisfy the above; otherwise omit the row.

11) Mini checklists you can keep next to your CSV editor

MCQ / Two‑Tier: Do I see A,B,C,D,Answer (and Tier‑2 fields for Two‑Tier)?

Sorting: Do I see both Categories and Items with term:category pairs?

Sequencing: Does Steps exist with a pipe list?

Compare/Contrast: Do I have ItemA, ItemB, and Points using feature::a::b?

Fill: For 2+ blanks, does the prompt have [[n]] and Answer1..n?

CER: Is Mode correct, and are the required fields present for that mode?