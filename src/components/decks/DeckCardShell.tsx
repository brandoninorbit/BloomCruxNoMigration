// src/components/decks/DeckCardShell.tsx
"use client";
import * as React from "react";
import type { BloomLevel as MasteryBloomLevel } from "./MasteryPill";

export type DeckCardShellProps = {
  title: string;
  onClick?: () => void;
  cover?: React.ReactNode;
  /** Optional content displayed just below the title band at the top of the card. */
  titleBelow?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Optional: lets callers tag the shell with a Bloom level (used for styling/analytics). */
  level?: MasteryBloomLevel;
};

export function DeckCardShell({
  title,
  onClick,
  cover,
  titleBelow,
  children,
  footer,
  className,
  level,
}: DeckCardShellProps) {
  return (
    <div
      className={"group [perspective:1000px] cursor-pointer " + (className ?? "")}
      onClick={onClick}
      data-level={level}
    >
      <article className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-[var(--shadow-soft)] bg-white/90 dark:bg-neutral-900/80 transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-2 [transform-style:preserve-3d] group-hover:[transform:rotateY(3deg)]">
        {/* COVER layer (fills and is clipped by parent) */}
        {cover}

        {/* TITLE band + optional slot underneath */}
        <div className="absolute top-3 left-3 right-3 space-y-2">
          <div className="inline-block bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm px-3 py-1 rounded-md">
            <span className="text-[15px] font-bold text-[#111418] line-clamp-2 pr-1">{title}</span>
          </div>
          {titleBelow ? <div className="flex justify-center">{titleBelow}</div> : null}
        </div>

        {/* SLOT area (pills/stats/actions supplied by caller) */}
        <div className="absolute inset-x-3 bottom-3 space-y-2">
          {children}
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
      </article>
    </div>
  );
}

export default DeckCardShell;
