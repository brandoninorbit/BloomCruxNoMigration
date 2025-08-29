"use client";
import React from "react";

type Props = {
  className?: string;
  /** If true, fills parent (no fixed aspect). If false/undefined, enforces 16:9 */
  fill?: boolean;
};

/**
 * DeckCoverAgentStealth: Tactical radar sweep over a dark grid.
 * - Pure CSS/SVG (no deps)
 * - One rotating radial-gradient-like beam (8–10s rotation)
 * - Faint scanline overlay
 * - Occasional blip pulses
 * - Fixed 16:9 by default; use `fill` to stretch
 */
export default function DeckCoverAgentStealth({ className, fill }: Props) {
  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;
  const rootStyle = fill ? undefined : ({ aspectRatio: "16/9" } as React.CSSProperties);

  return (
    <div className={rootClass} style={rootStyle}>
      {/* Background base */}
      <div className="absolute inset-0" aria-hidden>
        {/* Subtle dark greenish gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 20%, #0f1c14 0%, #0b1510 40%, #08110d 100%)",
          }}
        />

        {/* SVG grid + rings + sweep */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" role="img" aria-label="Animated radar sweep">
          <defs>
            {/* Grid pattern (faint) */}
            <pattern id="asg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2a20" strokeWidth="1" />
            </pattern>
            {/* Rings gradient for soft glow */}
            <radialGradient id="asg-ring-glow" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="#00ff7b" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#00ff7b" stopOpacity="0" />
            </radialGradient>
            {/* Beam radial gradient (brighter near center) */}
            <radialGradient id="asg-beam" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#62ff9b" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#2bff7a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2bff7a" stopOpacity="0" />
            </radialGradient>
            {/* Wedge mask to shape the beam */}
            <mask id="asg-beam-mask" maskUnits="userSpaceOnUse">
              {/* transparent background */}
              <rect x="0" y="0" width="1600" height="900" fill="black" />
              {/* white wedge reveals the beam */}
              <g transform="translate(800 450)">
                {/* 55° wedge */}
                <path d="M 0 0 L 800 0 A 800 800 0 0 1 458 655 Z" fill="white" />
              </g>
            </mask>
          </defs>

          {/* Grid */}
          <rect x="0" y="0" width="1600" height="900" fill="url(#asg-grid)" opacity="0.28" />

          {/* Rings + glow */}
          <g transform="translate(800 450)" opacity="0.45">
            {Array.from({ length: 6 }).map((_, i) => {
              const r = (i + 1) * 120;
              return (
                <g key={i}>
                  <circle r={r} fill="none" stroke="#1f3b2d" strokeWidth={2} />
                  <circle r={r} fill="url(#asg-ring-glow)" />
                </g>
              );
            })}
            {/* crosshair */}
            <line x1="-800" y1="0" x2="800" y2="0" stroke="#1f3b2d" strokeWidth={2} />
            <line x1="0" y1="-450" x2="0" y2="450" stroke="#1f3b2d" strokeWidth={2} />
          </g>

          {/* Sweeping beam (rotates around center) */}
          <g className="asg-spin">
            {/* beam body with gradient */}
            <g mask="url(#asg-beam-mask)">
              <circle r="900" fill="url(#asg-beam)" />
            </g>
            {/* leading edge line for crispness */}
            <g>
              <line x1="0" y1="0" x2="800" y2="0" stroke="#58ff96" strokeOpacity="0.55" strokeWidth={3} />
              <line x1="0" y1="0" x2="800" y2="0" stroke="#58ff96" strokeOpacity="0.9" strokeWidth={1} />
            </g>
          </g>

          {/* Blip pulses (static positions with long, staggered pulses) */}
          <g transform="translate(800 450)" className="asg-blips">
            {[
              { x: 260, y: -140, d: 8, delay: 1.2, period: 9 },
              { x: -320, y: 200, d: 10, delay: 3.1, period: 11 },
              { x: 60, y: 280, d: 7, delay: 5.5, period: 8 },
              { x: -420, y: -240, d: 9, delay: 7.2, period: 10 },
              { x: 420, y: 120, d: 8, delay: 2.4, period: 12 },
              { x: -120, y: -40, d: 7, delay: 6.4, period: 9 },
              { x: 300, y: -300, d: 8, delay: 4.7, period: 13 },
            ].map((b, i) => (
              <g key={i} transform={`translate(${b.x} ${b.y})`}>
                {/* static dot */}
                <circle r={b.d / 6} fill="#8affc1" fillOpacity="0.9" />
                {/* pulse ring */}
                <circle
                  r={b.d / 6}
                  className="asg-blip"
                  fill="none"
                  stroke="#8affc1"
                  strokeWidth={2}
                  style={{ animationDuration: `${b.period}s`, animationDelay: `${b.delay}s` }}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
          animation: "asg-scan 6s linear infinite",
          opacity: 0.6,
        }}
        aria-hidden
      />

      {/* Edge vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 100% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)",
        }}
        aria-hidden
      />

      {/* Scoped animations */}
      <style jsx>{`
        .asg-spin { transform-origin: 0 0; animation: asg-rotate 9s linear infinite; }
        @keyframes asg-rotate {
          from { transform: translate(800px, 450px) rotate(0deg); }
          to { transform: translate(800px, 450px) rotate(360deg); }
        }
        @keyframes asg-scan {
          0% { background-position-y: 0px; }
          100% { background-position-y: 8px; }
        }
        .asg-blips .asg-blip {
          transform-origin: center;
          opacity: 0;
          animation-name: asg-blip-pulse;
          animation-iteration-count: infinite;
        }
        @keyframes asg-blip-pulse {
          0% { opacity: 0; transform: scale(0); }
          6% { opacity: 0.9; transform: scale(1); }
          14% { opacity: 0.4; transform: scale(2); }
          22% { opacity: 0.1; transform: scale(3); }
          28% { opacity: 0; transform: scale(3.6); }
          100% { opacity: 0; transform: scale(0); }
        }
      `}</style>
    </div>
  );
}
