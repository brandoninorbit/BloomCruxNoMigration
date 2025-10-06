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
  // Debug instrumentation (enable by setting window.__DECK_HOVER_DEBUG = true in console or NEXT_PUBLIC_DECK_HOVER_DEBUG=1)
  const debugRef = React.useRef<{ pre?: DOMRect; post?: DOMRect }>({});
  const isDebug = (typeof window !== 'undefined' && (window as any)?.__DECK_HOVER_DEBUG) || process.env.NEXT_PUBLIC_DECK_HOVER_DEBUG === '1';
  const [preTop, setPreTop] = React.useState<number | null>(null);
  const [delta, setDelta] = React.useState<number | null>(null);
  // Additional instrumentation for the transformed <article> itself (wrapper isn't transformed)
  const articlePreTopRef = React.useRef<number | null>(null);
  const [articleDelta, setArticleDelta] = React.useState<number | null>(null);

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
      className={"group [perspective:1000px] cursor-pointer relative will-change-transform " + (className ?? "")}
      onClick={onClick}
      onMouseEnter={() => {
        if (cardRef.current && isDebug) {
          const rect = cardRef.current.getBoundingClientRect();
            debugRef.current.pre = rect; setPreTop(rect.top);
          // Measure article separately (it's the element that actually gets transformed)
          const articleEl = cardRef.current.querySelector('article');
          if (articleEl) {
            const aRect = articleEl.getBoundingClientRect();
            articlePreTopRef.current = aRect.top;
          }
        }
        setIsHovered(true);
        if (isDebug) {
          requestAnimationFrame(() => {
            if (cardRef.current) {
              const post = cardRef.current.getBoundingClientRect();
              debugRef.current.post = post;
              if (debugRef.current.pre) {
                const d = post.top - debugRef.current.pre.top; // positive means moved down
                setDelta(d);
                // eslint-disable-next-line no-console
                let articleInfo: any = {};
                const articleEl = cardRef.current.querySelector('article');
                if (articleEl) {
                  const aPost = articleEl.getBoundingClientRect();
                  const aDelta = articlePreTopRef.current != null ? aPost.top - articlePreTopRef.current : 0;
                  setArticleDelta(aDelta);
                  const cs = window.getComputedStyle(articleEl);
                  articleInfo = {
                    articlePreTop: articlePreTopRef.current,
                    articlePostTop: aPost.top,
                    articleDelta: aDelta,
                    articleOffsetTop: (articleEl as HTMLElement).offsetTop,
                    articleMarginTop: cs.marginTop,
                    articleTransform: cs.transform,
                  };
                }
                console.log('[DeckHoverDebug]', { title, hasDescription: !!description, preTop: debugRef.current.pre.top, postTop: post.top, delta: d, ...articleInfo });
              }
            }
          });
        }
      }}
      onMouseLeave={() => { setIsHovered(false); if (isDebug) { setDelta(null); setArticleDelta(null); articlePreTopRef.current = null; } }}
      data-level={level}
    >
      {isDebug && preTop !== null && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-0 right-0 h-px bg-red-500/70"
            style={{ top: 0 }}
          />
          {/* Article top line (blue) - measures transformed element's top position relative to wrapper */}
          {articlePreTopRef.current !== null && articleDelta !== null && cardRef.current && (() => {
            const wrapperTop = preTop; // preTop is wrapper top before hover
            const currentArticleTopViewport = (cardRef.current.querySelector('article') as HTMLElement | null)?.getBoundingClientRect().top;
            if (currentArticleTopViewport != null) {
              const offsetInside = currentArticleTopViewport - wrapperTop;
              return <div className="absolute left-0 right-0 h-px bg-sky-500/80" style={{ top: offsetInside }} />;
            }
            return null;
          })()}
          {delta !== null && (
            <div className="absolute left-1 top-1 text-[10px] bg-black/60 text-white px-1 rounded">
              WrΔ:{delta.toFixed(2)}px{articleDelta !== null && <><br/>ArΔ:{articleDelta.toFixed(2)}px</>}
            </div>
          )}
        </div>
      )}
  <article className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-[var(--shadow-soft)] bg-white/90 dark:bg-neutral-900/80 transition-transform duration-300 group-hover:shadow-xl [transform-style:preserve-3d] group-hover:-translate-y-1 will-change-transform">
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

        {/* Hover Modal (placed after article so article remains first child for any global spacing rules) */}
        {description && isHovered && (
          <div
            className={`deck-description-popover lg-specular lg-regular pointer-events-none absolute left-1/2 bottom-full -translate-x-1/2 -translate-y-[15px] z-50 w-[95%] max-w-[320px] h-auto rounded-[14px] shadow-lg px-3 pt-3 pb-4 text-[13px] overflow-hidden border ${textColor}
              bg-white/75 dark:bg-neutral-900/75 backdrop-blur-xl border-white/30 dark:border-white/15`}
            data-interactive="true"
          >
            <p
              className="overflow-hidden text-ellipsis pointer-events-auto leading-snug"
              style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
            >
              {description}
            </p>
          </div>
        )}
    </div>
  );
}

export default DeckCardShell;
