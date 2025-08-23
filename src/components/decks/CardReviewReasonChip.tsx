"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export type ReviewReason = "due" | "low-acc" | "leech";

type Props = {
  reason: ReviewReason;
  className?: string;
};

const LABEL: Record<ReviewReason, string> = {
  "due": "Due",
  "low-acc": "Low-Acc",
  "leech": "Leech",
};

const EXPLAIN: Record<ReviewReason, string> = {
  "due": "This is due for review.",
  "low-acc": "Performance slipping—extra practice.",
  "leech": "Repeated lapses—time for rescue.",
};

// Tailwind color classes for neutral blue (due), amber (low-acc), red (leech)
const COLOR: Record<ReviewReason, string> = {
  "due": "bg-blue-50 text-blue-700 border border-blue-200",
  "low-acc": "bg-amber-50 text-amber-700 border border-amber-200",
  "leech": "bg-red-50 text-red-700 border border-red-200",
};

export default function CardReviewReasonChip({ reason, className }: Props) {
  const label = LABEL[reason];
  const tip = EXPLAIN[reason];
  const color = COLOR[reason];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color} ${className ?? ""}`}>
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
