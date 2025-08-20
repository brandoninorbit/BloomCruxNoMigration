// src/lib/csvImport.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { rowToPayload } from "./csvImport";

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
});
