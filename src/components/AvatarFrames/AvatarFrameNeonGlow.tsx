"use client";
import React from "react";

export type AvatarFrameNeonGlowProps = {
  sizeClass?: string; // tailwind size class like "w-24 h-24"
  className?: string;
  strokeWidth?: number;
  innerColor?: string;
  outerColor?: string;
  pulse?: boolean;
};

export default function AvatarFrameNeonGlow({
  sizeClass = "w-24 h-24",
  className = "",
  strokeWidth = 3,
  innerColor = "#7C3AED",
  outerColor = "#06B6D4",
  pulse = true,
}: AvatarFrameNeonGlowProps) {
  const dashArray = 280; // circumference for a ring roughly matching 1:1 box
  return (
    <div className={`${sizeClass} ${className} inline-block`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          <filter id="neon-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={outerColor} floodOpacity="0.9" />
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor={outerColor} floodOpacity="0.6" />
            <feDropShadow dx="0" dy="0" stdDeviation="20" floodColor={innerColor} floodOpacity="0.4" />
          </filter>

          <linearGradient id="frame-grad" x1="0%" x2="100%">
            <stop offset="0%" stopColor={innerColor} stopOpacity="1" />
            <stop offset="100%" stopColor={outerColor} stopOpacity="1" />
          </linearGradient>

          <style>{`
            @keyframes dash-move { to { stroke-dashoffset: -${dashArray}; } }
            @keyframes pulse { 0% { filter: drop-shadow(0 0 4px ${outerColor}); } 50% { filter: drop-shadow(0 0 14px ${outerColor}); } 100% { filter: drop-shadow(0 0 4px ${outerColor}); } }
          `}</style>
        </defs>

        <g transform="translate(50,50)">
          {/* Outer glow ring */}
          <circle
            r="42"
            cx="0"
            cy="0"
            fill="none"
            stroke="url(#frame-grad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={0}
            style={{ filter: pulse ? 'url(#neon-shadow)' : undefined, transformOrigin: '50% 50%' }}
            className={pulse ? 'avatar-frame-outer-pulse' : ''}
          />

          {/* Inner subtle stroke for depth */}
          <circle
            r="32"
            cx="0"
            cy="0"
            fill="none"
            stroke={innerColor}
            strokeWidth={Math.max(1, Math.floor(strokeWidth / 2))}
            opacity={0.9}
            strokeDasharray={dashArray / 2}
            strokeDashoffset={0}
            className={pulse ? 'avatar-frame-inner-dash' : ''}
          />
        </g>

        <style>{`
          .avatar-frame-outer-pulse {
            animation: pulse 2.8s ease-in-out infinite;
          }
          .avatar-frame-inner-dash {
            transform-origin: 50% 50%;
            animation: dash-move 6s linear infinite;
          }
        `}</style>
      </svg>
    </div>
  );
}
