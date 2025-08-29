"use client";
import React, { useEffect, useRef, useMemo } from "react";

export type Props = {
  className?: string;
  /** If true, fills parent (no fixed aspect). If false/undefined, enforces 16:9 */
  fill?: boolean;
};

/**
 * DeckCoverRainforest: Realistic rainforest foliage with layered depth and subtle animations.
 * - Four distinct foliage layers: banana leaves, fern fronds, mid-canopy shrubs, foreground palms
 * - Phase-offset sway with tiny rotations and translations
 * - Vertical depth fog gradient (dark foreground to light background)
 * - Subtle insect glints with RAF animation
 * - Respects prefers-reduced-motion for accessibility
 * - GPU-friendly transforms and performance optimized
 */
export default function DeckCoverRainforest({ className, fill }: Props) {
  const glintsRef = useRef<SVGCircleElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  // Precompute 6 glint positions (max visible as specified)
  const glints = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: 10 + (i * 15) + Math.random() * 10, // distributed across width
        y: 25 + (i * 10) + Math.random() * 15, // distributed in foliage area
        delay: i * 1.5, // staggered start times
        duration: 6 + Math.random() * 3, // 6-9s as specified
        r: 0.8 + Math.random() * 0.4, // small radius
      })),
    []
  );

  useEffect(() => {
    if (reduceMotion) return;

    const t0 = performance.now();
    const loop = (t: number) => {
      const elapsed = (t - t0) / 1000;

      // Animate glints with blink pattern
      glints.forEach((g, i) => {
        const el = glintsRef.current[i];
        if (!el) return;

        const cycleTime = elapsed + g.delay;
        const phase = cycleTime % g.duration;
        const blinkDuration = 0.8; // 0.8s blink time

        let opacity = 0;
        if (phase < blinkDuration) {
          // Fade in
          opacity = Math.min(phase / (blinkDuration / 2), 1);
        } else if (phase < blinkDuration * 2) {
          // Fade out
          opacity = Math.max(1 - (phase - blinkDuration) / (blinkDuration / 2), 0);
        }

        el.setAttribute("opacity", (opacity * 0.1).toFixed(3)); // 10% max opacity
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [glints, reduceMotion]);

  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;
  const rootStyle = fill ? undefined : ({ aspectRatio: "16/9" } as React.CSSProperties);

  return (
    <div className={rootClass} style={rootStyle}>
      {/* Depth fog gradient - vertical, foreground darkest to background lightest */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #0b2b25 0%, #114236 35%, #1b5a45 70%, #2f7a5b 100%)",
        }}
        aria-hidden
      />

      {/* SVG foliage layers */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="Realistic rainforest foliage layers"
      >
        <defs>
          {/* Banana leaf shape - large, ribbed, realistic */}
          <path
            id="banana-leaf"
            d="M0,0 C50,-20 120,-30 180,-20 C220,-10 240,10 220,30 C180,50 120,60 50,50 C20,40 0,20 0,0 Z M20,5 C40,-5 80,-10 120,-5 C140,0 150,15 130,25 C100,35 60,40 20,30 C10,20 5,10 20,5 Z"
          />

          {/* Fern frond - central rachis with pinnae */}
          <g id="fern-frond">
            <path d="M0,-200 L0,200" stroke="#2f7a5b" strokeWidth="3" fill="none" />
            {/* Pinnae pairs */}
            {Array.from({ length: 12 }, (_, i) => {
              const y = -180 + i * 30;
              const length = 40 + (i % 3) * 10;
              return (
                <g key={i}>
                  <path
                    d={`M0,${y} L${length},${y - 8}`}
                    stroke="#2f7a5b"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M0,${y} L${length},${y + 8}`}
                    stroke="#2f7a5b"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>

          {/* Mid-canopy shrub - rounded, bushy */}
          <path
            id="shrub"
            d="M-40,20 C-30,-10 -10,-20 0,-20 C20,-20 40,-10 50,10 C60,20 55,35 40,40 C20,45 0,40 -20,35 C-35,30 -45,25 -40,20 Z M-20,15 C-10,-5 10,-10 25,0 C35,10 30,25 15,30 C0,35 -15,30 -25,25 C-30,20 -25,15 -20,15 Z"
          />

          {/* Palm frond - curved with leaflets */}
          <g id="palm-frond">
            <path d="M0,0 Q50,-50 100,-80" stroke="#2f7a5b" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Leaflets */}
            {Array.from({ length: 8 }, (_, i) => {
              const t = i / 7;
              const x = 20 + t * 60;
              const y = -10 - t * 50;
              const length = 25 - t * 10;
              return (
                <path
                  key={i}
                  d={`M${x},${y} L${x + length},${y - 5}`}
                  stroke="#2f7a5b"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </defs>

        {/* Layer 1: Background banana leaves */}
        <g className="rf-sway-1" opacity="0.4" transform="translate(200, 150)">
          {Array.from({ length: 4 }, (_, i) => (
            <use
              key={i}
              href="#banana-leaf"
              fill="#2f7a5b"
              transform={`translate(${i * 300}, ${i % 2 * 50}) scale(${0.8 + i * 0.1}) rotate(${i * 15})`}
            />
          ))}
        </g>

        {/* Layer 2: Mid-background fern fronds */}
        <g className="rf-sway-2" opacity="0.6" transform="translate(100, 200)">
          {Array.from({ length: 6 }, (_, i) => (
            <use
              key={i}
              href="#fern-frond"
              transform={`translate(${i * 250}, ${i % 2 * 30}) scale(${0.7 + i * 0.1}) rotate(${i * 10 - 30})`}
            />
          ))}
        </g>

        {/* Layer 3: Mid-foreground shrubs */}
        <g className="rf-sway-3" opacity="0.8" transform="translate(50, 350)">
          {Array.from({ length: 5 }, (_, i) => (
            <use
              key={i}
              href="#shrub"
              fill="#1b5a45"
              transform={`translate(${i * 280}, ${i % 2 * 40}) scale(${0.9 + i * 0.1}) rotate(${i * 8})`}
            />
          ))}
        </g>

        {/* Layer 4: Foreground palms */}
        <g className="rf-sway-4" opacity="0.95" transform="translate(150, 500)">
          {Array.from({ length: 3 }, (_, i) => (
            <use
              key={i}
              href="#palm-frond"
              transform={`translate(${i * 400}, ${i % 2 * 60}) scale(${1.0 + i * 0.2}) rotate(${i * 12 - 20})`}
            />
          ))}
        </g>

        {/* Insect glints */}
        <g opacity="0.1">
          {glints.map((g, i) => (
            <circle
              key={i}
              ref={(el) => {
                if (el) glintsRef.current[i] = el;
              }}
              cx={`${g.x}%`}
              cy={`${g.y}%`}
              r={g.r}
              fill="#7bd389"
              opacity="0"
            />
          ))}
        </g>
      </svg>

      {/* Top vignette for better text contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0) 60%)",
        }}
        aria-hidden
      />

      {/* Scoped animations */}
      <style jsx>{`
        .rf-sway-1 { animation: rf-sway-1-anim 17s ease-in-out infinite; transform-origin: 50% 80%; }
        .rf-sway-2 { animation: rf-sway-2-anim 14s ease-in-out infinite; transform-origin: 50% 85%; }
        .rf-sway-3 { animation: rf-sway-3-anim 11s ease-in-out infinite; transform-origin: 50% 90%; }
        .rf-sway-4 { animation: rf-sway-4-anim 8s ease-in-out infinite; transform-origin: 50% 95%; }

        @keyframes rf-sway-1-anim {
          0% { transform: translateY(0%) rotate(-2deg); }
          50% { transform: translateY(-1.5%) rotate(2deg); }
          100% { transform: translateY(0%) rotate(-2deg); }
        }
        @keyframes rf-sway-2-anim {
          0% { transform: translateY(0%) rotate(2.5deg); }
          50% { transform: translateY(-1%) rotate(-2.5deg); }
          100% { transform: translateY(0%) rotate(2.5deg); }
        }
        @keyframes rf-sway-3-anim {
          0% { transform: translateY(0%) rotate(-3deg); }
          50% { transform: translateY(1%) rotate(3deg); }
          100% { transform: translateY(0%) rotate(-3deg); }
        }
        @keyframes rf-sway-4-anim {
          0% { transform: translateY(0%) rotate(3.5deg); }
          50% { transform: translateY(-1.5%) rotate(-3.5deg); }
          100% { transform: translateY(0%) rotate(3.5deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .rf-sway-1, .rf-sway-2, .rf-sway-3, .rf-sway-4 {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/** Hook: prefers-reduced-motion */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setReduced(mq.matches);
    listener();
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);
  return reduced;
}
