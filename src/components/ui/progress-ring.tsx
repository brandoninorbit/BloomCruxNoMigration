'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressRingProps extends React.SVGProps<SVGSVGElement> {
  value: number;
}

export const ProgressRing = React.forwardRef<SVGSVGElement, ProgressRingProps>(
  ({ className, value, ...props }, ref) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
      <svg
        ref={ref}
        width="100"
        height="100"
        viewBox="0 0 100 100"
        className={cn('transform -rotate-90', className)}
        {...props}
      >
        <circle
          className="text-muted"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
        <circle
          className="text-primary"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
          style={{ transition: 'stroke-dashoffset 0.35s' }}
        />
        <text
          x="50"
          y="50"
          fontFamily="sans-serif"
          fontSize="24"
          dy=".3em"
          textAnchor="middle"
          className="transform rotate-90 origin-center fill-foreground font-bold"
        >
          {`${Math.round(value)}%`}
        </text>
      </svg>
    );
  }
);
ProgressRing.displayName = 'ProgressRing';



