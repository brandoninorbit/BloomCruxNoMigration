// src/components/decks/DeckCardShell.tsx
"use client";
import * as React from "react";
import type { BloomLevel as MasteryBloomLevel } from "./MasteryPill";
import chroma from 'chroma-js';

export type DeckCardShellProps = {
  title: string;
  onClick?: () => void;
  cover?: React.ReactNode;
  /** Optional content displayed just below the title band at the top of the card. */
  titleBelow?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Optional: lets callers tag the shell with a Bloom level (used for styling/analytics). */
  level?: MasteryBloomLevel;
  /** Optional folder name to display below the title */
  folderName?: string;
  /** Optional mastery pill to display below the blurred element */
  masteryPill?: React.ReactNode;
  /** Optional description to show in hover modal */
  description?: string;
};

export function DeckCardShell({
  title,
  onClick,
  cover,
  titleBelow,
  footer,
  className,
  level,
  folderName,
  masteryPill,
  description,
}: DeckCardShellProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [textColor, setTextColor] = React.useState('text-gray-800');

  // Calculate optimal text color based on background
  React.useEffect(() => {
    if (isHovered && cardRef.current && description) {
      try {
        const cardElement = cardRef.current;
        const computedStyle = window.getComputedStyle(cardElement);
        const backgroundColor = computedStyle.backgroundColor;
        
        // If background is transparent or not set, try to get from parent or use default
        let bgColor = backgroundColor;
        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
          // Try to get background from the card's article element
          const article = cardElement.querySelector('article');
          if (article) {
            bgColor = window.getComputedStyle(article).backgroundColor;
          }
        }
        
        // Default fallback
        if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
          bgColor = 'rgba(255, 255, 255, 0.9)'; // Default white background
        }
        
        // Use chroma-js to calculate contrast
        const bgChroma = chroma(bgColor);
        const whiteContrast = chroma.contrast(bgChroma, 'white');
        const blackContrast = chroma.contrast(bgChroma, 'black');
        
        // Use white text if it has better contrast, otherwise black
        setTextColor(whiteContrast > blackContrast ? 'text-white' : 'text-gray-800');
      } catch {
        // Fallback to default
        setTextColor('text-gray-800');
      }
    }
  }, [isHovered, description]);

  return (
    <div
      ref={cardRef}
      className={"group [perspective:1000px] cursor-pointer relative " + (className ?? "")}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-level={level}
    >
      {/* Hover Modal */}
      {description && isHovered && (
        <div className={`absolute top-0 left-0 right-0 z-50 w-full h-auto bg-white/20 backdrop-blur-xl rounded-lg shadow-xl border border-white/30 px-3 pt-3 pb-5 text-sm overflow-hidden transform -translate-y-full -mt-6 ${textColor}`}>
          <p className="overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{description}</p>
        </div>
      )}

      <article className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-[var(--shadow-soft)] bg-white/90 dark:bg-neutral-900/80 transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-2 [transform-style:preserve-3d] group-hover:[transform:rotateY(3deg)]">
        {/* COVER layer (fills and is clipped by parent) */}
        {cover}

        {/* TITLE band + optional slot underneath */}
        <div className="absolute top-3 left-3 right-3">
          <div className="inline-block bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm px-3 py-2 rounded-md w-full">
            {/* Title */}
            <div className="text-[15px] font-bold text-[#111418] line-clamp-2 pr-1 text-center">{title}</div>
            {/* Folder name below, if provided */}
            {folderName && (
              <div className="mt-1 text-center">
                <div className={`${(() => {
                  // Dynamic font size based on folder name length
                  if (folderName.length <= 8) return "text-[13px]";
                  if (folderName.length <= 12) return "text-xs";
                  if (folderName.length <= 16) return "text-[11px]";
                  if (folderName.length <= 20) return "text-[10px]";
                  return "text-[9px]"; // minimum font size
                })()} text-[#111418] whitespace-nowrap overflow-hidden text-ellipsis max-w-full`}>
                  {folderName}
                </div>
              </div>
            )}
            {/* Additional content below, if provided */}
            {titleBelow && (
              <div className="mt-1 text-center">
                {titleBelow}
              </div>
            )}
          </div>
          {/* Mastery pill positioned below the blurred element with fixed gap */}
          {masteryPill && <div className="mt-2">{masteryPill}</div>}
        </div>

        {/* SLOT area (pills/stats/actions supplied by caller) */}
        <div className="absolute inset-x-3 bottom-3 space-y-2">
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
      </article>
    </div>
  );
}

export default DeckCardShell;
