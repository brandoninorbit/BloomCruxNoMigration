"use client";
// src/app/plasmic-host/page.tsx
import { PlasmicCanvasHost, registerComponent, type CodeComponentMeta } from "@plasmicapp/host";
import { MasteryPill, type BloomLevel } from "../../components/decks/MasteryPill";
import DeckCardShell, { type DeckCardShellProps } from "../../components/decks/DeckCardShell";

// Strongly-typed metas. We include importPath to satisfy the non-loader overload.
const masteryPillMeta: CodeComponentMeta<{ level: BloomLevel; percent?: number; className?: string }> = {
  name: "MasteryPill",
  importPath: "../../components/decks/MasteryPill",
  props: {
    level: {
      type: "choice",
      options: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
      defaultValue: "Remember",
    },
    percent: { type: "number", defaultValue: 0 },
    className: "string",
  },
};

const deckCardShellMeta: CodeComponentMeta<DeckCardShellProps> = {
  name: "DeckCardShell",
  importPath: "../../components/decks/DeckCardShell",
  props: {
    title: { type: "string", defaultValue: "Untitled Deck" },
    cover: { type: "slot" },
  titleBelow: { type: "slot" },
    children: { type: "slot" },
    footer: { type: "slot" },
    onClick: { type: "eventHandler", argTypes: [] },
    className: "string",
  },
};

// Use generic parameter so TS matches props shape and doesn't fall back to the "loader" signature.
registerComponent(MasteryPill, masteryPillMeta);
registerComponent(DeckCardShell, deckCardShellMeta);


export default function PlasmicHostPage() {
  return <PlasmicCanvasHost />;
}
