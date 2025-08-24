"use client";
import React from "react";

// SunriseCover: pure React + Tailwind + SVG background animation
// props:
// - className: additional classes for the root
// - fill: when true, the cover will stretch to fill its parent (h-full w-full) instead of enforcing a 16:9 aspect ratio
export default function SunriseCover({ className, fill }: { className?: string; fill?: boolean }) {
  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;

  const rootStyle = fill ? undefined : { aspectRatio: '16/9' } as React.CSSProperties;

  return (
    <div className={rootClass} style={rootStyle}>
      {/* GPU friendly animated gradient using layered SVG + CSS animation */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#FFB56B">
            </stop>
            <stop offset="50%" stopColor="#FF8AA1">
            </stop>
            <stop offset="100%" stopColor="#9D4EDD">
            </stop>
          </linearGradient>
          <linearGradient id="g2" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#FFD8A8"/>
            <stop offset="50%" stopColor="#FF9FB3"/>
            <stop offset="100%" stopColor="#B48DF6"/>
          </linearGradient>
          <filter id="fBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" result="b" />
            <feBlend in="SourceGraphic" in2="b" mode="normal" />
          </filter>
        </defs>

        {/* Base horizon rectangle */}
        <rect x="0" y="0" width="1600" height="900" fill="url(#g1)" />

        {/* Animated overlay shapes to give soft gradient motion */}
        <g style={{ transformOrigin: '50% 50%' }}>
          <rect x="-200" y="200" width="2000" height="500" fill="url(#g2)" opacity="0.75">
            <animateTransform attributeName="transform" attributeType="XML" type="translate" dur="12s" repeatCount="indefinite" values="0 0; 40 -20; 0 0" />
            <animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0.8;0.6;0.8" />
          </rect>
        </g>

        {/* gentle radial bloom near horizon */}
        <circle cx="800" cy="620" r="260" fill="#fff" opacity="0.06">
          <animate attributeName="r" dur="10s" repeatCount="indefinite" values="250;270;250" />
          <animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0.06;0.12;0.06" />
        </circle>

        {/* subtle vignette */}
        <rect x="0" y="0" width="1600" height="900" fill="black" opacity="0.02" />
      </svg>

      {/* Foreground: minimalistic horizon element */}
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none">
        <div className="mx-auto max-w-4xl h-20 -mb-4 rounded-t-full bg-white/6 backdrop-blur-sm" style={{ filter: 'blur(8px)' }} />
      </div>

      {/* Title overlay sample (for preview) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-6 py-3 rounded-md bg-white/20 backdrop-blur-sm border border-white/10 text-white text-lg font-semibold">
          Sunrise
        </div>
      </div>
    </div>
  );
}
