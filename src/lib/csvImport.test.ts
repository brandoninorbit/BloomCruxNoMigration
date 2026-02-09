// src/lib/csvImport.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { rowToPayload, parseCsv } from "./csvImport";

const row = (r: any) => r;

describe("CSV importer – strict mapping", () => {
  test("MCQ: label stripping + correct letter map", () => {
    const r = row({
      CardType: "Standard MCQ",
      Question: "Which base pair has 3 H-bonds?",
      A: "A) A–T",
      B: "B) G≡C",
      C: "C) A–U",
      D: "D) C–U",
      Answer: "b",
      Explanation: "G≡C has three H-bonds",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("mcq");
    expect(p.meta.options).toEqual({
      A: "A–T",
      B: "G≡C",
      C: "A–U",
      D: "C–U",
    });
    expect(p.meta.answer).toBe("B");
    expect(p.explanation).toMatch(/three H-bonds/i);
  });

  test("Two‑Tier MCQ: RA..RD positional + RAnswer letter", () => {
    const r = row({
      CardType: "Two-Tier MCQ",
      Question: "Increasing GC raises Tm because…",
      A: "A) G–C pairs exclude water better",
      B: "B) G–C pairs form three H-bonds",
      C: "C) G–C pairs are heavier",
      D: "D) G–C pairs are rarer",
      Answer: "B",
      RQuestion: "Why specifically?",
      RA: "A) Because of triple H-bonds",
      RB: "B) Because of higher mass",
      RC: "C) Because of UV absorbance",
      RD: "D) Because of sodium ions",
      RAnswer: "A",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("twoTier");
    expect(p.meta.tier1.answer).toBe("B");
    expect(p.meta.tier2.question).toBe("Why specifically?");
    expect(p.meta.tier2.options).toEqual({
      A: "Because of triple H-bonds",
      B: "Because of higher mass",
      C: "Because of UV absorbance",
      D: "Because of sodium ions",
    });
    expect(p.meta.tier2.answer).toBe("A");
  });

  test("Fill multi‑blank: Answer1..N → [[n]]", () => {
    const r = row({
      CardType: "Fill in the Blank",
      Prompt: "Proteins are made of [[1]] units linked by [[2]] bonds.",
      Mode: "Drag & Drop",
      Answer1: "amino acid",
      Answer2: "peptide",
      Options: "amino acid|nucleotide|peptide|hydrogen",
      Explanation: "Peptide bonds link amino acids",
      BloomLevel: "Understand",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("fill");
    expect(p.meta.mode).toBe("Drag & Drop");
    expect(p.meta.answers).toEqual(["amino acid", "peptide"]);
    expect(p.meta.options).toEqual([
      "amino acid",
      "nucleotide",
      "peptide",
      "hydrogen",
    ]);
    expect(p.bloom).toBe("Understand");
  });

  test("Short Answer: SuggestedAnswer + separate Explanation", () => {
    const r = row({
      CardType: "Short Answer",
      Question: "Why is RNA more prone to degradation than DNA?",
      SuggestedAnswer:
        "2′‑OH on ribose makes RNA susceptible to base‑catalyzed hydrolysis",
      BloomLevel: "Understand",
      Explanation:
        "2′‑OH attacks the phosphodiester backbone under basic conditions",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("short");
    expect(p.meta.suggestedAnswer).toMatch(/2′‑?OH/i);
    expect(p.explanation).toMatch(/phosphodiester/i);
  });

  test("Sorting: Categories vs Items orientation", () => {
    const r = row({
      CardType: "Sorting",
      Question: "Sort these molecules by type",
      Categories: "Polymers|Monomers",
      Items: "Amino acids:Monomers|DNA:Polymers",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("sorting");
    expect(p.meta.categories).toEqual(["Polymers", "Monomers"]);
    expect(p.meta.items).toEqual([
      { term: "Amino acids", category: "Monomers" },
      { term: "DNA", category: "Polymers" },
    ]);
  });

  test("Sequencing: Steps pipe list", () => {
    const r = row({
      CardType: "Sequencing",
      Prompt: "Hierarchy of protein structure",
      Steps: "Primary|Secondary|Tertiary|Quaternary",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("sequencing");
    expect(p.meta.steps).toEqual([
      "Primary",
      "Secondary",
      "Tertiary",
      "Quaternary",
    ]);
  });

  test("Compare/Contrast: feature::a::b", () => {
    const r = row({
      CardType: "Compare/Contrast",
      Question: "DNA vs RNA",
      ItemA: "DNA",
      ItemB: "RNA",
      Points: "Sugar::deoxyribose::ribose|Strands::double::single",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("compare");
    expect(p.meta.itemA).toBe("DNA");
    expect(p.meta.points[0]).toEqual({
      feature: "Sugar",
      a: "deoxyribose",
      b: "ribose",
    });
  });

  test("CER Free Text", () => {
    const r = row({
      CardType: "CER",
      // With only Question (no Scenario), it becomes the prompt
      Question: "Stem‑loops in 5′ UTR affect translation?",
      Guidance: "Consider ribosome scanning",
      Mode: "Free Text",
      Claim: "Reduced translation",
      Evidence: "Hairpin impedes scanning",
      Reasoning: "Secondary structure blocks initiation",
    });
  const p: any = rowToPayload(r);
    expect(p.type).toBe("cer");
    expect(p.meta.mode).toBe("Free Text");
    expect(p.meta.claim.sampleAnswer).toMatch(/Reduced/);
  });

  test("CER uses Scenario/Prompt as question and Question as guidance when Scenario present", () => {
    const r = row({
      CardType: "CER",
      Scenario:
        "A researcher observes that mRNA with long secondary structures in the 5′ UTR has reduced translation efficiency.",
      Question: "Predict the effect of these structures.",
      Mode: "Free Text",
      Claim: "Reduced translation",
      Evidence: "Ribosome scanning is slowed or blocked",
      Reasoning: "Secondary structures in the 5′ UTR impede ribosome initiation",
    });
    const p: any = rowToPayload(r);
    expect(p.type).toBe("cer");
    // Prompt should be Scenario, not the Question
    expect(p.question).toBe(
      "A researcher observes that mRNA with long secondary structures in the 5′ UTR has reduced translation efficiency."
    );
    // Guidance should fall back to Question when explicit Guidance is absent
    expect(p.meta.guidance).toBe("Predict the effect of these structures.");
  });

  test("Sorting: one-letter categories are gently flagged", () => {
    const csv = [
      'CardType,Question,Categories,Items',
      'Sorting,"Sort the term correctly.",B|r|o|a|d,Term:B'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    expect(okRows[0]?.flagged).toBe(true);
    expect((rowWarnings?.[0]?.warnings?.[0] || "")).toMatch(/single letters/i);
  });

  test("MCQ: multi-letter answer produces non-blocking warning", () => {
    const csv = [
      'CardType,Question,A,B,C,D,Answer',
      'Standard MCQ,"Pick letters",One,Two,Three,Four,AB'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-MCQ-MULTI-ANS/);
  });

  test("Sequencing: duplicate steps warning", () => {
    const csv = [
      'CardType,Prompt,Steps',
      'Sequencing,"Do these",A|B|A|C'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-SEQ-DUP-STEP/);
  });

  test("Fill: placeholder mismatch warns, non-blocking", () => {
    const csv = [
      'CardType,Prompt,Answer1,Answer2',
      'Fill in the Blank,"Text with [[1]] and [[2]] and [[3]]",A,B'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-FILL-PLACEHOLDER-MISMATCH/);
  });

  test("Compare: duplicate feature keys warns, non-blocking", () => {
    const csv = [
      'CardType,Question,ItemA,ItemB,Points',
      'Compare/Contrast,"DNA vs RNA",DNA,RNA,"Sugar::deoxyribose::ribose|Sugar::2\' deoxy::ribose"'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-COMPARE-KEY-DUP/);
  });
});

// ---------- Keyed Payload Mode Tests ----------
describe("CSV importer – Keyed Payload Mode", () => {
  test("Payload mode: MCQ with basic keys", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((Standard MCQ)) Question((What is X?)) A((Option A)) B((Option B)) C((Option C)) D((Option D)) Answer((B))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("mcq");
    expect(p.question).toBe("What is X?");
    expect(p.meta.answer).toBe("B");
  });

  test("Payload mode: MCQ with commas inside values", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((Standard MCQ)) Question((What is 1, 2, 3?)) A((Apple, or orange)) B((Banana, or pear)) C((Cherry, or plum)) D((Date, or fig)) Answer((A))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toMatch(/1, 2, 3/);
    expect(p.meta.options.A).toMatch(/Apple, or orange/);
  });

  test("Payload mode: escaped \\)) inside values", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((Standard MCQ)) Question((What is \\)) in regex?)) A((Opens paren: \\()) B((Closes paren: \\))) C((Both: \\(\\))) D((None)) Answer((B))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toContain(") in regex");
    expect(p.meta.options.B).toContain(")");
  });

  test("Payload mode: duplicate keys warning – last value wins", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)) Question((First?)) Question((Second?)) A((A)) B((B)) C((C)) D((D)) Answer((A))"'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("Second?");
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-PAYLOAD-DUPLICATE-KEY/);
    expect(warnings).toMatch(/Question/);
  });

  test("Payload mode: unknown keys warning", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)) Question((What?)) A((A)) B((B)) C((C)) D((D)) Answer((A)) UnknownKey((value))"'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/W-PAYLOAD-UNKNOWN-KEY/);
    expect(warnings).toMatch(/UnknownKey/);
  });

  test("Payload mode: case-insensitive key matching with canonical output", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"cardtype((mcq)) question((What?)) a((Option 1)) b((Option 2)) c((Option 3)) d((Option 4)) answer((c))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("What?");
    expect(p.meta.answer).toBe("C");
  });

  test("Payload mode: whitespace tolerance around delimiter", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType (( MCQ ))   Question    ((What?))   ,   A((Option A))  ;  B((Option B)) , C((Option C)); D((Option D)) Answer (( A ))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("What?");
    expect(p.meta.answer).toBe("A");
  });

  test("Payload mode: Sorting with Categories and Items", () => {
    const csv = [
      'CardType,Payload',
      'Sorting,"CardType((Sorting)) Question((Sort biology terms)) Categories((Molecule|Organism)) Items((ATP:Molecule|Tiger:Organism))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("sorting");
    expect(p.meta.categories).toEqual(["Molecule", "Organism"]);
  });

  test("Payload mode: Sequencing with Steps", () => {
    const csv = [
      'CardType,Payload',
      'Sequencing,"CardType((Sequencing)) Prompt((Order these steps)) Steps((First|Second|Third))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("sequencing");
    expect(p.meta.steps).toEqual(["First", "Second", "Third"]);
  });

  test("Payload mode: BloomLevel handling in Payload", () => {
    const csv = [
      'CardType,Payload',
      'Short Answer,"CardType((Short Answer)) Question((Why?)) BloomLevel((Apply))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.bloom).toBe("Apply");
  });

  test("Payload mode: Explanation key in Payload", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)) Question((What?)) A((A)) B((B)) C((C)) D((D)) Answer((A)) Explanation((This is the answer))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.explanation).toBe("This is the answer");
  });

  test("Payload mode: payload field takes precedence over column", () => {
    const csv = [
      'CardType,Question,Payload',
      'Standard MCQ,"Column Question","Question((Payload Question)) A((A)) B((B)) C((C)) D((D)) Answer((A))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("Payload Question");
  });

  test("Backward compatibility: CSV without Payload column still works", () => {
    const csv = [
      'CardType,Question,A,B,C,D,Answer',
      'Standard MCQ,"What is X?",One,Two,Three,Four,A'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("mcq");
    expect(p.question).toBe("What is X?");
    expect(p.meta.answer).toBe("A");
  });

  test("Backward compatibility: existing ComplexMCQ import still works", () => {
    const csv = [
      'CardType,Question,A,B,C,D,Answer,Explanation,BloomLevel',
      'Standard MCQ,"Which base pair has 3 H-bonds?","A) A–T","B) G≡C","C) A–U","D) C–U",B,"G≡C has three H-bonds",Remember'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.explanation).toMatch(/H-bonds/);
  });

  test("Payload mode: Two-Tier MCQ with all required fields", () => {
    const csv = [
      'CardType,Payload',
      'Two-Tier MCQ,"CardType((Two-Tier MCQ)) Question((Base pairs?)) A((A-T)) B((G-C)) C((A-U)) D((C-U)) Answer((B)) RQuestion((H-bonds?)) RA((3)) RB((2)) RC((1)) RD((0)) RAnswer((A))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("twoTier");
    expect(p.meta.tier1.answer).toBe("B");
    expect(p.meta.tier2.answer).toBe("A");
  });

  test("Payload mode: CER with mode and parts", () => {
    const csv = [
      'CardType,Payload',
      'CER,"CardType((CER)) Question((Explain why)) Mode((Free Text)) Claim((Because)) Evidence((Evidence here)) Reasoning((Therefore))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("cer");
    expect(p.meta.mode).toBe("Free Text");
  });

  test("Payload mode: Compare/Contrast with Points", () => {
    const csv = [
      'CardType,Payload',
      'Compare/Contrast,"CardType((Compare)) Question((DNA vs RNA)) ItemA((DNA)) ItemB((RNA)) Points((Sugar::deoxyribose::ribose|Strands::double::single))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.type).toBe("compare");
    expect(p.meta.itemA).toBe("DNA");
    expect(p.meta.points).toHaveLength(2);
  });

  test("Payload mode: empty Payload falls back to columns", () => {
    const csv = [
      'CardType,Payload,Question,A,B,C,D,Answer',
      'Standard MCQ,"",What?,One,Two,Three,Four,A'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("What?");
  });

  test("Payload mode: nested parens with escaping", () => {
    const r = row({
      CardType: "Standard MCQ",
      Payload: "CardType((MCQ)) Question((What is \\(a\\) or \\(b\\)?)) A((Option \\(A\\))) B((Option \\(B\\))) C((Option \\(C\\))) D((Option \\(D\\))) Answer((A))"
    });
    const p: any = rowToPayload(r);
    expect(p.type).toBe("mcq");
    expect(p.question).toMatch(/\(a\).*\(b\)/);
    expect(p.meta.options.A).toMatch(/\(A\)/);
  });

  test("Payload mode: multiple warnings collected", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)) unknownkey1((val1)) Question((Q?)) A((A)) unknownkey2((val2)) B((B)) C((C)) D((D)) Answer((A))"'
    ].join("\n");
    const { okRows, badRows, rowWarnings } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const warnings = (rowWarnings.find(rw => rw.index === 2)?.warnings || []).join(' ');
    expect(warnings).toMatch(/unknownkey1/);
    expect(warnings).toMatch(/unknownkey2/);
  });

  test("Payload mode: comma and semicolon delimiters between keys", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)), Question((What?)) ; A((A)), B((B)) ; C((C)), D((D)) Answer((A))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(badRows.length).toBe(0);
    expect(okRows.length).toBe(1);
    const p: any = okRows[0]?.payload;
    expect(p.question).toBe("What?");
  });

  test("Payload mode: validation still applies (missing required field)", () => {
    const csv = [
      'CardType,Payload',
      'Standard MCQ,"CardType((MCQ)) Question((What)) A((A)) B((B)) C((C))"'
    ].join("\n");
    const { okRows, badRows } = parseCsv(csv);
    expect(okRows.length).toBe(0);
    expect(badRows.length).toBe(1);
    expect(badRows[0]?.errors[0]).toMatch(/E-MCQ-MISSING-D|E-MCQ-MISSING-ANSWER/);
  });
});

// ---------- Direct payload integration tests ----------
describe("Payload mode - Additional integration tests", () => {
  test("Payload with all fields overrides columns", () => {
    // Test that Payload column values completely override regular columns
    const r = row({
      CardType: "Standard MCQ",
      Question: "Wrong question",
      Payload: `CardType((Standard MCQ)) Question((Right question?)) A((A)) B((B)) C((C)) D((D)) Answer((B))`
    });
    const p: any = rowToPayload(r);
    expect(p.question).toBe("Right question?");
  });

  test("Empty Payload with columns works", () => {
    // Test backward compatibility when Payload is empty
    const r = row({
      CardType: "Standard MCQ",
      Question: "Test?",
      Payload: "", // Empty payload
      A: "Opt A",
      B: "Opt B",
      C: "Opt C",
      D: "Opt D",
      Answer: "A"
    });
    const p: any = rowToPayload(r);
    expect(p.question).toBe("Test?");
    expect(p.type).toBe("mcq");
  });

  test("Payload mode: Sorting type detection", () => {
    const r = row({
      CardType: "Sorting",
      Payload: `CardType((Sorting)) Question((Sort!)) Categories((Cat1|Cat2)) Items((Item1:Cat1|Item2:Cat2))`
    });
    const p: any = rowToPayload(r);
    expect(p.type).toBe("sorting");
  });
});

