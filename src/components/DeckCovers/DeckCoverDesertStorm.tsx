"use client";
import React, { useEffect, useRef, useMemo } from "react";

export type Props = {
  className?: string;
  /** If true, fills parent (no fixed aspect). If false/undefined, enforces 16:9 */
  fill?: boolean;
};

/**
 * DeckCoverDesertStorm: Desert storm with drifting sand and heat haze.
 * - Three SVG dune curves with realistic desert contours
 * - Sparse sand particles drifting laterally with CSS animations
 * - Warm golden palette (#d4af37, #daa520, #b8860b, #8b7355, #f4e4bc)
 * - Heat-haze shimmer via subtle scaleY wobble
 * - Respects prefers-reduced-motion for accessibility
 * - GPU-friendly transforms and performance optimized
 */
export default function DeckCoverDesertStorm({ className, fill }: Props) {
  const particlesRef = useRef<SVGCircleElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  // Precompute 8 sand particles (sparse as specified)
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: 5 + (i * 12) + Math.random() * 8, // distributed across width
        y: 30 + (i * 8) + Math.random() * 20, // distributed in dune area
        delay: i * 0.7, // staggered start times
        duration: 12 + Math.random() * 8, // 12-20s drift cycles
        r: 0.3 + Math.random() * 0.4, // tiny radius
        driftRange: 15 + Math.random() * 10, // lateral drift distance
      })),
    []
  );

  useEffect(() => {
    if (reduceMotion) return;

    const t0 = performance.now();
    const loop = (t: number) => {
      const elapsed = (t - t0) / 1000;

      // Animate sand particles with lateral drift
      particles.forEach((p, i) => {
        const el = particlesRef.current[i];
        if (!el) return;

        const cycleTime = elapsed + p.delay;
        const phase = (cycleTime % p.duration) / p.duration;
        const driftX = Math.sin(phase * Math.PI * 2) * p.driftRange;

        el.setAttribute("transform", `translate(${driftX}, 0)`);
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [particles, reduceMotion]);

  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;
  const rootStyle = fill ? undefined : ({ aspectRatio: "16/9" } as React.CSSProperties);

  return (
    <div className={rootClass} style={rootStyle}>
      {/* Warm golden gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #f4e4bc 0%, #daa520 40%, #b8860b 80%, #8b7355 100%)",
        }}
        aria-hidden
      />

      {/* SVG desert scene */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        role="img"
        aria-label="Desert storm with drifting sand dunes"
      >
        <defs>
          {/* Dune curve shapes - realistic desert contours */}
          <path
            id="dune-1"
            d="M0,400 Q200,350 400,380 T800,400 Q1000,420 1200,380 T1600,400 L1600,900 L0,900 Z"
          />
          <path
            id="dune-2"
            d="M0,500 Q300,450 600,480 T1200,500 Q1400,520 1600,480 L1600,900 L0,900 Z"
          />
          <path
            id="dune-3"
            d="M0,600 Q400,550 800,580 T1600,600 L1600,900 L0,900 Z"
          />
        </defs>

        {/* Dune layers with golden gradients */}
        <g opacity="0.9">
          {/* Background dune */}
          <use
            href="#dune-1"
            fill="url(#dune-gradient-1)"
            className="ds-dune-1"
          />
          {/* Mid-ground dune */}
          <use
            href="#dune-2"
            fill="url(#dune-gradient-2)"
            className="ds-dune-2"
          />
          {/* Foreground dune */}
          <use
            href="#dune-3"
            fill="url(#dune-gradient-3)"
            className="ds-dune-3"
          />
        </g>

        {/* Sand particles */}
        <g opacity="0.6">
          {particles.map((p, i) => (
            <circle
              key={i}
              ref={(el) => {
                if (el) particlesRef.current[i] = el;
              }}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r={p.r}
              fill="#d4af37"
              className="ds-particle"
            />
          ))}
        </g>

        {/* Heat haze shimmer overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="none"
          className="ds-haze"
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="dune-gradient-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#daa520" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#b8860b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8b7355" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="dune-gradient-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f4e4bc" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#daa520" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#b8860b" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="dune-gradient-3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f4e4bc" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#d4af37" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#daa520" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top vignette for better text contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0) 60%)",
        }}
        aria-hidden
      />

      {/* Scoped animations */}
      <style jsx>{`
        .ds-dune-1 { animation: ds-dune-1-anim 20s ease-in-out infinite; transform-origin: 50% 70%; }
        .ds-dune-2 { animation: ds-dune-2-anim 25s ease-in-out infinite; transform-origin: 50% 75%; }
        .ds-dune-3 { animation: ds-dune-3-anim 18s ease-in-out infinite; transform-origin: 50% 80%; }
        .ds-haze { animation: ds-haze-anim 3s ease-in-out infinite; }

        @keyframes ds-dune-1-anim {
          0% { transform: scaleY(1) translateY(0px); }
          50% { transform: scaleY(1.02) translateY(-2px); }
          100% { transform: scaleY(1) translateY(0px); }
        }
        @keyframes ds-dune-2-anim {
          0% { transform: scaleY(1) translateY(0px); }
          50% { transform: scaleY(1.015) translateY(-1px); }
          100% { transform: scaleY(1) translateY(0px); }
        }
        @keyframes ds-dune-3-anim {
          0% { transform: scaleY(1) translateY(0px); }
          50% { transform: scaleY(1.025) translateY(-3px); }
          100% { transform: scaleY(1) translateY(0px); }
        }
        @keyframes ds-haze-anim {
          0% { opacity: 0.1; }
          50% { opacity: 0.3; }
          100% { opacity: 0.1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ds-dune-1, .ds-dune-2, .ds-dune-3, .ds-haze {
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
