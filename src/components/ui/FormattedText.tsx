"use client";
import React from "react";

// Lightweight inline markup formatter.
// Supports:
//  - Subscripts with underscore: H_2O, SO_{4}
//  - Superscripts with caret: x^2, a^{n}
//  - Greek letters by name: alpha, beta, ... (case-aware: Alpha => Α)
// Fractions are written in plain math order with existing chars, e.g. (a_C^c·a_D^d)/(a_A^a·a_B^b)
// Escaping and full markdown not supported (by design).

function toSubscriptNodes(seq: string, keyPrefix: string) {
  // Return a single <sub> node with the raw text content (no nested parsing yet)
  return <sub key={`${keyPrefix}-sub`}>{seq}</sub>;
}

function toSuperscriptNodes(seq: string, keyPrefix: string) {
  return <sup key={`${keyPrefix}-sup`}>{seq}</sup>;
}

const GREEK_MAP: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο",
  pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
};

function replaceGreekWords(s: string): Array<string | React.ReactNode> {
  // Replace standalone words like 'alpha' with α, being careful about word boundaries.
  // Preserve capitalization: Alpha -> Α, ALPHA -> Α (simple first-letter upper handling).
  const tokens: Array<string | React.ReactNode> = [];
  let idx = 0;
  const re = /\b([A-Za-z]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > idx) tokens.push(s.slice(idx, m.index));
    const word = m[1];
    const lower = word.toLowerCase();
    const greek = GREEK_MAP[lower];
    if (greek) {
      const isCapitalized = word[0] === word[0].toUpperCase();
      tokens.push(isCapitalized ? greek.toUpperCase() : greek);
    } else {
      tokens.push(word);
    }
    idx = m.index + word.length;
  }
  if (idx < s.length) tokens.push(s.slice(idx));
  return tokens;
}

export function formatInlineMarkup(input: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let textBuf = "";
  const flushText = () => {
    if (!textBuf) return;
    // Apply Greek-name replacement to the buffered plain text before emitting
    const greekNodes = replaceGreekWords(textBuf);
    greekNodes.forEach((n, j) => out.push(typeof n === 'string' ? n : React.cloneElement(n as React.ReactElement, { key: `g-${i}-${j}` })));
    textBuf = "";
  };
  while (i < input.length) {
    const ch = input[i];
    if (ch === "_") {
      // Attempt to parse subscript
      // Pattern 1: _{...}
      if (i + 1 < input.length && input[i + 1] === "{") {
        const start = i + 2;
        let j = start;
        let found = false;
        while (j < input.length) {
          if (input[j] === "}") { found = true; break; }
          j++;
        }
        if (found) {
          const content = input.slice(start, j);
          flushText();
          out.push(toSubscriptNodes(content, `${i}`));
          i = j + 1;
          continue;
        }
        // No closing brace; treat as literal underscore
      } else {
        // Pattern 2: _ + [a-zA-Z0-9+-]+ (at least one)
        let j = i + 1;
        while (j < input.length && /[0-9a-zA-Z+\-]/.test(input[j])) j++;
        if (j > i + 1) {
          const content = input.slice(i + 1, j);
          flushText();
          out.push(toSubscriptNodes(content, `${i}`));
          i = j;
          continue;
        }
      }
    } else if (ch === "^") {
      // Attempt to parse superscript
      // Pattern 1: ^{...}
      if (i + 1 < input.length && input[i + 1] === "{") {
        const start = i + 2;
        let j = start;
        let found = false;
        while (j < input.length) {
          if (input[j] === "}") { found = true; break; }
          j++;
        }
        if (found) {
          const content = input.slice(start, j);
          flushText();
          out.push(toSuperscriptNodes(content, `${i}`));
          i = j + 1;
          continue;
        }
      } else {
        // Pattern 2: ^ + [a-zA-Z0-9+\-]
        let j = i + 1;
        while (j < input.length && /[0-9a-zA-Z+\-]/.test(input[j])) j++;
        if (j > i + 1) {
          const content = input.slice(i + 1, j);
          flushText();
          out.push(toSuperscriptNodes(content, `${i}`));
          i = j;
          continue;
        }
      }
    }
    // Fallback: accumulate text
    textBuf += ch;
    i++;
  }
  if (textBuf) out.push(textBuf);
  return out;
}

export default function FormattedText({ text, className, enabled = true }: { text: string; className?: string; enabled?: boolean }) {
  if (!enabled) return <span className={className}>{text}</span>;
  return <span className={className}>{formatInlineMarkup(text)}</span>;
}
