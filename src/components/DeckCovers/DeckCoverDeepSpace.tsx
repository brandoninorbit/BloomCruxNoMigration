"use client";
import React, { useEffect, useMemo, useRef } from "react";

type Props = {
  className?: string;
  /** If true, fills parent (no fixed aspect). If false/undefined, enforces 16:9 */
  fill?: boolean;
};

type Star = {
  x: number;
  y: number;
  r: number; // radius in CSS pixels (will be scaled by DPR in draw)
  baseOpacity: number;
  twinkleAmp: number; // 0..1 additional opacity
  twinkleFreq: number; // radians per second
  phase: number; // 0..2PI
  vx: number; // px/sec
  vy: number; // px/sec
  color: string;
};

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * DeckCoverDeepSpace: GPU-friendly canvas starfield with two parallax layers, soft twinkle, and a very dark navy palette.
 * - ~300 stars
 * - Two parallax layers drifting slowly at different speeds
 * - Occasional twinkle via opacity modulation
 * - Fixed 16:9 aspect ratio by default (can fill container via `fill`)
 */
export default function DeckCoverDeepSpace({ className, fill }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const starsRef = useRef<Star[]>([]);
  const lastTsRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // Palette for subtle bluish whites
  const starPalette = useMemo(
    () => [
      "#dbe8ff",
      "#cfe2ff",
      "#b7d1ff",
      "#a6c4ff",
      "#9bbcff",
      "#f0f5ff",
      "#e6f0ff",
    ],
    []
  );

  const initStars = (w: number, h: number) => {
    const total = 300; // requested ~300
    const farCount = Math.floor(total * 0.66);
    const nearCount = total - farCount;
    const arr: Star[] = [];

    // Far layer: smaller, slower
    for (let i = 0; i < farCount; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: random(0.3, 1.1),
        baseOpacity: random(0.3, 0.7),
        twinkleAmp: random(0.05, 0.2),
        twinkleFreq: random(0.2, 0.6),
        phase: random(0, Math.PI * 2),
        vx: random(-4, -1), // px/sec, slow drift left
        vy: random(-0.3, 0.3), // tiny vertical wander
        color: starPalette[(Math.random() * starPalette.length) | 0],
      });
    }

    // Near layer: larger, a bit faster
    for (let i = 0; i < nearCount; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: random(0.8, 2.2),
        baseOpacity: random(0.4, 0.9),
        twinkleAmp: random(0.1, 0.35),
        twinkleFreq: random(0.4, 1.1),
        phase: random(0, Math.PI * 2),
        vx: random(-12, -5), // px/sec
        vy: random(-0.6, 0.6),
        color: starPalette[(Math.random() * starPalette.length) | 0],
      });
    }

    starsRef.current = arr;
  };

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR for perf
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    sizeRef.current = { w, h, dpr };
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // reinitialize stars when size changes for best distribution
    initStars(w, h);
  };

  const step = (ts: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h, dpr } = sizeRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // compute dt in seconds
    let dt = 0.016;
    if (lastTsRef.current) {
      dt = Math.min(0.05, Math.max(0, (ts - lastTsRef.current) / 1000));
    }
    lastTsRef.current = ts;

    // Background fill: deep navy gradient (GPU-friendly since it's 1 draw)
    const grd = ctx.createLinearGradient(0, 0, 0, h * dpr);
    grd.addColorStop(0, "#070b1a"); // near-black navy
    grd.addColorStop(1, "#0a1230"); // deep blue
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w * dpr, h * dpr);

    // subtle vignette
    const rad = Math.max(w, h) * dpr;
    const vignette = ctx.createRadialGradient(
      (w * dpr) / 2,
      (h * dpr) / 2,
      rad * 0.2,
      (w * dpr) / 2,
      (h * dpr) / 2,
      rad * 0.9
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w * dpr, h * dpr);

    // draw stars
    ctx.save();
    ctx.scale(dpr, dpr);
    const stars = starsRef.current;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      // position update
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // wrap horizontally
      if (s.x < -4) s.x = w + 4;
      if (s.x > w + 4) s.x = -4;
      if (s.y < -4) s.y = h + 4;
      if (s.y > h + 4) s.y = -4;

      // twinkle
      const twinkle = Math.sin(ts / 1000 * s.twinkleFreq + s.phase) * s.twinkleAmp;
      const opacity = Math.min(1, Math.max(0, s.baseOpacity + twinkle));

      // soft glow: draw a tiny radial gradient
  const glowR = s.r * 3;
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
      g.addColorStop(0, `${s.color}cc`); // core
      g.addColorStop(0.4, `${s.color}88`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // star core
      ctx.globalAlpha = opacity;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    animationRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    resize();
    animationRef.current = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootClass = fill
    ? `relative overflow-hidden h-full w-full ${className ?? ""}`
    : `relative overflow-hidden ${className ?? ""} rounded-md`;
  const rootStyle = fill ? undefined : ({ aspectRatio: "16/9" } as React.CSSProperties);

  return (
    <div className={rootClass} style={rootStyle}>
      {/* static background gradient layer to ensure dark navy even before canvas paints */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0a1230] via-[#070b1a] to-[#050814]" />

      {/* starfield canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

      {/* subtle top glow to add depth */}
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen" style={{
        background:
          "radial-gradient(120% 60% at 50% -10%, rgba(40,70,150,0.35) 0%, rgba(20,30,60,0.0) 60%)",
      }} />

      {/* faint vignette using CSS for extra depth (GPU-friendly) */}
      <div className="pointer-events-none absolute inset-0" style={{
        background:
          "radial-gradient(100% 100% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)",
      }} />
    </div>
  );
}
