"use client";
import React, { useMemo } from "react";

type Props = {
  className?: string;
  /** If true, fills parent (no fixed aspect). If false/undefined, enforces 16:9 */
  fill?: boolean;
};

type WindowLight = { x: number; y: number; w: number; h: number; delay: number; dur: number; layer: "mid" | "near" };

// Simple helper to create pseudo-random but stable values when rendered
function rand(n: number) {
  return Math.random() * n;
}

export default function DeckCoverNightMission({ className, fill }: Props) {
  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;
  const rootStyle = fill ? undefined : ({ aspectRatio: "16/9" } as React.CSSProperties);

  // Precompute a set of window rectangles clipped to mid/near skylines
  const windows = useMemo<WindowLight[]>(() => {
    const arr: WindowLight[] = [];
    const total = 240; // doubled twinkling windows
    for (let i = 0; i < total; i++) {
      const layer: "mid" | "near" = i % 3 === 0 ? "near" : "mid"; // bias a bit towards mid
      const w = 6 + rand(5);
      const h = 10 + rand(6);
      const x = rand(1600);
      // y distribution: windows mostly in middle-lower band
      const y = 380 + rand(280) + (layer === "near" ? -30 : 0);
      const delay = rand(10); // seconds
      const dur = 2 + rand(6); // 2-8s
      arr.push({ x, y, w, h, delay, dur, layer });
    }
    return arr;
  }, []);

  return (
    <div className={rootClass} style={rootStyle}>
      {/* CSS animations for parallax and window blinking */}
      <style>{`
        @keyframes nm-pan-slow { from { transform: translate3d(0,0,0); } to { transform: translate3d(-160px,0,0); } }
        @keyframes nm-pan-med  { from { transform: translate3d(0,0,0); } to { transform: translate3d(-260px,0,0); } }
        @keyframes nm-pan-fast { from { transform: translate3d(0,0,0); } to { transform: translate3d(-420px,0,0); } }
        @keyframes nm-blink    { 0%, 8% { opacity: 0.0 } 10%, 45% { opacity: 0.9 } 47% { opacity: 0.3 } 50%, 100% { opacity: 0.0 } }
        .nm-will { will-change: transform; }
        .nm-slow { animation: nm-pan-slow 60s linear infinite; }
        .nm-med  { animation: nm-pan-med  45s linear infinite; }
        .nm-fast { animation: nm-pan-fast 32s linear infinite; }
      `}</style>

      {/* SVG scene uses viewBox 1600x900 (16:9) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Sky gradient */}
          <linearGradient id="nm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1530" />
            <stop offset="60%" stopColor="#0a1a3d" />
            <stop offset="100%" stopColor="#0a1e49" />
          </linearGradient>
          {/* Soft haze near horizon */}
          <linearGradient id="nm-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2a55" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0a1a3d" stopOpacity="0" />
          </linearGradient>

          {/* Skyline paths as clipPaths so we can constrain window lights */}
          <clipPath id="nm-clip-mid">
            <path d="M0,700 L0,900 L1600,900 L1600,700 
              C1450,670 1400,640 1300,660 
              C1200,680 1180,610 1100,630 
              C1040,645 990,620 920,640 
              C850,660 820,590 760,620 
              C700,650 640,610 580,640 
              C520,670 500,630 420,650 
              C360,665 320,640 280,660 
              C200,700 120,670 0,700 Z" />
          </clipPath>
          <clipPath id="nm-clip-near">
            <path d="M0,740 L0,900 L1600,900 L1600,740 
              C1500,720 1460,690 1400,710 
              C1320,735 1260,700 1200,720 
              C1120,745 1060,710 980,730 
              C900,755 820,730 750,750 
              C680,770 600,745 540,760 
              C480,780 420,760 350,780 
              C280,800 200,770 120,785 
              C80,792 40,760 0,740 Z" />
          </clipPath>
        </defs>

        {/* Background sky */}
        <rect x="0" y="0" width="1600" height="900" fill="url(#nm-sky)" />
        <rect x="0" y="540" width="1600" height="360" fill="url(#nm-haze)" />

        {/* Far skyline (very dark, slow parallax) - duplicated for seamless pan */}
        <g className="nm-will nm-slow" style={{ transformOrigin: '0 0' }}>
          <g>
            <path d="M0,660 L0,900 L800,900 L800,660 C760,650 740,620 700,640 C660,660 620,610 580,640 C520,685 480,650 420,670 C380,680 340,650 300,670 C220,710 160,680 0,660 Z" fill="#0a1130" />
            <path d="M800,660 L800,900 L1600,900 L1600,660 C1560,650 1540,620 1500,640 C1460,660 1420,610 1380,640 C1320,685 1280,650 1220,670 C1180,680 1140,650 1100,670 C1020,710 960,680 800,660 Z" fill="#0a1130" />
          </g>
        </g>

        {/* Mid skyline (dark, medium parallax) - duplicated for seamless pan */}
        <g className="nm-will nm-med" style={{ transformOrigin: '0 0' }}>
          <g>
            <path d="M0,700 L0,900 L800,900 L800,700 C760,670 700,650 660,665 C620,680 600,650 560,665 C500,690 460,660 420,680 C360,705 320,690 280,700 C220,720 160,710 0,700 Z" fill="#0b1436" />
            <path d="M800,700 L800,900 L1600,900 L1600,700 C1560,670 1500,650 1460,665 C1420,680 1400,650 1360,665 C1300,690 1260,660 1220,680 C1160,705 1120,690 1080,700 C1020,720 960,710 800,700 Z" fill="#0b1436" />
          </g>
        </g>

        {/* Near skyline (less dark, faster parallax) - duplicated for seamless pan */}
        <g className="nm-will nm-fast" style={{ transformOrigin: '0 0' }}>
          <g>
            <path d="M0,740 L0,900 L800,900 L800,740 C760,725 730,705 690,720 C650,735 610,715 570,730 C520,750 480,735 430,750 C380,770 330,750 280,765 C220,785 160,770 0,740 Z" fill="#0d1a42" />
            <path d="M800,740 L800,900 L1600,900 L1600,740 C1560,725 1530,705 1490,720 C1450,735 1410,715 1370,730 C1320,750 1280,735 1230,750 C1180,770 1130,750 1080,765 C1020,785 960,770 800,740 Z" fill="#0d1a42" />
          </g>
        </g>

        {/* Windows clipped to skylines; random blink via CSS keyframes */}
        <g clipPath="url(#nm-clip-mid)">
          {windows.filter(w => w.layer === 'mid').map((r, i) => (
            <rect key={`wm-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={1}
              fill="#ffd35c" opacity={0}
              style={{ animation: `nm-blink ${r.dur}s ease-in-out ${r.delay}s infinite` }} />
          ))}
        </g>
        <g clipPath="url(#nm-clip-near)">
          {windows.filter(w => w.layer === 'near').map((r, i) => (
            <rect key={`wn-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={1}
              fill="#ffe08a" opacity={0}
              style={{ animation: `nm-blink ${r.dur}s ease-in-out ${r.delay}s infinite` }} />
          ))}
        </g>

        {/* Subtle vignette */}
        <rect x="0" y="0" width="1600" height="900" fill="black" opacity="0.15" />
      </svg>
    </div>
  );
}
