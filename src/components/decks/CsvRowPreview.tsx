"use client";

import React, { useMemo } from "react";
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
    const byCode = code === 'W-ENCODING-SMART-QUOTES' && hasSmartQuotesOrNbsp(text);
    const byKey = highlightKeys.some((k) => k.toLowerCase() === key.toLowerCase());
    return { key, text, highlight: byKey || byCode };
  });

  return (
    <div className="text-xs">
      <div className="text-gray-700 mb-2">Parsed row (key → value)</div>
      <div className="grid grid-cols-1 gap-1 pr-1">
        {list.map(({ key, text, highlight }) => (
          <div key={key} className={`flex items-start gap-2 p-2 rounded border ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className="min-w-[160px] font-mono text-gray-700 break-all">{key}</div>
            <div className="flex-1 whitespace-pre-wrap break-words">{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
