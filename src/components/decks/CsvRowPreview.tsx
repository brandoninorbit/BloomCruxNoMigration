"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";

type Props = {
  csvText: string;
  rowIndex: number; // 1-based row number (2 == first data row)
  highlightKeys?: string[]; // column names to highlight
  code?: string; // warning code for dynamic highlighting (e.g., smart quotes)
};

function hasSmartQuotesOrNbsp(s?: string): boolean {
  if (!s) return false;
  return /[\u2018\u2019\u201C\u201D\u00A0]/.test(s);
}

// Highlight helper: wrap offending characters (like wrong delimiters or smart quotes)
function highlightOffenders(text: string, code?: string): { __html: string } {
  let html = text;
  // Smart quotes/non-breaking spaces
  if (code === 'W-ENCODING-SMART-QUOTES') {
    html = html.replace(/[\u2018\u2019\u201C\u201D\u00A0]/g, (m) => `<mark style="background: rgba(244,63,94,0.15); color:#b91c1c;">${m}</mark>`);
  }
  // Wrong delimiter heuristics
  if (/W-(FILL|SORT|SEQ)-WRONG-DELIM/.test(code || '') || /W-SORT-ITEMS-WRONG-DELIM/.test(code || '') || /W-COMPARE-WRONG-DELIM/.test(code || '')) {
    html = html.replace(/[;,]/g, (m) => `<mark style="background: rgba(244,63,94,0.15); color:#b91c1c;">${m}</mark>`);
    // Also highlight forward slash if present in option-like fields
    html = html.replace(/[\/]/g, (m) => `<mark style="background: rgba(244,63,94,0.15); color:#b91c1c;">${m}</mark>`);
  }
  // For compare point format errors, highlight single ':' not part of '::'
  if (code === 'E-COMPARE-POINT-FORMAT') {
    html = html.replace(/(^|[^:]):([^:])/g, (m) => `<mark style="background: rgba(244,63,94,0.15); color:#b91c1c;">${m}</mark>`);
  }
  return { __html: html };
}

export default function CsvRowPreview({ csvText, rowIndex, highlightKeys = [], code }: Props) {
  const parsed = useMemo(() => Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true }), [csvText]);
  const fields: string[] = (parsed.meta.fields as string[]) || [];
  const data = (parsed.data || []) as Array<Record<string, string>>;
  const idx = Math.max(0, rowIndex - 2); // convert to 0-based data index
  const row = data[idx] || {};

  // Normalize known title/question keys and ensure they are displayed first if present
  const preferredKeys = [
    'Question', 'Prompt', 'Scenario',
    // Lowercase variants that may appear
    'question', 'prompt', 'scenario',
  ];
  // Build ordered keys: prefer known question keys first, then the rest (excluding duplicates)
  const allKeys = (fields.length ? fields : Object.keys(row));
  const seen = new Set<string>();
  const orderedKeys: string[] = [];
  for (const k of preferredKeys) {
    if (allKeys.includes(k)) {
      orderedKeys.push(k);
      seen.add(k);
    }
  }
  for (const k of allKeys) {
    if (!seen.has(k)) orderedKeys.push(k);
  }

  // Build display list of [key, value] with highlighting
  const list = orderedKeys.map((key) => {
    const val = (row as Record<string, unknown>)[key];
    const text = val == null ? "" : String(val);
    const byCode = (code === 'W-ENCODING-SMART-QUOTES' || code === 'E-ENCODING') && hasSmartQuotesOrNbsp(text);
    const byKey = highlightKeys.some((k) => k.toLowerCase() === key.toLowerCase());
    return { key, text, highlight: byKey || byCode };
  });

  // Refs for auto-scroll to first highlighted row
  const firstHitRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (firstHitRef.current) {
      firstHitRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [rowIndex, code, highlightKeys.join('|')]);

  return (
    <div className="text-xs">
      <div className="text-gray-700 mb-2">Parsed row (key → value)</div>
      <div className="grid grid-cols-1 gap-1 pr-1">
        {list.map(({ key, text, highlight }, idx) => (
          <div key={key} ref={highlight && !firstHitRef.current ? firstHitRef : null} className={`flex items-start gap-2 p-2 rounded border ${highlight ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200' : 'border-gray-200 bg-white'}`}>
            <div className="min-w-[160px] font-mono text-gray-700 break-all">{key}</div>
            <div className="flex-1 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={highlight ? highlightOffenders(text, code) : { __html: text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }} />
          </div>
        ))}
      </div>
    </div>
  );
}
